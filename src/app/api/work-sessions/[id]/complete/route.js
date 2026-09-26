import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { githubApiHeaders } from '@/lib/github-auth';
import { evaluateTimedSession } from '@/lib/session-evaluation';
import { generateRepositoryQuiz, publicQuiz } from '@/lib/repo-quiz';
import { buildChallengeQuiz } from '@/lib/challenge-quiz';
import { getPriQuestionConfig, parseChallengeJson } from '@/lib/challenge-data';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Student account required.' }, { status: 403 });
  let session;
  let savedCredential = null;
  try {
    session = await prisma.workSession.findFirst({ where: { id: params.id, userId: user.id }, include: { challenge: true, recordings: { orderBy: [{ segmentIndex: 'asc' }, { chunkIndex: 'asc' }] } } });
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    if (session.status === 'submitted' && session.credentialId && session.analysisJson) {
      const existing = await prisma.credential.findUnique({ where: { id: session.credentialId } });
      if (existing?.quizJson) return NextResponse.json({ credential: { id: existing.id, quizAvailable: true }, analysis: JSON.parse(session.analysisJson), alreadySubmitted: true });
    }
    const { githubRepoUrl } = await request.json();
    const repositoryUrl = String(githubRepoUrl || '').trim();
    if (repositoryUrl.length > 500) return NextResponse.json({ error: 'Repository URL is too long.' }, { status: 400 });
    let parsedRepo;
    try { parsedRepo = new URL(repositoryUrl); } catch {}
    if (!parsedRepo || parsedRepo.protocol !== 'https:' || parsedRepo.hostname.toLowerCase() !== 'github.com' || parsedRepo.pathname.split('/').filter(Boolean).length < 2) return NextResponse.json({ error: 'Enter a public GitHub repository URL in the format https://github.com/owner/repository.' }, { status: 400 });
    if (!session.recordings.length) return NextResponse.json({ error: 'No session recording has been saved yet. Record some work before submitting.' }, { status: 400 });
    if (session.status === 'analyzing') return NextResponse.json({ error: 'This session is already being analyzed. Wait a moment and refresh My submissions.' }, { status: 409 });
    if (session.status === 'active') {
      const delta = session.lastHeartbeatAt ? Math.min(15, Math.max(0, Math.floor((Date.now() - new Date(session.lastHeartbeatAt).getTime()) / 1000))) : 0;
      session = await prisma.workSession.update({ where: { id: session.id }, data: { status: 'paused', elapsedSeconds: Math.min(session.durationSeconds, session.elapsedSeconds + delta), lastHeartbeatAt: null }, include: { challenge: true, recordings: { orderBy: [{ segmentIndex: 'asc' }, { chunkIndex: 'asc' }] } } });
    }

    // Persist the candidate's work before contacting GitHub or Gemini. Network errors must not lose a completed challenge.
    savedCredential = session.credentialId ? await prisma.credential.findUnique({ where: { id: session.credentialId } }) : null;
    if (!savedCredential) savedCredential = await prisma.credential.create({ data: {
      userId: user.id, challengeId: session.challengeId, githubRepoUrl: repositoryUrl.replace(/\.git$/i, ''),
      repoCommitSha: null, submissionMode: `recorded-session-${session.id}`, commits: 0, daysTaken: 0, isVerified: false,
    } });
    await prisma.workSession.update({ where: { id: session.id }, data: { status: 'analyzing', repoUrl: repositoryUrl, credentialId: savedCredential.id, analysisError: null } });

    const headers = await githubApiHeaders(user.id);
    const assessment = await evaluateTimedSession({ session, repositoryUrl, headers });
    const [owner, repository] = assessment.repoFullName.split('/');
    const questionConfig = getPriQuestionConfig(session.challenge);
    let evidenceQuestions = assessment.questions;
    if (evidenceQuestions.length < questionConfig.evidenceQuestionCount) {
      const missing = questionConfig.evidenceQuestionCount - evidenceQuestions.length;
      const repositorySupplement = await generateRepositoryQuiz({
        owner, repository, ref: assessment.commitSha, headers, questionCount: missing,
        challenge: { title: session.challenge.title, description: session.challenge.description, requirements: parseChallengeJson(session.challenge.requirements, []).join(', ') },
        avoidQuestionTexts: evidenceQuestions.map(question => question.question),
      });
      evidenceQuestions = [...evidenceQuestions, ...repositorySupplement.questions.map((question, index) => ({ ...question, id: `repository-supplement-${index + 1}` }))];
    }
    if (evidenceQuestions.length !== questionConfig.evidenceQuestionCount) throw new Error(`The recording and repository yielded ${evidenceQuestions.length} grounded evidence questions, but ${questionConfig.evidenceQuestionCount} are configured. Retry analysis or ask the recruiter to adjust the evidence question count.`);
    const questions = await buildChallengeQuiz({ challenge: session.challenge, evidenceQuestions, owner, repository, ref: assessment.commitSha, headers });
    const commitsRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits?per_page=100`, { headers, cache: 'no-store' });
    const commits = commitsRes.ok ? await commitsRes.json() : [];
    const credential = await prisma.credential.update({ where: { id: savedCredential.id }, data: {
      githubRepoUrl: `https://github.com/${assessment.repoFullName}`, repoCommitSha: assessment.commitSha,
      aiModel: assessment.model, quizJson: JSON.stringify(questions), commits: Array.isArray(commits) ? commits.length : 0,
    } });
    await prisma.workSession.update({ where: { id: session.id }, data: { status: 'submitted', credentialId: credential.id, repoCommitSha: assessment.commitSha, analysisJson: JSON.stringify(assessment.report), analysisModel: assessment.model, analysisError: null, completedAt: new Date() } });
    return NextResponse.json({ credential: { id: credential.id, quizAvailable: true }, quiz: { questions: publicQuiz(questions) }, analysis: assessment.report, model: assessment.model });
  } catch (error) {
    console.error('Timed session analysis failed', error);
    const message = error?.message || 'Could not analyze this session. Your saved recording is still available; retry later.';
    if (session?.id) await prisma.workSession.update({ where: { id: session.id }, data: savedCredential ? { status: 'submitted', credentialId: savedCredential.id, completedAt: new Date(), analysisError: message.slice(0, 800) } : { status: 'paused', analysisError: message.slice(0, 800) } }).catch(() => {});
    if (savedCredential) return NextResponse.json({ saved: true, analysisPending: true, credential: { id: savedCredential.id, quizAvailable: false }, error: `Your recording and repository submission are saved. AI analysis could not finish: ${message}` });
    const status = /Gemini|Google Gemini|GitHub could not|temporarily at capacity|rate limit|configured|connection available|EACCES/i.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
