import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

function parseJson(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Developer account required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const allowed = new Set(['tab_hidden', 'capture_interrupted', 'attempt_reloaded']);
  const reason = allowed.has(body.reason) ? body.reason : 'tab_hidden';
  const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, quizAttemptStatus: true, quizAttemptDataJson: true, quizAnswers: true, quizJson: true } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  if (credential.quizAttemptStatus === 'failed') return NextResponse.json({ status: 'failed', reason });
  if (credential.quizAttemptStatus !== 'in_progress') return NextResponse.json({ error: 'No active PRI quiz attempt exists.' }, { status: 409 });
  const now = new Date();
  const attempt = parseJson(credential.quizAttemptDataJson);
  const event = { type: reason, occurredAt: now.toISOString(), questionIndex: attempt.currentQuestionIndex ?? null };
  const nextAttempt = { ...attempt, integrityEvents: [...(attempt.integrityEvents || []), event] };
  const count = await prisma.credential.updateMany({ where: { id: credential.id, userId: user.id, quizAttemptStatus: 'in_progress', quizAttemptDataJson: credential.quizAttemptDataJson }, data: { quizAttemptStatus: 'failed', quizAttemptFinishedAt: now, quizSubmittedAt: now, quizScore: 0, quizAttemptDataJson: JSON.stringify(nextAttempt) } });
  if (count.count !== 1) return NextResponse.json({ error: 'The quiz attempt already changed.' }, { status: 409 });
  return NextResponse.json({ status: 'failed', reason, occurredAt: now.toISOString(), questionIndex: event.questionIndex });
}
