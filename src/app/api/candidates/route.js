import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { credentialForClient } from '@/lib/repo-quiz';
import { challengeScoreBreakdown } from '@/lib/challenge-scores';

export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'recruiter') return NextResponse.json({ error: 'Recruiter account required.' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const minPri = Math.max(0, Math.min(100, Number(params.get('minPri') || 0)));
  const role = params.get('role');
  const query = params.get('q')?.trim();
  const users = await prisma.user.findMany({ where: { role: 'student', ...(minPri > 0 ? { priScore: { gte: minPri } } : {}), ...(role ? { credentials: { some: { challenge: { role } } } } : {}), ...(query ? { OR: [{ name: { contains: query } }, { githubUsername: { contains: query } }] } : {}) }, include: { _count: { select: { credentials: true } }, credentials: { where: { isVerified: true }, include: { reviews: { select: { id: true } }, challenge: true, workSession: { include: { recordings: { select: { segmentIndex: true } } } } } } }, orderBy: [{ priScore: 'desc' }, { name: 'asc' }] });
  const candidates = users.map(({ id, name, image, githubUsername, priScore, isVerified, codePrint, credentials, _count }) => ({ id, name, image, githubUsername, priScore, isVerified, totalSubmissions: _count.credentials, verifiedCredentialCount: credentials.length, codePrint: (() => { try { const parsed = codePrint ? JSON.parse(codePrint) : null; return parsed ? { scores: parsed.scores || null, languages: parsed.languages || [], totalCommits: parsed.totalCommits || 0, reposAnalyzed: parsed.reposAnalyzed || 0, activeDays: parsed.activeDays || 0 } : null; } catch { return null; } })(), credentials: credentials.map(({ workSession, challenge, reviews, ...credential }) => {
    const visible = credentialForClient({ ...credential, challenge: { id: challenge.id, title: challenge.title, role: challenge.role, difficulty: challenge.difficulty } }, { includeSpeaking: true, includeQuiz: true, viewerRole: 'recruiter' });
    return { ...visible, scores: challengeScoreBreakdown(visible, reviews.length), challenge: { id: challenge.id, title: challenge.title, role: challenge.role, difficulty: challenge.difficulty }, workSession: challenge.creatorId === user.id && workSession ? { id: workSession.id, status: workSession.status, analysisJson: workSession.analysisJson, analysisModel: workSession.analysisModel, analysisError: workSession.analysisError, recordings: workSession.recordings } : null };
  }) }));
  return NextResponse.json(candidates);
}
