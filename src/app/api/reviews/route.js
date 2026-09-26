import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { scoreReview, calculatePRI, priCorrectness } from '@/lib/scoring';
import { credentialForClient } from '@/lib/repo-quiz';
import { challengeForClient } from '@/lib/challenge-data';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'reviewer') return NextResponse.json({ error: 'Reviewer account required.' }, { status: 403 });
  const [pending, completed, integrityFlags] = await Promise.all([
    prisma.credential.findMany({ where: { isVerified: false, isFlagged: false, NOT: { userId: user.id }, reviews: { none: { userId: user.id } } }, include: { user: { select: { name: true, githubUsername: true } }, challenge: true, quizRecordings: { select: { segmentIndex: true } }, workSession: { include: { recordings: { select: { segmentIndex: true } } } } }, orderBy: { createdAt: 'asc' } }),
    prisma.review.findMany({ where: { userId: user.id }, include: { credential: { include: { challenge: true, user: { select: { name: true } }, quizRecordings: { select: { segmentIndex: true } }, workSession: { include: { recordings: { select: { segmentIndex: true } } } } } } }, orderBy: { createdAt: 'desc' } }),
    prisma.credential.findMany({ where: { quizAttemptStatus: 'failed' }, include: { user: { select: { name: true, githubUsername: true } }, challenge: true, quizRecordings: { select: { segmentIndex: true } } }, orderBy: { quizAttemptFinishedAt: 'desc' } }),
  ]);
  return NextResponse.json({
    pending: pending.map(({ user: submitter, challenge, ...credential }) => ({ ...credentialForClient({ ...credential, challenge }, { includeSpeaking: true, includeQuiz: true, viewerRole: 'reviewer' }), user: submitter })),
    completed: completed.map(review => ({ ...review, credential: { ...credentialForClient(review.credential, { includeSpeaking: true, includeQuiz: true, viewerRole: 'reviewer' }), challenge: challengeForClient(review.credential.challenge, 'reviewer'), user: review.credential.user } })),
    integrityFlags: integrityFlags.map(({ user: submitter, challenge, ...credential }) => ({ ...credentialForClient({ ...credential, challenge }, { includeSpeaking: true, includeQuiz: true, viewerRole: 'reviewer' }), user: submitter })),
  });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'reviewer') return NextResponse.json({ error: 'Reviewer account required.' }, { status: 403 });
  try {
    const body = await request.json();
    const dimensions = ['correctness','codeStructure','documentation','edgeCaseHandling','innovation'];
    if (dimensions.some(key => !Number.isInteger(body[key]) || body[key] < 1 || body[key] > 5)) return NextResponse.json({ error: 'Score every rubric dimension from 1 to 5.' }, { status: 400 });
    const credential = await prisma.credential.findUnique({ where: { id: body.credentialId }, include: { reviews: true } });
    if (!credential || credential.isFlagged) return NextResponse.json({ error: 'This submission is not available for review.' }, { status: 404 });
    if (credential.userId === user.id) return NextResponse.json({ error: 'You cannot review your own submission.' }, { status: 403 });
    const calculatedScore = scoreReview(body);
    const review = await prisma.review.create({ data: { userId: user.id, credentialId: credential.id, correctness: body.correctness, codeStructure: body.codeStructure, documentation: body.documentation, edgeCaseHandling: body.edgeCaseHandling, innovation: body.innovation, comment: String(body.comment || '').slice(0, 3000), calculatedScore } });
    const allReviews = [...credential.reviews, review];
    const reviewerScore = Math.round(allReviews.reduce((sum, r) => sum + r.calculatedScore, 0) / allReviews.length);
    const verified = allReviews.length >= 2;
    const updated = await prisma.credential.update({ where: { id: credential.id }, data: { reviewerScore, peerReviewAvg: reviewerScore / 20, isVerified: verified } });
    if (verified) {
      const verifiedCredentials = await prisma.credential.findMany({ where: { userId: credential.userId, isVerified: true } });
      const avg = (key) => verifiedCredentials.length ? verifiedCredentials.reduce((s, item) => s + item[key], 0) / verifiedCredentials.length : 0;
      const pri = calculatePRI({ correctness: priCorrectness(verifiedCredentials), review: avg('reviewerScore'), timeliness: avg('timeliness'), learning: avg('learningVelocity'), skillMatch: avg('skillMatch') });
      await prisma.user.update({ where: { id: credential.userId }, data: { priScore: pri.score, isVerified: true } });
    }
    return NextResponse.json({ review, credential: updated, verified }, { status: 201 });
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'You already reviewed this submission.' }, { status: 409 });
    console.error('Review submission failed', error);
    return NextResponse.json({ error: 'Could not save this review. Please try again.' }, { status: 400 });
  }
}
