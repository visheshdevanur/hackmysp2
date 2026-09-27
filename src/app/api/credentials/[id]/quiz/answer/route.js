import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculateUserPRI } from '@/lib/scoring';

function parseJson(value, fallback) { try { return JSON.parse(value || ''); } catch { return fallback; } }
function questionsInAttemptOrder(questions, attempt) {
  return Array.isArray(attempt.questionOrder) && attempt.questionOrder.length === questions.length
    ? attempt.questionOrder.map(index => questions[index]).filter(Boolean)
    : questions;
}
function result(questions, answers, score, attemptData, status) {
  const correctCount = questions.reduce((count, item) => count + (answers[item.id] === item.correctIndex ? 1 : 0), 0);
  return { status, completed: status === 'completed', score, correctCount, total: questions.length, questionTimings: attemptData.questionTimings, integrityEvents: attemptData.integrityEvents, questions: questions.map(item => ({ ...item, selectedIndex: answers[item.id] })) };
}

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Developer account required.' }, { status: 403 });
  try {
    const body = await request.json();
    const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, userId: true, isVerified: true, quizJson: true, quizAnswers: true, quizScore: true, quizAttemptStatus: true, quizAttemptDataJson: true, quizSubmittedAt: true } });
    if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
    if (credential.quizAttemptStatus !== 'in_progress' || credential.quizSubmittedAt) return NextResponse.json({ error: credential.quizAttemptStatus === 'failed' ? 'This quiz attempt failed and is locked.' : 'Start an active recorded quiz before answering.' }, { status: 409 });
    const questions = questionsInAttemptOrder(parseJson(credential.quizJson, []), parseJson(credential.quizAttemptDataJson, {}));
    const attempt = parseJson(credential.quizAttemptDataJson, {});
    const questionIndex = Number(body.questionIndex);
    const answerIndex = Number(body.answerIndex);
    if (!Number.isInteger(questionIndex) || questionIndex !== attempt.currentQuestionIndex || !questions[questionIndex] || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= questions[questionIndex].options.length) return NextResponse.json({ error: 'Answer the current question before moving on.' }, { status: 400 });
    const now = new Date();
    const started = new Date(attempt.currentQuestionStartedAt || now).getTime();
    const elapsedSeconds = Math.max(0, Math.min(86_400, Math.floor((now.getTime() - started) / 1000)));
    const answers = parseJson(credential.quizAnswers, {});
    answers[questions[questionIndex].id] = answerIndex;
    const timings = [...(attempt.questionTimings || []), { questionIndex, questionId: questions[questionIndex].id, elapsedSeconds, answeredAt: now.toISOString() }];
    const complete = questionIndex === questions.length - 1;
    const nextAttempt = { ...attempt, currentQuestionIndex: complete ? questionIndex : questionIndex + 1, currentQuestionStartedAt: complete ? null : now.toISOString(), questionTimings: timings };
    const allQuestions = parseJson(credential.quizJson, []);
    const correctCount = allQuestions.reduce((count, item) => count + (answers[item.id] === item.correctIndex ? 1 : 0), 0);
    const score = Math.round(correctCount / questions.length * 100);
    const saved = await prisma.credential.updateMany({
      where: { id: credential.id, userId: user.id, quizAttemptStatus: 'in_progress', quizAttemptDataJson: credential.quizAttemptDataJson },
      data: { quizAnswers: JSON.stringify(answers), quizAttemptDataJson: JSON.stringify(nextAttempt), ...(complete ? { quizAttemptStatus: 'completed', quizAttemptFinishedAt: now, quizSubmittedAt: now, quizScore: score } : {}) },
    });
    if (saved.count !== 1) return NextResponse.json({ error: 'The quiz attempt changed. Refresh to see its saved status.' }, { status: 409 });
    if (complete) {
      const credentials = await prisma.credential.findMany({ where: { userId: credential.userId } });
      const pri = calculateUserPRI(credentials);
      if (pri.score != null) await prisma.user.update({ where: { id: credential.userId }, data: { priScore: pri.score } });
    }
    return NextResponse.json(complete ? result(questions, answers, score, nextAttempt, 'completed') : { status: 'in_progress', currentQuestionIndex: questionIndex + 1, questionTimings: timings });
  } catch (error) {
    console.error('PRI answer could not be saved', error);
    return NextResponse.json({ error: 'Could not save this answer.' }, { status: 500 });
  }
}
