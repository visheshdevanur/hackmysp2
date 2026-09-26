import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Developer account required.' }, { status: 403 });
  const { consent } = await request.json().catch(() => ({}));
  if (consent !== true) return NextResponse.json({ error: 'Consent is required before the speaking round starts.' }, { status: 400 });
  const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, include: { challenge: true } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  if (credential.quizAttemptStatus !== 'completed') return NextResponse.json({ error: 'Complete the PRI quiz before starting the speaking round.' }, { status: 409 });
  if (credential.speakingStatus !== 'ready') return NextResponse.json({ error: credential.speakingStatus === 'in_progress' ? 'This speaking round is already in progress and cannot be restarted.' : 'This speaking round has already finished and is locked.' }, { status: 409 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'Speaking round AI is not configured on the server.' }, { status: 503 });
  const seed = randomInt(1, 1_000_000);
  const company = credential.challenge.companyName || 'the company';
  const prompt = `Create exactly one concise, open-ended spoken interview question for a developer candidate. Select a varied question at random (variation seed ${seed}). It must be grounded in the job description and role, test practical understanding, and invite a 1–2 minute answer. Do not ask about personal or protected characteristics. Role: ${credential.challenge.role}. Job description: ${credential.challenge.description}. Requirements: ${credential.challenge.requirements}. Company: ${company}. Return JSON with a single string field named question.`;
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite')}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }, maxOutputTokens: 300 } }), signal: AbortSignal.timeout(30_000) });
  } catch {
    return NextResponse.json({ error: 'Gemini could not generate the recruiter-specific question. Retry shortly.' }, { status: 503 });
  }
  if (!response.ok) return NextResponse.json({ error: response.status === 429 ? 'Gemini free-tier limit reached. Try the speaking round later.' : 'Gemini could not generate the recruiter-specific question.' }, { status: response.status === 429 || response.status === 503 ? 503 : 502 });
  let generated;
  try { generated = JSON.parse((await response.json()).candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '{}'); } catch { generated = {}; }
  const question1 = String(generated.question || '').trim().slice(0, 600);
  if (question1.length < 12) return NextResponse.json({ error: 'Gemini returned an unusable interview question. Retry shortly.' }, { status: 502 });
  const startedAt = new Date();
  const data = { question1, question2: `What are you looking forward to from ${company}, and how would you be useful to the company?`, question1StartedAt: startedAt.toISOString(), question2StartedAt: null, questionTimings: [] };
  const updated = await prisma.credential.updateMany({ where: { id: credential.id, userId: user.id, quizAttemptStatus: 'completed', speakingStatus: 'ready' }, data: { speakingStatus: 'in_progress', speakingStartedAt: startedAt, speakingFinishedAt: null, speakingDataJson: JSON.stringify(data), speakingResultJson: null } });
  if (updated.count !== 1) return NextResponse.json({ error: 'This speaking round was already started.' }, { status: 409 });
  return NextResponse.json({ status: 'in_progress', startedAt, durationSeconds: 420, ...data });
}
