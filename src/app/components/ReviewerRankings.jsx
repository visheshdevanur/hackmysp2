'use client';
import { useEffect, useState } from 'react';
import ChallengeScorecard from './ChallengeScorecard';

const displayName = user => user?.name || (user?.githubUsername ? `@${user.githubUsername}` : 'Developer');

export default function ReviewerRankings({ role }) {
  const [groups, setGroups] = useState([]);
  useEffect(() => {
    if (role !== 'reviewer') return;
    fetch('/api/reviews').then(response => response.json()).then(data => setGroups(data.leaderboards || [])).catch(() => {});
  }, [role]);
  if (role !== 'reviewer' || !groups.length) return null;

  return <section className="real-panel challenge-rankings">
    <h2>Challenge rankings</h2>
    <p className="real-muted">Each job challenge has its own leaderboard, ordered by overall job score from highest to lowest. Incomplete scores are provisional; equal scores use submission time.</p>
    {groups.map(group => {
      const scored = group.entries.filter(entry => entry.rank).length;
      return <details key={group.challenge.id}>
        <summary>
          <span><b>{group.challenge.title}</b><small>{group.challenge.role || 'Role not specified'} · {group.challenge.difficulty || 'Difficulty not specified'}</small></span>
          <span>{scored} of {group.entries.length} ranked</span>
        </summary>
        {group.entries.map(entry => <div className="challenge-rank-row" key={entry.id}>
          <b>{entry.rank ? `#${entry.rank}` : '—'}</b>
          <span className="challenge-rank-candidate"><strong>{displayName(entry.user)}</strong>{entry.user?.githubUsername && entry.user?.name && <small>@{entry.user.githubUsername}</small>}</span>
          <ChallengeScorecard scores={entry.scores} rank={entry.rank}/>
        </div>)}
      </details>;
    })}
  </section>;
}
