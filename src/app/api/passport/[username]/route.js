import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculatePRI, priCorrectness } from '@/lib/scoring';
import { calculateCredentialPRI } from '@/lib/scoring';
import { challengeScoreBreakdown } from '@/lib/challenge-scores';

export async function GET(_request,{params}) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ githubUsername: params.username }, { id: params.username }] },
    include: {
      credentials: {
        where: { isVerified: true },
        include: { challenge: { select: { title: true, role: true, difficulty: true } }, reviews: { select: { id: true } }, workSession: { select: { analysisJson: true } } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
  if (!user) return NextResponse.json({ error: 'No public CodePassport found for that GitHub username.' }, { status: 404 });
  const avg = key => user.credentials.length ? user.credentials.reduce((sum,c)=>sum+c[key],0)/user.credentials.length : 0;
  const pri = calculatePRI({ correctness: priCorrectness(user.credentials), review: avg('reviewerScore'), timeliness: avg('timeliness'), learning: avg('learningVelocity'), skillMatch: avg('skillMatch') });
  let codePrint = null;
  try { codePrint = user.codePrint ? JSON.parse(user.codePrint) : null; } catch {}
  return NextResponse.json({ name: user.name, image: user.image, githubUsername: user.githubUsername, role: user.role, isVerified: user.isVerified, pri: user.credentials.length ? pri.score : null, passportAnalysis: codePrint?.passportAnalysis || null, codePrint: codePrint ? { scores: codePrint.scores, languages: codePrint.languages, totalCommits: codePrint.totalCommits, reposAnalyzed: codePrint.reposAnalyzed, activeDays: codePrint.activeDays } : null, credentials: user.credentials.map(credential => ({ id: credential.id, challenge: credential.challenge, githubRepoUrl: credential.githubRepoUrl, commits: credential.commits, reviewerScore: credential.reviewerScore, priScore: credential.priScore, isVerified: credential.isVerified, scores: challengeScoreBreakdown(credential, credential.reviews.length), placementReadiness: calculateCredentialPRI(credential), codePrint: codePrint?.challengeEvidence?.find(item => item.credentialId === credential.id) || null })) });
}
