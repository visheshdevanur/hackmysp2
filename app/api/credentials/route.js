import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { githubApiHeaders } from '@/lib/github-auth';
import { generateRepositoryQuiz, publicQuiz } from '@/lib/repo-quiz';

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Student account required.' }, { status: 403 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'AI quiz generation is not configured yet. Add GEMINI_API_KEY to the server .env file.' }, { status: 503 });
  try {
    const { challengeId, githubRepoUrl } = await request.json();
    const parsed = new URL(String(githubRepoUrl));
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com' || parts.length !== 2) {
      return NextResponse.json({ error: 'Enter a public GitHub repository URL in the format https://github.com/owner/repository.' }, { status: 400 });
    }
    const challenge = await prisma.challenge.findFirst({ where: { id: challengeId, isActive: true } });
    if (!challenge) return NextResponse.json({ error: 'This challenge is not available.' }, { status: 404 });
    const recentStart = new Date(Date.now() - 60 * 60 * 1000);
    const recentQuizzes = await prisma.credential.count({ where: { userId: user.id, aiModel: { not: null }, createdAt: { gte: recentStart } } });
    if (recentQuizzes >= 3) return NextResponse.json({ error: 'You have reached the limit of three repository quizzes per hour. Try again later.' }, { status: 429 });
    const owner = decodeURIComponent(parts[0]);
    const repositoryName = decodeURIComponent(parts[1].replace(/\.git$/, ''));
    const repo = `${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}`;
    const headers = await githubApiHeaders(user.id);
    const response = await fetch(`https://api.github.com/repos/${repo}`, { headers, cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? 'GitHub could not find this public repository.' : 'GitHub could not verify the repository right now. Try again shortly.' }, { status: 400 });
    const repository = await response.json();
    if (repository.private) return NextResponse.json({ error: 'The repository must be public so it can be analyzed.' }, { status: 400 });
    const latestCommitResponse = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(repository.default_branch)}`, { headers, cache: 'no-store' });
    if (!latestCommitResponse.ok) return NextResponse.json({ error: 'GitHub could not read the repository’s latest revision.' }, { status: 400 });
    const latestCommit = await latestCommitResponse.json();
    const existing = await prisma.credential.findFirst({ where: { userId: user.id, challengeId, repoCommitSha: latestCommit.sha } });
    if (existing) return NextResponse.json({ error: 'You have already submitted this challenge at this repository revision.' }, { status: 409 });
    const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=100`, { headers, cache: 'no-store' });
    const commits = commitsRes.ok ? await commitsRes.json() : [];
    const requirements = (() => { try { return JSON.parse(challenge.requirements); } catch { return []; } })();
    const quiz = await generateRepositoryQuiz({
      owner,
      repository: repository.name,
      challenge: { title: challenge.title, description: challenge.description, requirements: requirements.join(', ') },
      ref: latestCommit.sha,
      headers,
    });
    const daysTaken = 0;
    const credential = await prisma.credential.create({ data: { userId: user.id, challengeId, githubRepoUrl: repository.html_url, repoCommitSha: quiz.commitSha, aiModel: quiz.model, quizJson: JSON.stringify(quiz.questions), commits: commits.length, daysTaken, isVerified: false } });
    return NextResponse.json({
      credential: { id: credential.id, githubRepoUrl: credential.githubRepoUrl, commits: credential.commits, quizAvailable: true },
      quiz: { commitSha: quiz.commitSha, model: quiz.model, questions: publicQuiz(quiz.questions) },
      evidence: { repository: repository.full_name, commits: commits.length, createdAt: repository.created_at, latestCommitAt: commits[0]?.commit?.author?.date || null },
    }, { status: 201 });
  } catch (error) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'This repository revision was already submitted for this challenge.' }, { status: 409 });
    const message = error?.message || 'Could not prepare this repository quiz.';
    const status = /Gemini|AI quiz|AI did not|AI could not/i.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
