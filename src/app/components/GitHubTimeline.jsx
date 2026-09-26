'use client';
import { useEffect, useState } from 'react';
import { Activity, ExternalLink, GitCommitHorizontal } from 'lucide-react';

async function githubRequest(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 404 ? 'Repository is unavailable or no longer public.' : response.status === 403 ? 'GitHub API rate limit reached. Try again later.' : 'GitHub could not return this timeline.');
  return payload;
}

async function fetchPublicTimeline(repoUrl) {
  const url = new URL(repoUrl);
  const [owner, repository] = url.pathname.split('/').filter(Boolean);
  if (url.hostname !== 'github.com' || !owner || !repository) throw new Error('Invalid GitHub repository URL.');
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository.replace(/\.git$/, ''))}`;
  const commits = await githubRequest(`${path}/commits?per_page=8`);
  let ci = null;
  const latestSha = commits[0]?.sha || null;
  if (latestSha) {
    try {
      const checks = await githubRequest(`${path}/commits/${encodeURIComponent(latestSha)}/check-runs`);
      const runs = checks.check_runs || [];
      const passed = runs.filter(run => run.conclusion === 'success').length;
      ci = { total: runs.length, passed, status: !runs.length ? 'not_configured' : passed === runs.length ? 'passed' : runs.some(run => run.status !== 'completed') ? 'running' : 'failed' };
    } catch { ci = null; }
  }
  return { repository: `${owner}/${repository.replace(/\.git$/, '')}`, commits: commits.map(item => ({ sha: item.sha.slice(0, 7), message: String(item.commit?.message || '').split('\n')[0].slice(0, 180), author: item.commit?.author?.name || item.author?.login || 'Unknown author', date: item.commit?.author?.date || item.commit?.committer?.date || null, url: item.html_url })), ci };
}

export default function GitHubTimeline({ credentialId, repoUrl, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function load() {
    if (data || loading) return;
    setLoading(true);
    try {
      try { setData(await fetchPublicTimeline(repoUrl)); }
      catch (publicError) {
        const response = await fetch(`/api/credentials/${encodeURIComponent(credentialId)}/timeline`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || publicError.message || 'Could not load timeline.');
        setData(result);
      }
    } catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (defaultOpen) void load(); }, [defaultOpen]);
  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    await load();
  }
  return <section className="github-timeline">
    <button type="button" className="github-timeline-toggle" onClick={toggle}><GitCommitHorizontal size={14}/>{open ? 'Hide' : 'View'} GitHub timeline <span>· public repo</span></button>
    {open && (loading ? <p className="real-muted">Loading recent commits and CI checks…</p> : error ? <p className="timeline-error">{error}</p> : data && <div className="timeline-content">
      <div className="timeline-heading"><b>Linked repo <a href={`https://github.com/${data.repository}`} target="_blank" rel="noreferrer">{data.repository}<ExternalLink size={11}/></a></b><small>CI on latest push</small></div>
      <div className="timeline-columns"><ol className="timeline-commits">{data.commits.map(commit => <li key={commit.sha}><span className="timeline-dot"/><div><a href={commit.url} target="_blank" rel="noreferrer"><code>{commit.sha}</code> {commit.message}<ExternalLink size={10}/></a><small>{commit.author} · {commit.date ? new Date(commit.date).toLocaleString() : 'Date unavailable'}</small></div></li>)}</ol>
        <div className="timeline-ci"><b><Activity size={14}/> CI status</b>{data.ci?.status === 'not_configured' || !data.ci ? <p>No GitHub Actions checks found for the latest commit.</p> : <><strong>{data.ci.passed}/{data.ci.total}</strong><p>{data.ci.status === 'passed' ? 'checks passing on latest push' : data.ci.status === 'running' ? 'checks still running' : 'one or more checks failed'}</p></>}</div>
      </div>
    </div>)}
  </section>;
}
