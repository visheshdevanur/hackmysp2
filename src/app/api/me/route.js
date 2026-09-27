import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculateCredentialPRI, calculateUserPRI } from '@/lib/scoring';
import { credentialForClient } from '@/lib/repo-quiz';
import { challengeScoreBreakdown } from '@/lib/challenge-scores';

export async function GET() {
  const sessionUser = await currentUser();
  if (!sessionUser) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      credentials: {
        include: { challenge: true, workSession: { select: { id: true, status: true, repoUrl: true, analysisJson: true, analysisError: true } }, quizRecordings: { select: { segmentIndex: true } }, reviews: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  const pri = calculateUserPRI(user.credentials);
  let codePrint = null;
  try { codePrint = user.codePrint ? JSON.parse(user.codePrint) : null; } catch { codePrint = null; }
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image, githubUsername: user.githubUsername, codePrint, isVerified: user.isVerified }, credentials: user.credentials.map(credential => ({ ...credentialForClient(credential, { includeSpeaking: true, includeQuiz: true, viewerRole: user.role }), scores: challengeScoreBreakdown(credential, credential.reviews.length), perChallengePRI: calculateCredentialPRI(credential) })), pri: { ...pri, tier: pri.score == null ? 'Not calculated yet' : pri.score >= 90 ? 'Exceptional' : pri.score >= 75 ? 'Proficient' : pri.score >= 60 ? 'Developing' : 'Building' } });
}
