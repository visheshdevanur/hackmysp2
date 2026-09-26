import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { credentialForClient } from '@/lib/repo-quiz';
import { rankChallengeCredentials } from '@/lib/challenge-scores';

export async function GET(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'recruiter') return NextResponse.json({ error: 'Recruiter account required.' }, { status: 403 });
  const challenge = await prisma.challenge.findFirst({ where: { id: params.id, creatorId: user.id }, select: { id: true } });
  if (!challenge) return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });
  const rows = await prisma.credential.findMany({
    where: { challengeId: challenge.id },
    include: { user: { select: { name: true, githubUsername: true } }, challenge: true, reviews: { select: { id: true } }, quizRecordings: { select: { segmentIndex: true } }, workSession: { include: { recordings: { select: { segmentIndex: true }, orderBy: [{ segmentIndex: 'asc' }] } } } },
    orderBy: { createdAt: 'desc' },
  });
  const ranked = rankChallengeCredentials(rows);
  return NextResponse.json(ranked.map(row => ({ ...credentialForClient(row, { includeSpeaking: true, includeQuiz: true, viewerRole: 'recruiter' }), scores: row.scores, rank: row.rank, user: row.user, workSession: row.workSession ? {
    id: row.workSession.id,
    status: row.workSession.status,
    analysisJson: row.workSession.analysisJson,
    analysisModel: row.workSession.analysisModel,
    analysisError: row.workSession.analysisError,
    recordings: row.workSession.recordings,
  } : null })));
}
