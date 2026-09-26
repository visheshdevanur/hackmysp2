import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { githubApiHeaders } from '@/lib/github-auth';
import { evaluateTimedSession } from '@/lib/session-evaluation';
import { publicQuiz } from '@/lib/repo-quiz';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Student account required.' }, { status: 403 });
  let session;
  try {
    session = await prisma.workSession.findFirst({ where: { id: params.id, userId: user.id }, include: { challenge: true, recordings: { orderBy: [{ segmentIndex: 'asc' }, { chunkIndex: 'asc' }] } } });
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    if (session.status === 'submitted' && session.credentialId) {
      const credential = await prisma.credential.findUnique({ where: { id: session.credentialId } });
      return NextResponse.json({ credential: { id: credential.id, quizAvailable: true }, analysis: session.analysisJson ? JSON.parse(session.analysisJson) : null, alreadySubmitted: true });
    }
    const { githubRepoUrl } = await request.json();
    const repositoryUrl = String(githubRepoUrl || '').trim();
    if (repositoryUrl.length > 500) return NextResponse.json({ error: 'Repository URL is too long.' }, { status: 400 });
    if (!session.recordings.length) return NextResponse.json({ error: 'No session recording has been saved yet. Record some work before submitting.' }, { status: 400 });
    if (session.status === 'analyzing') return NextResponse.json({ error: 'This session is already being analyzed. Wait a moment and refresh My submissions.' }, { status: 409 });
    if (session.status === 'active') {
      const delta = session.lastHeartbeatAt ? Math.min(15, Math.max(0, Math.floor((Date.now() - new Date(session.lastHeartbeatAt).getTime()) / 1000))) : 0;
      session = await prisma.workSession.update({ where: { id: session.id }, data: { status: 'paused', elapsedSeconds: Math.min(session.durationSeconds, session.elapsedSeconds + delta), lastHeartbeatAt: null }, include: { challenge: true, recordings: { orderBy: [{ segmentIndex: 'asc' }, { chunkIndex: 'asc' }] } } });
    }
    await prisma.workSession.update({ where: { id: session.id }, data: { status: 'analyzing', repoUrl: repositoryUrl, analysisError: null } });
    const headers = await githubApiHeaders(user.id);
    const assessment = await evaluateTimedSession({ session, repositoryUrl, headers });
    const commitsRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(assessment.repoFullName.split('/')[0])}/${encodeURIComponent(assessment.repoFullName.split('/')[1])}/commits?per_page=100`, { headers, cache: 'no-store' });
    const commits = commitsRes.ok ? await commitsRes.json() : [];
    const credential = await prisma.credential.create({ data: {
      userId: user.id,
      challengeId: session.challengeId,
      githubRepoUrl: assessment.repoFullName ? `https://github.com/${assessment.repoFullName}` : repositoryUrl,
      repoCommitSha: assessment.commitSha,
      submissionMode: `recorded-session-${session.id}`,
      aiModel: assessment.model,
      quizJson: JSON.stringify(assessment.questions),
      commits: Array.isArray(commits) ? commits.length : 0,
      daysTaken: 0,
      isVerified: false,
    } });
    await prisma.workSession.update({ where: { id: session.id }, data: { status: 'submitted', credentialId: credential.id, repoCommitSha: assessment.commitSha, analysisJson: JSON.stringify(assessment.report), analysisModel: assessment.model, analysisError: null, completedAt: new Date() } });
    return NextResponse.json({
      credential: { id: credential.id, quizAvailable: true },
      quiz: { questions: publicQuiz(assessment.questions) },
      analysis: assessment.report,
      model: assessment.model,
    }, { status: 201 });
  } catch (error) {
    console.error('Timed session analysis failed', error);
    if (session?.id) await prisma.workSession.update({ where: { id: session.id }, data: { status: 'paused', analysisError: String(error?.message || 'Analysis failed').slice(0, 800) } }).catch(() => {});
    const message = error?.message || 'Could not analyze this session. Your saved recording is still available; try again later.';
    const status = /Gemini|Google Gemini|GitHub could not|temporarily at capacity|rate limit|configured|connection available/i.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
