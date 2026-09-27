'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BadgeCheck, Bell, BookOpen, CheckCircle2, ChevronDown, CircleHelp, Code2, FileCheck2, Fingerprint, Github, Layers3, Search, ShieldCheck, Sparkles, Target, X } from 'lucide-react';
import ScoreRing from './ScoreRing';

const repoName = value => {
  try { return new URL(value).pathname.split('/').filter(Boolean).slice(-2).join('/'); }
  catch { return value || 'Repository not linked'; }
};
const dateLabel = value => {
  if (!value) return 'Recently';
  const day = new Date(value).toISOString().slice(0, 10);
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, date)));
};
const assessmentCount = credential => Math.max(0, Math.min(4, Number(credential?.scores?.completedComponents) || 0));

export default function StudentDashboard({ user, data, challenges = [], setPage, onSignOut }) {
  const [query, setQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const credentials = data?.credentials || [];
  const verified = credentials.filter(item => item.isVerified);
  const activeChallenges = challenges.filter(item => item.isActive !== false);
  const progress = credentials.length ? Math.round(credentials.reduce((sum, item) => sum + assessmentCount(item), 0) / (credentials.length * 4) * 100) : 0;
  const verificationProgress = credentials.length ? Math.round(verified.length / credentials.length * 100) : 0;
  const outstanding = credentials.filter(item => !item.isVerified);
  const searchTerm = query.trim().toLowerCase();
  const visibleChallenges = useMemo(() => activeChallenges.filter(item => !searchTerm || `${item.title} ${item.role} ${(item.requirements || []).join(' ')}`.toLowerCase().includes(searchTerm)), [activeChallenges, searchTerm]);
  const visibleCredentials = useMemo(() => credentials.filter(item => !searchTerm || `${item.challenge?.title || ''} ${item.githubRepoUrl || ''} ${user?.githubUsername || ''}`.toLowerCase().includes(searchTerm)), [credentials, searchTerm, user?.githubUsername]);

  useEffect(() => {
    const handleShortcut = event => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        document.getElementById('student-dashboard-search')?.focus();
      }
      if (event.key === 'Escape') { setNotificationsOpen(false); setProfileOpen(false); }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const activities = useMemo(() => {
    const events = [];
    credentials.forEach(item => {
      events.push({ id: `${item.id}-submission`, icon: FileCheck2, title: 'Repository submitted', detail: repoName(item.githubRepoUrl), date: item.createdAt, page: 'submissions', tone: 'blue' });
      if (item.quizAttemptStatus === 'completed') events.push({ id: `${item.id}-quiz`, icon: Target, title: 'PRI quiz completed', detail: `Score: ${item.quizScore ?? '—'}%`, date: item.quizSubmittedAt || item.updatedAt, page: 'submissions', tone: 'violet' });
      if (item.isVerified) events.push({ id: `${item.id}-verified`, icon: BadgeCheck, title: 'Review passed', detail: 'Credential verified and issued', date: item.updatedAt, page: 'passport', tone: 'green' });
    });
    activeChallenges.forEach(item => events.push({ id: `${item.id}-challenge`, icon: Sparkles, title: 'Challenge available', detail: item.title, date: item.createdAt, page: 'challenges', tone: 'amber' }));
    return events.filter(item => item.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  }, [credentials, activeChallenges]);

  const go = page => { setNotificationsOpen(false); setProfileOpen(false); setPage(page); };
  const initials = (user?.name || user?.githubUsername || 'Developer').trim().slice(0, 1).toUpperCase();
  const newOrOpenCount = outstanding.length;

  return <div className="student-dashboard">
    <div className="sd-toolbar">
      <label className="sd-search"><Search size={17}/><input id="student-dashboard-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search challenges, submissions, or candidates…" aria-label="Search dashboard"/><kbd>/</kbd>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}</label>
      <div className="sd-toolbar-actions">
        <div className="sd-menu-wrap"><button type="button" className="sd-icon-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}><Bell size={18}/>{newOrOpenCount > 0 && <i>{newOrOpenCount}</i>}</button>{notificationsOpen && <div className="sd-popover"><div className="sd-popover-title"><b>Updates</b><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close updates"><X size={14}/></button></div>{outstanding.length ? outstanding.slice(0, 4).map(item => <button type="button" className="sd-notification" key={item.id} onClick={() => go('submissions')}><span className="sd-notification-dot"/><span><b>{item.challenge?.title || 'Challenge submission'}</b><small>{item.isFlagged ? 'Needs attention' : 'Review or assessment still in progress'}</small></span><ArrowRight size={14}/></button>) : <p className="sd-popover-empty">You’re all caught up.</p>}<button type="button" className="sd-popover-link" onClick={() => go('submissions')}>Open my submissions <ArrowRight size={14}/></button></div>}</div>
        <div className="sd-menu-wrap"><button type="button" className="sd-profile-button" aria-expanded={profileOpen} onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}><span className="sd-avatar">{initials}</span><span><b>{user?.name || user?.githubUsername || 'Developer'}</b><small>Developer workspace</small></span><ChevronDown size={15}/></button>{profileOpen && <div className="sd-popover sd-profile-popover"><button type="button" onClick={() => go('passport')}><ShieldCheck size={15}/> View CodePassport</button><button type="button" onClick={() => go('pri')}><Activity size={15}/> PRI score</button><button type="button" onClick={() => go('codeprint')}><Fingerprint size={15}/> CodePrint</button><button type="button" onClick={onSignOut}><span className="sd-signout-dot"/> Sign out</button></div>}</div>
      </div>
    </div>

    <section className="sd-hero"><div className="sd-hero-copy"><span className="sd-eyebrow"><Sparkles size={13}/> YOUR VERIFIED WORKSPACE</span><h1>Welcome back, {user?.name?.split(' ')[0] || 'Developer'}</h1><p>Build your skills, complete challenges, and get verified.</p><button type="button" className="sd-primary-button" onClick={() => go('challenges')}>Explore challenges <ArrowRight size={16}/></button></div><div className="sd-hero-art" aria-hidden="true"><div className="sd-orbit sd-orbit-one"/><div className="sd-orbit sd-orbit-two"/><div className="sd-shield"><ShieldCheck size={52}/></div><span className="sd-art-chip sd-art-chip-one"><CheckCircle2 size={15}/> Evidence linked</span><span className="sd-art-chip sd-art-chip-two"><Code2 size={15}/> Skills in progress</span></div></section>

    <section className="sd-kpis" aria-label="Your progress">
      <Kpi icon={Layers3} label="Active challenges" value={activeChallenges.length} detail="Available to you" tone="blue"/>
      <Kpi icon={FileCheck2} label="Total submissions" value={credentials.length} detail="Across all challenges" tone="violet"/>
      <Kpi icon={BadgeCheck} label="Credentials earned" value={verified.length} detail="Verified and issued" tone="green"/>
      <Kpi icon={Activity} label="Overall progress" value={`${progress}%`} detail={credentials.length ? `${credentials.reduce((sum, item) => sum + assessmentCount(item), 0)} of ${credentials.length * 4} assessment steps` : 'Start with a challenge'} tone="amber" progress={progress}/>
    </section>

    <div className="sd-overview-grid">
      <section className="sd-passport-card"><div className="sd-section-label">DEVELOPER CREDENTIAL</div><div className="sd-passport-shield"><ShieldCheck size={28}/></div><div className={`sd-status ${verified.length ? 'is-verified' : 'is-pending'}`}><i/>{verified.length ? 'Verified' : 'In progress'}</div><h2>Your CodePassport</h2><p>{verified.length ? 'Your developer identity has verified challenge evidence ready to share.' : 'Complete a challenge and independent reviews to earn verified credentials.'}</p><button type="button" className="sd-outline-button" onClick={() => go('passport')}>View CodePassport <ArrowRight size={15}/></button><span className="sd-passport-watermark" aria-hidden="true"><ShieldCheck size={110}/></span></section>
      <section className="sd-quick-panel"><SectionHeading eyebrow="KEEP MOVING" title="Quick actions" detail="Pick up where you left off."/><div className="sd-quick-list"><QuickAction icon={Github} title="Submit a repository" detail="Add your GitHub repo to a challenge" onClick={() => go('challenges')}/><QuickAction icon={Target} title="Take PRI quiz" detail="Continue an available assessment" onClick={() => go('submissions')}/><QuickAction icon={Layers3} title="View challenges" detail="Explore open opportunities" onClick={() => go('challenges')}/></div></section>
    </div>

    <section className="sd-section"><SectionHeading eyebrow="YOUR WORKSPACE" title="Your challenges" detail="Track your skills and submit repositories for verification." action={<button type="button" className="sd-text-button" onClick={() => go('challenges')}>All challenges <ArrowRight size={15}/></button>}/>
      {visibleChallenges.length ? <div className="sd-challenge-grid">{visibleChallenges.slice(0, 3).map(challenge => <ChallengeCard key={challenge.id} challenge={challenge} credentials={credentials} onOpen={() => go('challenges')}/>)}</div> : <EmptyState title={searchTerm ? 'No matching challenges' : 'No active challenges yet'} detail={searchTerm ? 'Try a different search term.' : 'New challenges from recruiters will appear here.'} action={searchTerm ? <button type="button" onClick={() => setQuery('')}>Clear search</button> : null}/>}</section>

    <div className="sd-lower-grid">
      <section className="sd-surface sd-table-card"><SectionHeading eyebrow="LATEST EVIDENCE" title="Recent submissions" detail="Your latest repository submissions and their status." action={<button type="button" className="sd-text-button" onClick={() => go('submissions')}>View all <ArrowRight size={15}/></button>}/>{visibleCredentials.length ? <div className="sd-table-scroll"><table className="sd-table"><thead><tr><th>Challenge</th><th>Repository</th><th>Submitted</th><th>Status</th><th aria-label="Open submission"/></tr></thead><tbody>{visibleCredentials.slice(0, 5).map(item => <tr key={item.id} onClick={() => go('submissions')} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') go('submissions'); }}><td><b>{item.challenge?.title || 'Challenge submission'}</b></td><td><span className="sd-repo-name"><Github size={14}/>{repoName(item.githubRepoUrl)}</span></td><td>{dateLabel(item.createdAt)}</td><td><StatusBadge credential={item}/></td><td><ArrowRight size={15}/></td></tr>)}</tbody></table></div> : <EmptyState title={searchTerm ? 'No matching submissions' : 'No submissions yet'} detail={searchTerm ? 'Try a different search term.' : 'Choose a challenge to submit your first repository.'} action={!searchTerm ? <button type="button" onClick={() => go('challenges')}>Browse challenges <ArrowRight size={14}/></button> : null}/>}</section>

      <section className="sd-surface sd-progress-card"><SectionHeading eyebrow="CREDENTIAL STATUS" title="Verification progress" detail="Independent review status across your submissions."/><div className="sd-progress-main"><ScoreRing value={verificationProgress} label="Verification progress" size={112}/><div><b>{verificationProgress}%</b><strong>Complete</strong><small>{verified.length} of {credentials.length} credentials verified</small></div></div><div className="sd-legend"><span><i className="legend-verified"/>Verified <b>{verified.length}</b></span><span><i className="legend-review"/>Under review <b>{credentials.filter(item => !item.isVerified && (item.scores?.githubReviews || 0) > 0).length}</b></span><span><i className="legend-pending"/>Pending <b>{credentials.filter(item => !item.isVerified && !(item.scores?.githubReviews || 0)).length}</b></span>{credentials.some(item => item.isFlagged) && <span><i className="legend-flagged"/>Flagged <b>{credentials.filter(item => item.isFlagged).length}</b></span>}</div></section>
    </div>

    <div className="sd-activity-help-grid"><section className="sd-surface sd-activity-card"><SectionHeading eyebrow="YOUR ACTIVITY" title="Recent activity" detail="Updates from your challenge work." action={<button type="button" className="sd-text-button" onClick={() => go('submissions')}>View all <ArrowRight size={15}/></button>}/>{activities.length ? <div className="sd-activity-list">{activities.map(item => <button type="button" className="sd-activity-row" key={item.id} onClick={() => go(item.page)}><span className={`sd-activity-icon ${item.tone}`}><item.icon size={16}/></span><span className="sd-activity-copy"><b>{item.title}</b><small>{item.detail}</small></span><time>{dateLabel(item.date)}</time></button>)}</div> : <EmptyState title="Your activity will show here" detail="Submit a repository or explore challenges to get started."/>}</section>
      <aside className="sd-help-card"><div className="sd-help-icon"><CircleHelp size={22}/></div><div className="sd-eyebrow">HERE WHEN YOU NEED IT</div><h2>Need help?</h2><p>Get setup guidance and learn how challenge evidence and reviews work.</p><a href="https://github.com/visheshdevanur/hackmysp2/blob/main/docs/setup.md" target="_blank" rel="noreferrer">Visit Help Center <ArrowRight size={15}/></a><BookOpen className="sd-help-watermark" size={86} aria-hidden="true"/></aside></div>

    <section className="sd-bottom-cta"><div><div className="sd-eyebrow">EVIDENCE OVER ASSERTIONS</div><h2>Build. Verify. Get Hired.</h2><p>Showcase your real skills with evidence-backed verification.</p></div><button type="button" className="sd-primary-button" onClick={() => go('challenges')}>Explore challenges <ArrowRight size={16}/></button><span className="sd-cta-shape" aria-hidden="true"><ShieldCheck size={94}/></span></section>
  </div>;
}

function Kpi({ icon: Icon, label, value, detail, tone, progress }) {
  return <article className="sd-kpi"><span className={`sd-kpi-icon ${tone}`}><Icon size={19}/></span><span className="sd-kpi-label">{label}</span><div className="sd-kpi-value-row"><strong>{value}</strong>{progress != null && <ScoreRing value={progress} label="Overall progress" size={52} showLabel={false}/>}</div><small>{detail}</small>{progress != null && <div className="sd-kpi-track"><i style={{ width: `${progress}%` }}/></div>}</article>;
}

function SectionHeading({ eyebrow, title, detail, action }) {
  return <div className="sd-section-heading"><div><div className="sd-section-label">{eyebrow}</div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function QuickAction({ icon: Icon, title, detail, onClick }) {
  return <button type="button" className="sd-quick-action" onClick={onClick}><span><Icon size={17}/></span><span><b>{title}</b><small>{detail}</small></span><ArrowRight size={16}/></button>;
}

function ChallengeCard({ challenge, credentials, onOpen }) {
  const credential = credentials.find(item => item.challengeId === challenge.id);
  const completed = assessmentCount(credential);
  const tags = [...new Set([challenge.role, ...(challenge.requirements || [])].filter(Boolean))].slice(0, 3);
  return <article className="sd-challenge-card"><div className="sd-challenge-card-top"><span className="sd-challenge-icon"><Code2 size={18}/></span><span className={`sd-challenge-status ${credential?.isVerified ? 'verified' : credential ? 'submitted' : 'active'}`}>{credential?.isVerified ? 'Verified' : credential ? 'In progress' : 'Active'}</span></div><div className="sd-challenge-level">{challenge.difficulty || 'Challenge'}{challenge.role ? ` · ${challenge.role}` : ''}</div><h3>{challenge.title}</h3><div className="sd-challenge-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="sd-challenge-progress-label"><span>{credential ? `${completed}/4 assessments` : 'No submission yet'}</span>{credential && <b>{Math.round(completed / 4 * 100)}%</b>}</div><div className="sd-challenge-track"><i style={{ width: `${credential ? completed / 4 * 100 : 0}%` }}/></div><div className="sd-challenge-foot"><small>{challenge._count?.credentials ?? 0} platform submissions</small><button type="button" onClick={onOpen}>View challenge <ArrowRight size={14}/></button></div></article>;
}

function StatusBadge({ credential }) {
  if (credential.isVerified) return <span className="sd-table-status verified"><i/>Verified</span>;
  if (credential.isFlagged) return <span className="sd-table-status flagged"><i/>Flagged</span>;
  if ((credential.scores?.githubReviews || 0) > 0) return <span className="sd-table-status review"><i/>Under review</span>;
  if (credential.scores?.completedComponents > 0 || credential.quizAttemptStatus === 'completed') return <span className="sd-table-status review"><i/>In review</span>;
  return <span className="sd-table-status pending"><i/>Pending</span>;
}

function EmptyState({ title, detail, action }) {
  return <div className="sd-empty"><span><Layers3 size={20}/></span><b>{title}</b><p>{detail}</p>{action}</div>;
}
