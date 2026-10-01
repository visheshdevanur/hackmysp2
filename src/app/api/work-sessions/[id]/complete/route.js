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

function localQuestion(question, options, correctIndex, explanation, source) {
  return { question, options, correctIndex, explanation, evidence: { path: source } };
}

// A recording must never be stranded because GitHub or Gemini is unavailable.
// This assessment is deliberately labelled as local evidence, and does not claim
// to have watched the recording or inspected a repository that could not be read.
function buildLocalAssessment(session) {
  const config = getPriQuestionConfig(session.challenge);
  const requirements = parseChallengeJson(session.challenge.requirements, []).filter(Boolean);
  const topic = requirements[0] || session.challenge.role || 'the stated challenge requirements';
  const source = 'Challenge brief and saved session metadata';
  const library = [
    localQuestion(`Which requirement should be verified first before completing the ${session.challenge.title} challenge?`, [topic, 'A requirement unrelated to the challenge', 'The candidate’s personal preference', 'An assumption that was never documented'], 0, 'Start by verifying the explicit requirement in the challenge brief.', source),
    localQuestion('What is the strongest way to support a technical implementation claim?', ['Show the relevant implementation and explain how it meets the requirement', 'State that it works without evidence', 'Only describe the intended design', 'Skip testing and review'], 0, 'Implementation claims should be supported by observable code, tests, or recorded work.', source),
    localQuestion('When an external service is unavailable during a submission, what should the platform preserve?', ['The saved recording and repository submission', 'Only an error message', 'The browser tab state only', 'Nothing until the service returns'], 0, 'CodeVeritas preserves submitted evidence so the assessment can be completed or reviewed later.', source),
    localQuestion('Which practice best demonstrates sound engineering judgment?', ['Validate inputs and handle expected failures', 'Assume every request succeeds', 'Store secrets in client code', 'Skip error handling to reduce code'], 0, 'Validation and explicit failure handling make an implementation more reliable.', source),
    localQuestion('What should a developer explain when presenting a solution?', ['The trade-offs, evidence, and verification steps', 'Only the final screen', 'Only the project name', 'Only a list of tools'], 0, 'A useful technical explanation connects choices to evidence and verification.', source),
    localQuestion('How should a developer handle an uncertain result?', ['Mark it as provisional and explain the missing evidence', 'Present it as confirmed', 'Delete all related data', 'Ignore the uncertainty'], 0, 'Clear provisional status protects the integrity of the assessment.', source),
    localQuestion('What is a useful test after implementing a feature?', ['Test the normal flow and a failure or edge case', 'Test only the page title', 'Avoid testing until production', 'Change requirements after release'], 0, 'Both successful and failure paths provide useful implementation evidence.', source),
    localQuestion('What makes a review-ready submission easier to assess?', ['Clear repository structure and traceable evidence', 'Undocumented changes only', 'A private link with no access', 'Unrelated files without context'], 0, 'Reviewers need evidence they can inspect and trace to the challenge work.', source),
    localQuestion('What should happen before relying on an AI-generated suggestion?', ['Verify it against requirements and the implementation', 'Use it unchanged without review', 'Treat it as proof of correctness', 'Hide it from reviewers'], 0, 'AI assistance is useful when its output is checked against the work and requirements.', source),
    localQuestion('What is the purpose of a recorded challenge session?', ['Provide observable evidence of the development process', 'Replace all technical review', 'Collect unrelated personal information', 'Guarantee a hiring decision'], 0, 'The session is evidence for review and does not replace human judgment.', source),
  ];
  const evidence = Array.from({ length: config.evidenceQuestionCount }, (_, index) => ({ ...library[index % library.length], id: `local-evidence-${index + 1}` }));
  const job = Array.from({ length: config.jobQuestionCount }, (_, index) => ({ ...library[(index + 3) % library.length], id: `local-job-${index + 1}` }));
  const recruiter = config.recruiterQuestions.slice(0, config.recruiterQuestionCount).map((item, index) => ({
    id: `local-recruiter-${index + 1}`,
    question: String(item.question || '').trim(),
    options: Array.isArray(item.options) ? item.options.map(option => String(option).trim()) : [],
    correctIndex: item.correctIndex,
    explanation: String(item.explanation || 'Recruiter-provided answer key.').trim(),
    evidence: { path: 'Recruiter-authored question' },
  }));
  const questions = [...evidence, ...job, ...recruiter].map((question, index) => ({ ...question, id: `pri-${index + 1}` }));
  if (questions.length !== config.totalQuestions) throw new Error('The challenge PRI configuration is incomplete. Ask the recruiter to review the question allocation.');
  return {
    report: {
      summary: `A local evidence assessment was completed for ${session.challenge.title}. ${session.recordings.length} saved recording segment(s) are available for human review. GitHub or Gemini could not be reached during this attempt, so no unverified repository or video claims were added.`,
      strengths: ['The candidate submitted a recorded challenge session.', 'The repository URL and challenge evidence were preserved for review.'],
      improvements: ['Reconnect GitHub and Gemini later to enrich the assessment with repository and video analysis.', 'A reviewer should inspect the saved recording before making decisions.'],
      dimensions: [{ name: 'Submission evidence', score: 100, confidence: 'high', evidence: [] }, { name: 'Repository and video analysis', score: 0, confidence: 'low', evidence: [] }],
    },
    questions,
    model: 'local-evidence-fallback',
    commitSha: null,
  };
}

function isUpstreamFailure(error) {
  return /Gemini|GitHub|EACCES|ENETUNREACH|ECONNREFUSED|ENOTFOUND|rate limit|temporarily at capacity|connection/i.test(String(error?.message || ''));
}

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
    let assessment;
    let questions;
    let commits = [];
    try {
      assessment = await evaluateTimedSession({ session, repositoryUrl, headers });
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
      questions = await buildChallengeQuiz({ challenge: session.challenge, evidenceQuestions, owner, repository, ref: assessment.commitSha, headers });
      const commitsRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits?per_page=100`, { headers, cache: 'no-store' });
      commits = commitsRes.ok ? await commitsRes.json() : [];
    } catch (error) {
      if (!isUpstreamFailure(error)) throw error;
      assessment = buildLocalAssessment(session);
      questions = assessment.questions;
    }
    const credential = await prisma.credential.update({ where: { id: savedCredential.id }, data: {
      githubRepoUrl: assessment.repoFullName ? `https://github.com/${assessment.repoFullName}` : repositoryUrl.replace(/\.git$/i, ''), repoCommitSha: assessment.commitSha,
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
