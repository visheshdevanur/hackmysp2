'use client';
import ScoreRing from './ScoreRing';

const labels = [['share', 'Share/session'], ['github', 'GitHub/review'], ['pri', 'PRI quiz'], ['speaking', 'Speaking']];
function scoreLabel(scores, key) {
  const status = scores.statuses?.[key];
  if (status === 'failed') return 'Failed · 0/100';
  if (scores[key] != null) return key === 'github' ? `${scores.githubReviews}/2 independent reviews` : null;
  if (key === 'github') return scores.githubReviews === 1 ? '1 of 2 reviews received' : 'Awaiting 2 independent reviews';
  if (status === 'analysis_failed') return 'Analysis failed · retry needed';
  if (status === 'in_progress') return 'In progress';
  return 'Not completed';
}

export default function ChallengeScorecard({ scores, rank }) {
  if (!scores) return null;
  return <section className="challenge-scorecard"><div className="challenge-score-head"><b>Challenge scores</b>{scores.overall != null ? <span className="score-ring-wrap"><ScoreRing value={scores.overall} label={scores.complete ? 'Final overall' : 'Provisional overall'} size={66}/></span> : <span>Overall pending assessment scores</span>}{rank ? <em>Rank #{rank}{scores.complete ? '' : ' · provisional'}</em> : null}</div><div className="challenge-score-grid">{labels.map(([key, label]) => <div key={key}><small>{label}</small><ScoreRing value={scores[key]} label={key==='github'&&scores[key]!=null?`${scores.githubReviews}/2 reviews`:null} size={62}/>{scoreLabel(scores, key)&&<b>{scoreLabel(scores, key)}</b>}</div>)}</div><p>{scores.complete ? 'Equal weighting across all four completed assessments.' : `${scores.completedComponents}/4 assessment scores available. The overall score is provisional until all four are scored; peer review requires two independent reviewers.`}</p></section>;
}
