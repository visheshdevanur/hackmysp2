import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { credentialForClient } from '@/lib/repo-quiz';

export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'recruiter') return NextResponse.json({ error: 'Recruiter account required.' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const minPri = Math.max(0, Math.min(100, Number(params.get('minPri') || 0)));
  const role = params.get('role');
  const query = params.get('q')?.trim();
  const users = await prisma.user.findMany({ where: { role: 'student', isVerified: true, priScore: { gte: minPri }, ...(query ? { OR: [{ name: { contains: query } }, { githubUsername: { contains: query } }] } : {}) }, include: { credentials: { where: { isVerified: true }, include: { challenge: true, workSession: { include: { recordings: { select: { segmentIndex: true } } } } } } }, orderBy: { priScore: 'desc' } });
  const candidates = users.filter(candidate => !role || candidate.credentials.some(c => c.challenge.role === role)).map(({ id, name, image, githubUsername, priScore, codePrint, credentials }) => ({ id, name, image, githubUsername, priScore, codePrint, credentials: credentials.map(({ workSession, challenge, ...credential }) => ({ ...credentialForClient({ ...credential, challenge: { id: challenge.id, title: challenge.title, role: challenge.role, difficulty: challenge.difficulty } }), challenge: { id: challenge.id, title: challenge.title, role: challenge.role, difficulty: challenge.difficulty }, workSession: challenge.creatorId === user.id && workSession ? { id: workSession.id, status: workSession.status, analysisJson: workSession.analysisJson, analysisModel: workSession.analysisModel, analysisError: workSession.analysisError, recordings: workSession.recordings } : null })) }));
  return NextResponse.json(candidates);
}
