'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SessionEvidence from './SessionEvidence';
import QuizAttemptEvidence from './QuizAttemptEvidence';
import GitHubTimeline from './GitHubTimeline';
import ChallengeScorecard from './ChallengeScorecard';
import CandidateRadar from './CandidateRadar';
import ScoreRing from './ScoreRing';
import { CalendarClock, Sparkles, UserRoundCheck } from 'lucide-react';

export default function RecruiterSubmissionsPanel({ challengeId }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteData, setInviteData] = useState({});
  const [inviteBusy, setInviteBusy] = useState(false);
  const [error, setError] = useState('');
  const [compareError, setCompareError] = useState('');
  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (rows) return;
    try {
      const response = await fetch(`/api/challenges/${encodeURIComponent(challengeId)}/submissions`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load submissions.');
      setRows(data);
    } catch (caught) { setError(caught.message); }
  }
  function candidateLabel(row) { return row.user.name || row.user.githubUsername || 'Developer'; }
  const selectedRows = rows?.filter(row => checked.includes(row.id)) || [];
  const canCompare = selectedRows.length === 2 && new Set(selectedRows.map(row => row.userId)).size === 2;
  async function compare() {
    if (!canCompare) { setCompareError('Select submissions from two different developers.'); return; }
    setCompareBusy(true); setComparison(null); setCompareError('');
    try { const response = await fetch(`/api/challenges/${encodeURIComponent(challengeId)}/compare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentialIds: selectedRows.map(row => row.id) }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not compare candidates.'); setComparison(result); }
    catch (caught) { setCompareError(caught.message); } finally { setCompareBusy(false); }
  }
  function updateInvite(id, key, value) { setInviteData(previous => ({ ...previous, [id]: { durationMinutes: 30, meetingLink: '', ...previous[id], [key]: value } })); }
  async function sendInvites() {
    setInviteBusy(true); setError('');
    try {
      const invitations = checked.map(id => ({ credentialId: id, ...inviteData[id], scheduledAt: new Date(inviteData[id].scheduledAt).toISOString() }));
      const response = await fetch('/api/interview-invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId, invitations }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not send invitations.');
      setInviteOpen(false); setInviteData({}); setChecked([]); setError(`${result.created} interview invitation${result.created === 1 ? '' : 's'} added to candidate dashboards.`);
    } catch (caught) { setError(caught.message); } finally { setInviteBusy(false); }
  }
  return <section className="recruiter-submissions"><button className="button secondary" onClick={toggle}>{open ? 'Hide submissions' : 'View submissions and recordings'}</button>
    {open && (error ? <p className="auth-error">{error}</p> : !rows ? <p className="real-muted">Loading ranked submissions…</p> : rows.length ? <>
      <p className="real-muted">Ranked within this job by overall job score: the equal-weight average of available assessment scores, highest first. Incomplete scores remain provisional; equal scores are ordered by submission time.</p>
      <div className="candidate-bulk-actions"><span>{checked.length} selected{checked.length === 2 && !canCompare ? ' · choose two different developers to compare' : ''}</span><button className="button secondary" disabled={!canCompare||compareBusy} onClick={compare}><Sparkles size={14}/>{compareBusy?'Comparing…':'Compare two developers'}</button><button className="button secondary" disabled={!checked.length} onClick={()=>setInviteOpen(v=>!v)}><CalendarClock size={14}/>Invite to next round</button></div>
      {compareError && <p className="auth-error" role="alert">{compareError}</p>}
      {comparison && <section className="candidate-comparison"><h3><Sparkles size={15}/> AI evidence comparison</h3><p>{comparison.summary}</p><div className="candidate-comparison-grid">{comparison.candidates?.map((candidate,index)=><article key={candidate.candidateKey || `${candidate.name}-${index}`}><b>{candidate.name}</b><div className="compare-score-list">{[['Share/session',candidate.scores?.share],['GitHub/review',candidate.scores?.github],['PRI',candidate.scores?.pri],['Speaking',candidate.scores?.speaking],['Overall',candidate.scores?.overall]].map(([label,score])=><span key={label}><ScoreRing value={score} label={label} size={58}/></span>)}</div><strong>Strengths</strong><ul>{candidate.strengths?.map((text,i)=><li key={i}>{text}</li>)}</ul><strong>Gaps / missing evidence</strong><ul>{candidate.gaps?.map((text,i)=><li key={i}>{text}</li>)}</ul><strong>Interview probes</strong><ul>{candidate.followUp?.map((text,i)=><li key={i}>{text}</li>)}</ul></article>)}</div><small>AI summary uses available challenge, repository review, PRI and speaking evidence; it supports human review.</small></section>}
      {inviteOpen && <section className="candidate-invite-form"><h3><CalendarClock size={15}/> Schedule interview invitations</h3><p>Set a separate time and duration for each selected developer. Invitations appear on their dashboard.</p>{rows.filter(row=>checked.includes(row.id)).map(row=><article key={row.id}><b>{candidateLabel(row)}</b><label>Meeting date and time<input type="datetime-local" value={inviteData[row.id]?.scheduledAt||''} onChange={e=>updateInvite(row.id,'scheduledAt',e.target.value)}/></label><label>Time allotment (minutes)<input type="number" min="5" max="240" value={inviteData[row.id]?.durationMinutes??30} onChange={e=>updateInvite(row.id,'durationMinutes',e.target.value)}/></label><label>Meeting link<input type="url" placeholder="https://meet.google.com/..." value={inviteData[row.id]?.meetingLink||''} onChange={e=>updateInvite(row.id,'meetingLink',e.target.value)}/></label></article>)}<button className="button" disabled={inviteBusy||checked.some(id=>!inviteData[id]?.scheduledAt||!inviteData[id]?.meetingLink)} onClick={sendInvites}>{inviteBusy?'Sending…':'Send invitations'} <UserRoundCheck size={14}/></button></section>}
      {rows.map(row => <article className="recruiter-submission ranked-candidate" key={row.id}>
        <label className="candidate-compare-check"><input type="checkbox" checked={checked.includes(row.id)} onChange={event=>{setCompareError('');setComparison(null);setChecked(previous=>event.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}}/> Select for compare / interview</label>
        <button className="ranked-candidate-toggle" aria-expanded={selectedId === row.id} onClick={() => setSelectedId(selectedId === row.id ? null : row.id)}>
          {selectedId === row.id ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<span>{row.rank ? `#${row.rank}` : '—'}</span><b>{row.user.name || row.user.githubUsername || 'Developer'}{row.quizAttemptStatus === 'failed' && <em className="quiz-failed"> · PRI failed</em>}</b><ScoreRing value={row.scores.overall} label={row.scores.complete?'Overall score':'Provisional overall'} size={58}/>
        </button>
        {selectedId === row.id && <div className="ranked-candidate-detail">
          <p><a href={row.githubRepoUrl} target="_blank" rel="noreferrer">Open submitted repository</a> · {row.workSession ? 'Recorded solo challenge' : 'Repository-only submission'}</p>
          <CandidateRadar scores={row.scores}/><ChallengeScorecard scores={row.scores} rank={row.rank}/>
          <GitHubTimeline credentialId={row.id} repoUrl={row.githubRepoUrl} defaultOpen/>
          <SessionEvidence session={row.workSession}/>
          <QuizAttemptEvidence credential={row}/>
        </div>}
      </article>)}
    </> : <p className="real-muted">No submissions yet. Recruiters do not join developer sessions.</p>)}
  </section>;
}
