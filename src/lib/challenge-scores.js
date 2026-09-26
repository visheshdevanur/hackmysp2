function parseJson(value, fallback = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function validScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
}

export function challengeScoreBreakdown(credential, reviewCount = 0) {
  const report = parseJson(credential?.workSession?.analysisJson, null);
  const dimensions = Array.isArray(report?.dimensions) ? report.dimensions.map(item => {
    const score = validScore(item.score);
    // Session reports requested a 0–100 scale, but early model responses sometimes returned 1–5 rubric values.
    return score !== null && score > 0 && score <= 5 ? score * 20 : score;
  }).filter(value => value !== null) : [];
  const speaking = credential?.speakingResult || parseJson(credential?.speakingResultJson, null);
  const quizFailed = credential?.quizAttemptStatus === 'failed';
  const quizComplete = quizFailed || credential?.quizAttemptStatus === 'completed' || Boolean(credential?.quizSubmittedAt);
  const speakingFailed = credential?.speakingStatus === 'failed';
  const speakingComplete = speakingFailed || ['completed', 'timed_out'].includes(credential?.speakingStatus);
  const scores = {
    share: dimensions.length ? Math.round(dimensions.reduce((sum, score) => sum + score, 0) / dimensions.length) : null,
    github: reviewCount > 0 ? validScore(credential?.reviewerScore) : null,
    pri: quizFailed ? 0 : quizComplete ? validScore(credential?.quizScore) : null,
    speaking: speakingFailed ? 0 : speakingComplete ? validScore(speaking?.overallScore) : null,
    githubReviews: reviewCount,
    statuses: {
      share: dimensions.length ? 'scored' : credential?.workSession?.analysisError ? 'analysis_failed' : 'pending',
      github: reviewCount >= 2 ? 'reviewed' : reviewCount === 1 ? 'one_review' : 'awaiting_reviews',
      pri: quizFailed ? 'failed' : quizComplete ? 'completed' : credential?.quizAttemptStatus === 'in_progress' ? 'in_progress' : 'pending',
      speaking: speakingFailed ? 'failed' : speakingComplete ? 'completed' : credential?.speakingStatus === 'analysis_failed' ? 'analysis_failed' : credential?.speakingStatus === 'in_progress' || credential?.speakingStatus === 'analyzing' ? 'in_progress' : 'pending',
    },
  };
  const available = Object.values(scores).filter(score => score !== null);
  return {
    ...scores,
    overall: available.length ? Math.round(available.reduce((sum, score) => sum + score, 0) / available.length) : null,
    completedComponents: available.length,
    totalComponents: 4,
    complete: available.length === 4,
  };
}

export function rankChallengeCredentials(rows) {
  return rows
    .map(row => ({ ...row, scores: challengeScoreBreakdown(row, row.reviews?.length || 0) }))
    .sort((a, b) => (b.scores.overall ?? -1) - (a.scores.overall ?? -1) || Number(b.scores.complete) - Number(a.scores.complete) || new Date(a.createdAt) - new Date(b.createdAt))
    .map(row => ({ ...row, rank: row.scores.overall == null ? null : rows.filter(item => {
      const itemScores = challengeScoreBreakdown(item, item.reviews?.length || 0);
      return itemScores.overall != null && itemScores.overall > row.scores.overall;
    }).length + 1 }));
}
