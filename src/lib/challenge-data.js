export function parseChallengeJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

export function getChallengeJobDetails(challenge) {
  return parseChallengeJson(challenge?.jobDetailsJson, {});
}

export function getPriQuestionConfig(challenge) {
  const saved = parseChallengeJson(challenge?.priQuestionConfigJson, {});
  return {
    totalQuestions: Number.isInteger(saved.totalQuestions) ? saved.totalQuestions : 8,
    evidenceQuestionCount: Number.isInteger(saved.evidenceQuestionCount) ? saved.evidenceQuestionCount : 8,
    jobQuestionCount: Number.isInteger(saved.jobQuestionCount) ? saved.jobQuestionCount : 0,
    recruiterQuestionCount: Number.isInteger(saved.recruiterQuestionCount) ? saved.recruiterQuestionCount : 0,
    recruiterQuestions: Array.isArray(saved.recruiterQuestions) ? saved.recruiterQuestions : [],
  };
}

export function challengeForClient(challenge, viewerRole = 'student') {
  if (!challenge) return challenge;
  const { jobDetailsJson, priQuestionConfigJson, requirements, ...visible } = challenge;
  const config = getPriQuestionConfig(challenge);
  const priQuestionConfig = {
    totalQuestions: config.totalQuestions,
    evidenceQuestionCount: config.evidenceQuestionCount,
    jobQuestionCount: config.jobQuestionCount,
    recruiterQuestionCount: config.recruiterQuestionCount,
    ...(viewerRole === 'student' ? {} : { recruiterQuestions: config.recruiterQuestions }),
  };
  return {
    ...visible,
    requirements: parseChallengeJson(requirements, []),
    jobDetails: getChallengeJobDetails(challenge),
    priQuestionConfig,
  };
}
