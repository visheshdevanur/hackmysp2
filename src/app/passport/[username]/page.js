'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, FileCheck2, Github, LoaderCircle, ShieldCheck } from 'lucide-react';
import ScoreRing from '@/app/components/ScoreRing';

const scoreLabels = [['share', 'Recorded session'], ['github', 'Peer review'], ['pri', 'PRI quiz'], ['speaking', 'Speaking']];

export default function PublicPassport({ params }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/passport/${encodeURIComponent(params.username)}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRecord(data);
    }).catch(cause => setError(cause.message));
  }, [params.username]);

  return <main className="public-passport"><header><Link href="/login"><span className="brand-mark">CV</span><b>codeveritas<span>.</span></b></Link><span>PUBLIC CODEPASSPORT</span></header>
    {record ? <>
      <section className="public-identity"><div className="real-eyebrow"><ShieldCheck size={13}/> DEVELOPER IDENTITY</div><div className="public-profile"><span className="real-avatar large">{record.image ? <img src={record.image} alt=""/> : (record.name || '?').slice(0, 1)}</span><div><h1>{record.name || record.githubUsername} {record.isVerified && <BadgeCheck size={17}/>}</h1><p>{record.githubUsername && <><Github size={14}/> @{record.githubUsername}</>} · {record.role}</p></div><ScoreRing value={record.pri} label="Verified overall PRI" size={88}/></div></section>
      {record.passportAnalysis && <section className="real-panel"><h2>AI portfolio analysis</h2><p>{record.passportAnalysis.summary}</p><div className="passport-ai-summary"><article><h3>Strengths</h3><ul>{record.passportAnalysis.strengths?.map((item, index) => <li key={index}>{item}</li>)}</ul></article><article><h3>Growth areas</h3><ul>{record.passportAnalysis.improvementAreas?.map((item, index) => <li key={index}>{item}</li>)}</ul></article><article><h3>Suitable roles</h3><ul>{record.passportAnalysis.suitableRoles?.map((item, index) => <li key={index}><b>{item.role}</b>: {item.rationale}</li>)}</ul></article></div><small className="real-muted">Generated from challenge assessment scores and role evidence. Raw recordings and private answers are not displayed.</small></section>}
      <section className="real-panel"><div className="real-panel-head"><div><h2>Verified challenge credentials</h2><p>Each credential is supported by independent peer review.</p></div></div>{record.credentials.length ? record.credentials.map(credential => <article className="public-credential public-credential-detail" key={credential.id}><FileCheck2 size={18}/><span><b>{credential.challenge.title}</b><small>{credential.challenge.role} · {credential.challenge.difficulty} · {credential.commits} commits</small><small><a href={credential.githubRepoUrl} target="_blank" rel="noreferrer">Open public repository</a></small><div className="codeprint-challenge-rings">{scoreLabels.map(([key, label]) => <ScoreRing key={key} value={credential.scores?.[key]} label={label} size={60}/>)}</div></span><ScoreRing value={credential.placementReadiness?.score} label="Challenge PRI" size={70}/></article>) : <p className="real-muted">No public verified credentials are available yet.</p>}</section>
      {record.codePrint && <section className="real-panel"><h2>CodePrint profile</h2><p className="real-muted">{record.codePrint.totalCommits} observed commits across {record.codePrint.reposAnalyzed} public repositories · {record.codePrint.activeDays} active days.</p>{Object.entries(record.codePrint.scores || {}).map(([key, value]) => <ScoreRing key={key} value={value} label={key.replace(/[A-Z]/g, ' $&')} size={64}/>)}</section>}
      <footer><ShieldCheck size={14}/> This public record includes verified scores and assessment summaries. <Link href="/login">CodeVeritas</Link></footer>
    </> : error ? <section className="real-panel public-error"><h1>Passport unavailable</h1><p>{error}</p></section> : <section className="public-error"><LoaderCircle className="spin"/> Loading passport…</section>}
  </main>;
}
