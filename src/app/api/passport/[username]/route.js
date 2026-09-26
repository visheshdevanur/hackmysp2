import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculatePRI, priCorrectness } from '@/lib/scoring';
import { credentialForClient } from '@/lib/repo-quiz';

export async function GET(_request,{params}) {
  const user = await prisma.user.findFirst({
    where: { githubUsername: params.username },
    include: {
      credentials: {
        where: { isVerified: true },
        include: { challenge: { select: { title: true, role: true, difficulty: true } }, reviews: { select: { calculatedScore: true } } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
  if (!user) return NextResponse.json({ error: 'No public CodePassport found for that GitHub username.' }, { status: 404 });
  const avg = key => user.credentials.length ? user.credentials.reduce((sum,c)=>sum+c[key],0)/user.credentials.length : 0;
  const pri = calculatePRI({ correctness: priCorrectness(user.credentials), review: avg('reviewerScore'), timeliness: avg('timeliness'), learning: avg('learningVelocity'), skillMatch: avg('skillMatch') });
  let codePrint = null;
  try { codePrint = user.codePrint ? JSON.parse(user.codePrint) : null; } catch {}
  return NextResponse.json({ name: user.name, image: user.image, githubUsername: user.githubUsername, role: user.role, isVerified: user.isVerified, pri: pri.score, codePrint, credentials: user.credentials.map(credentialForClient) });
}
