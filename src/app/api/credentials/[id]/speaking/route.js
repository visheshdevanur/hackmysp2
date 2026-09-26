import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

function parse(value, fallback = {}) { try { return JSON.parse(value || ''); } catch { return fallback; } }

export async function GET(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, select: { quizAttemptStatus: true, speakingStatus: true, speakingStartedAt: true, speakingFinishedAt: true, speakingDataJson: true, speakingResultJson: true } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  if (credential.quizAttemptStatus !== 'completed') return NextResponse.json({ error: 'Complete the PRI quiz before starting the speaking round.' }, { status: 409 });
  if (credential.speakingStatus === 'in_progress') {
    const data = parse(credential.speakingDataJson);
    const event = { type: 'attempt_reloaded', occurredAt: new Date().toISOString() };
    const count = await prisma.credential.updateMany({ where: { id: params.id, userId: user.id, speakingStatus: 'in_progress' }, data: { speakingStatus: 'failed', speakingFinishedAt: new Date(), speakingDataJson: JSON.stringify({ ...data, integrityEvents: [...(data.integrityEvents || []), event] }) } });
    if (count.count) return NextResponse.json({ status: 'failed', startedAt: credential.speakingStartedAt, data: { ...data, integrityEvents: [...(data.integrityEvents || []), event] }, error: 'The speaking attempt was locked because the page was reloaded.' });
  }
  return NextResponse.json({ status: credential.speakingStatus, startedAt: credential.speakingStartedAt, finishedAt: credential.speakingFinishedAt, data: parse(credential.speakingDataJson), result: parse(credential.speakingResultJson, null) });
}
