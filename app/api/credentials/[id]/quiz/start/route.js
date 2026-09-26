import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

function questionsOf(credential) { try { return JSON.parse(credential.quizJson || '[]'); } catch { return []; } }
function shuffledIndices(length) {
  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  if (order.length > 1 && order.every((questionIndex, index) => questionIndex === index)) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Developer account required.' }, { status: 403 });
  const { consent } = await request.json().catch(() => ({}));
  if (consent !== true) return NextResponse.json({ error: 'Consent is required before the recorded quiz starts.' }, { status: 400 });
  const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, quizJson: true, quizSubmittedAt: true, quizAttemptStatus: true } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  if (!questionsOf(credential).length) return NextResponse.json({ error: 'No PRI quiz is available.' }, { status: 404 });
  if (credential.quizSubmittedAt || ['completed', 'failed'].includes(credential.quizAttemptStatus)) return NextResponse.json({ error: credential.quizAttemptStatus === 'failed' ? 'This quiz attempt failed and is locked.' : 'This PRI quiz is already completed.' }, { status: 409 });
  if (credential.quizAttemptStatus === 'in_progress') return NextResponse.json({ error: 'A quiz attempt is already in progress. It cannot be restarted or resumed.' }, { status: 409 });
  const startedAt = new Date();
  const questions = questionsOf(credential);
  const questionOrder = shuffledIndices(questions.length);
  const attemptData = { questionOrder, currentQuestionIndex: 0, currentQuestionStartedAt: startedAt.toISOString(), questionTimings: [], integrityEvents: [] };
  const updated = await prisma.credential.updateMany({ where: { id: credential.id, userId: user.id, quizAttemptStatus: 'ready', quizSubmittedAt: null }, data: { quizAttemptStatus: 'in_progress', quizAttemptStartedAt: startedAt, quizAttemptFinishedAt: null, quizAttemptDataJson: JSON.stringify(attemptData) } });
  if (updated.count !== 1) return NextResponse.json({ error: 'This quiz attempt has already started.' }, { status: 409 });
  return NextResponse.json({ status: 'in_progress', currentQuestionIndex: 0, questionCount: questions.length, questions: questionOrder.map(index => { const { id, question, options } = questions[index]; return { id, question, options }; }), startedAt });
}
