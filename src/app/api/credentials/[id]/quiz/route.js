import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

function parse(value, fallback) { try { return JSON.parse(value || ''); } catch { return fallback; } }

export async function GET(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, select: { quizJson: true, quizScore: true, quizAnswers: true, quizSubmittedAt: true, quizAttemptStatus: true, quizAttemptDataJson: true } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  const questions = parse(credential.quizJson, []);
  if (!questions.length) return NextResponse.json({ error: 'No PRI quiz is available for this submission.' }, { status: 404 });
  const attempt = parse(credential.quizAttemptDataJson, {});
  const orderedQuestions = Array.isArray(attempt.questionOrder) && attempt.questionOrder.length === questions.length ? attempt.questionOrder.map(index => questions[index]).filter(Boolean) : questions;
  const result = { status: credential.quizAttemptStatus || (credential.quizSubmittedAt ? 'completed' : 'ready'), currentQuestionIndex: attempt.currentQuestionIndex || 0, currentQuestionStartedAt: attempt.currentQuestionStartedAt || null, questionTimings: attempt.questionTimings || [], integrityEvents: attempt.integrityEvents || [], failedReason: attempt.integrityEvents?.at(-1)?.type || null };
  if (result.status === 'completed') {
    const answers = parse(credential.quizAnswers, {});
    const correctCount = questions.reduce((count, item) => count + (answers[item.id] === item.correctIndex ? 1 : 0), 0);
    return NextResponse.json({ ...result, completed: true, score: credential.quizScore || 0, correctCount, total: orderedQuestions.length, questions: orderedQuestions.map(item => ({ ...item, selectedIndex: answers[item.id] })) });
  }
  return NextResponse.json({ ...result, completed: false, questions: orderedQuestions.map(({ id, question, options }) => ({ id, question, options })) });
}

export async function POST() {
  return NextResponse.json({ error: 'PRI quizzes must be completed one question at a time through a monitored attempt.' }, { status: 410 });
}
