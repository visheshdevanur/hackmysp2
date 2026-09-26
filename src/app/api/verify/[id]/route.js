import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request,{params}) {
  const credential = await prisma.credential.findFirst({ where: { OR: [{ id: params.id }, { verificationCode: params.id }] }, include: { user: { select: { name: true, githubUsername: true } }, challenge: { select: { title: true, role: true, difficulty: true } }, reviews: { select: { calculatedScore: true, createdAt: true } } } });
  if (!credential) return NextResponse.json({ error: 'No credential matches that verification ID.' }, { status: 404 });
  return NextResponse.json({ id: credential.id, verificationCode: credential.verificationCode, isVerified: credential.isVerified, isFlagged: credential.isFlagged, createdAt: credential.createdAt, githubRepoUrl: credential.githubRepoUrl, commits: credential.commits, reviewerScore: credential.reviewerScore, priScore: credential.priScore, user: credential.user, challenge: credential.challenge, reviews: credential.reviews });
}
