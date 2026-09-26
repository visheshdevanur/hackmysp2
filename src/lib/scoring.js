export const rubricWeights = { correctness: 25, codeStructure: 20, documentation: 20, edgeCaseHandling: 20, innovation: 15 };
export function scoreReview(scores) {
  return Math.round(Object.entries(rubricWeights).reduce((sum, [key, weight]) => sum + Number(scores[key]) * weight, 0) / 5);
}
export function priCorrectness(credentials = []) {
  return credentials.length ? credentials.reduce((sum, item) => sum + (Number.isInteger(item.quizScore) ? item.quizScore : item.codeQuality * 10), 0) / credentials.length : 0;
}
export function calculatePRI({ correctness = 0, review = 0, timeliness = 0, learning = 0, skillMatch = 0 }) {
  const breakdown = { automatedCorrectness: correctness * .4, reviewerScore: review * .35, timeliness: timeliness * .1, learningVelocity: learning * .1, skillMatch: skillMatch * .05 };
  return { score: Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0)), breakdown };
}

export function calculateCredentialPRI(credential) {
  if (!credential?.isVerified) return { score: null, breakdown: null, status: 'Awaiting two independent reviews' };
  const result = calculatePRI({
    correctness: Number.isInteger(credential.quizScore) ? credential.quizScore : 0,
    review: Number(credential.reviewerScore) || 0,
    timeliness: Number(credential.timeliness) || 0,
    learning: Number(credential.learningVelocity) || 0,
    skillMatch: Number(credential.skillMatch) || 0,
  });
  return { ...result, status: 'Verified' };
}
