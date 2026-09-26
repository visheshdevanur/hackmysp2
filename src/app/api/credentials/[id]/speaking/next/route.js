import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

function parse(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }

export async function POST(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Developer account required.' }, { status: 403 });
  const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, select: { speakingStatus: true, speakingStartedAt: true, speakingDataJson: true } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  if (credential.speakingStatus !== 'in_progress') return NextResponse.json({ error: 'This speaking round is not active.' }, { status: 409 });
  const now = new Date();
  if (now - credential.speakingStartedAt > 420_000) return NextResponse.json({ error: 'The seven-minute speaking time limit has expired.' }, { status: 409 });
  const data = parse(credential.speakingDataJson);
  if (data.question2StartedAt) return NextResponse.json({ error: 'The second question has already started.' }, { status: 409 });
  const questionTimings = [...(data.questionTimings || []), { questionIndex: 0, elapsedSeconds: Math.max(0, Math.floor((now - new Date(data.question1StartedAt)) / 1000)) }];
  const next = { ...data, questionTimings, question1FinishedAt: now.toISOString(), question2StartedAt: now.toISOString() };
  const saved = await prisma.credential.updateMany({ where: { id: params.id, userId: user.id, speakingStatus: 'in_progress', speakingDataJson: credential.speakingDataJson }, data: { speakingDataJson: JSON.stringify(next) } });
  if (!saved.count) return NextResponse.json({ error: 'The speaking attempt changed; reload to see its saved status.' }, { status: 409 });
  return NextResponse.json({ status: 'in_progress', questionIndex: 1, question2: data.question2, questionTimings });
}
