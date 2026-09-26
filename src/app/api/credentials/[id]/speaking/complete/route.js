import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { evaluateSpeakingRound } from '@/lib/speaking-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 300;
function parse(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }

export async function POST(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Developer account required.' }, { status: 403 });
  let credential;
  try {
    credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, include: { challenge: true, quizRecordings: { orderBy: [{ segmentIndex: 'asc' }, { chunkIndex: 'asc' }] } } });
    if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
    if (!['in_progress', 'analysis_failed'].includes(credential.speakingStatus)) return NextResponse.json({ error: 'No active speaking round is available to submit.' }, { status: 409 });
    const data = parse(credential.speakingDataJson);
    const now = new Date();
    const timedOut = now - credential.speakingStartedAt >= 420_000;
    const q1 = credential.quizRecordings.some(row => row.segmentIndex === 1);
    const q2 = credential.quizRecordings.some(row => row.segmentIndex === 2);
    if (!q1 || (!q2 && !timedOut) || (!data.question2StartedAt && !timedOut)) return NextResponse.json({ error: 'Answer both questions and save both recording segments before submitting.' }, { status: 400 });
    if (data.question2StartedAt && !data.questionTimings?.some(item => item.questionIndex === 1)) {
      data.questionTimings = [...(data.questionTimings || []), { questionIndex: 1, elapsedSeconds: Math.max(0, Math.floor((now - new Date(data.question2StartedAt)) / 1000)) }];
    }
    if (timedOut && !data.questionTimings?.some(item => item.questionIndex === 0)) data.questionTimings = [...(data.questionTimings || []), { questionIndex: 0, elapsedSeconds: Math.min(420, Math.max(0, Math.floor((now - new Date(data.question1StartedAt)) / 1000))) }];
    const lock = await prisma.credential.updateMany({ where: { id: credential.id, userId: user.id, speakingStatus: credential.speakingStatus }, data: { speakingStatus: 'analyzing', speakingDataJson: JSON.stringify(data) } });
    if (!lock.count) return NextResponse.json({ error: 'This speaking round is already being submitted.' }, { status: 409 });
    const result = await evaluateSpeakingRound({ credential, data, recordings: credential.quizRecordings });
    const finalResult = { ...result, status: timedOut ? 'timed_out' : 'completed' };
    await prisma.credential.update({ where: { id: credential.id }, data: { speakingStatus: finalResult.status, speakingFinishedAt: now, speakingDataJson: JSON.stringify(data), speakingResultJson: JSON.stringify(finalResult) } });
    return NextResponse.json(finalResult);
  } catch (error) {
    console.error('Speaking-round assessment failed', error);
    if (credential?.id) await prisma.credential.updateMany({ where: { id: credential.id, speakingStatus: 'analyzing' }, data: { speakingStatus: 'analysis_failed' } }).catch(() => {});
    return NextResponse.json({ error: String(error?.message || 'Could not analyze the speaking round. Recording is saved; retry while time remains.') }, { status: /Gemini|AI|rate.limit/i.test(error?.message || '') ? 503 : 500 });
  }
}
