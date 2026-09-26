'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, ExternalLink } from 'lucide-react';

export default function InterviewInvitations() {
  const [items, setItems] = useState(null);
  useEffect(() => { let live = true; fetch('/api/interview-invitations').then(response => response.json()).then(data => { if (live) setItems(Array.isArray(data) ? data : []); }).catch(() => { if (live) setItems([]); }); return () => { live = false; }; }, []);
  return <section className="real-panel interview-invitations"><div className="real-panel-head"><div><h2><CalendarClock size={17}/> Interview invitations</h2><p>Meeting details sent by recruiters for your challenge submissions.</p></div></div>{items === null ? <p className="real-muted">Loading invitations…</p> : items.length ? items.map(item => <article key={item.id}><div><b>{item.challenge.title}</b><small>{item.recruiter.companyName || item.recruiter.name || 'Recruiter'} · {item.durationMinutes} minutes</small></div><strong>{new Date(item.scheduledAt).toLocaleString()}</strong><a href={item.meetingLink} target="_blank" rel="noreferrer">Join meeting <ExternalLink size={13}/></a></article>) : <p className="real-muted">No interview invitations yet. A recruiter’s schedule and meeting link will appear here.</p>}</section>;
}
