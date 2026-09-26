import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { challengeScoreBreakdown } from '@/lib/challenge-scores';

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'recruiter') return NextResponse.json({ error: 'Recruiter account required.' }, { status: 403 });
  const challenge = await prisma.challenge.findFirst({ where: { id: params.id, creatorId: user.id } });
  if (!challenge) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  const ids = [...new Set((await request.json().catch(() => ({}))).credentialIds || [])];
  if (ids.length !== 2) return NextResponse.json({ error: 'Choose exactly two developers from this job.' }, { status: 400 });
  const credentials = await prisma.credential.findMany({ where: { id: { in: ids }, challengeId: challenge.id }, include: { user: { select: { name: true, githubUsername: true } }, reviews: { select: { calculatedScore: true, comment: true } }, workSession: { select: { analysisJson: true } } } });
  if (credentials.length !== 2) return NextResponse.json({ error: 'Both submissions must belong to this job.' }, { status: 400 });
  if (new Set(credentials.map(item => item.userId)).size !== 2) return NextResponse.json({ error: 'Select two different developers.' }, { status: 400 });
  const candidates = credentials.map(c => {
    let sessionReport = null; let speakingReport = null;
    try { sessionReport = JSON.parse(c.workSession?.analysisJson || 'null'); } catch {}
    try { speakingReport = JSON.parse(c.speakingResultJson || 'null'); } catch {}
    return { name: c.user.name || c.user.githubUsername || 'Candidate', scores: challengeScoreBreakdown({ ...c, workSession: c.workSession }, c.reviews.length), evidence: { verified: c.isVerified, repository: c.githubRepoUrl, commits: c.commits, reviewerComments: c.reviews.map(r => r.comment).filter(Boolean), sessionAssessment: sessionReport, quizStatus: c.quizAttemptStatus, speakingStatus: c.speakingStatus, speakingAssessment: speakingReport } };
  });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'AI comparison needs GEMINI_API_KEY configured on the server.' }, { status: 503 });
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const prompt = `Compare these two candidates for the same role. Use only the supplied evidence. Do not infer protected traits or make a hiring decision. State concrete strengths, gaps, evidence that is missing, and useful follow-up interview probes. Scores are 0-100 or null when pending. Return JSON with a short summary and candidates array containing name, strengths (strings), gaps (strings), and followUp (strings). Role: ${challenge.role}. Job: ${challenge.title}. Job description: ${challenge.description}. Candidate evidence: ${JSON.stringify(candidates)}`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }), signal: AbortSignal.timeout(25_000) });
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? 'Gemini is at capacity. Retry the comparison shortly.' : 'Gemini could not prepare the comparison.' }, { status: response.status === 429 ? 503 : 502 });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '{}';
    const feedback = JSON.parse(text);
    return NextResponse.json({ ...feedback, candidates: (feedback.candidates || []).map(candidate => ({ ...candidate, scores: candidates.find(item => item.name === candidate.name)?.scores || null })) });
  } catch (error) { return NextResponse.json({ error: error.name === 'TimeoutError' ? 'AI comparison timed out. Retry shortly.' : 'AI comparison response could not be read.' }, { status: 502 }); }
}
