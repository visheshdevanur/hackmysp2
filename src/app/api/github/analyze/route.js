import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { githubApiHeaders } from '@/lib/github-auth';

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const headers = await githubApiHeaders(user.id);
  try {
    const submissions = await prisma.credential.findMany({ where: { userId: user.id }, include: { challenge: { select: { title: true, role: true, difficulty: true } }, workSession: { select: { analysisJson: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    if (!user.githubUsername && !submissions.length) return NextResponse.json({ error: 'Connect GitHub or submit a repository to a challenge before running CodePrint.' }, { status: 400 });
    let repos = [];
    if (user.githubUsername) {
      const response = await fetch(`https://api.github.com/users/${encodeURIComponent(user.githubUsername)}/repos?per_page=100&sort=updated`, { headers, cache: 'no-store' });
      if (!response.ok) return NextResponse.json({ error: response.status === 404 ? 'The connected GitHub profile is not available.' : 'GitHub rate-limited the request. Add GITHUB_TOKEN or try later.' }, { status: 502 });
      repos = (await response.json()).filter(r => !r.fork).slice(0, 20);
    }
    const commits = [];
    const languageTotals = {};
    for (const repo of repos) {
      const [commitResponse, languageResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo.full_name}/commits?author=${encodeURIComponent(user.githubUsername)}&per_page=30`, { headers, cache: 'no-store' }),
        fetch(`https://api.github.com/repos/${repo.full_name}/languages`, { headers, cache: 'no-store' }),
      ]);
      if (commitResponse.ok) commits.push(...(await commitResponse.json()).map(c => ({ date: c.commit.author?.date || c.commit.committer?.date, message: c.commit.message, repo: repo.full_name, sha: c.sha.slice(0, 7) })));
      if (languageResponse.ok) for (const [lang, bytes] of Object.entries(await languageResponse.json())) languageTotals[lang] = (languageTotals[lang] || 0) + bytes;
    }
    const hours = Array(24).fill(0);
    commits.forEach(c => { const date = new Date(c.date); if (!isNaN(date)) hours[date.getUTCHours()]++; });
    const peakHours = hours.map((n, i) => ({ hour: i, count: n })).sort((a,b) => b.count-a.count).slice(0, 3).filter(x=>x.count).map(x=>`${String(x.hour).padStart(2,'0')}:00 UTC`);
    const languages = Object.entries(languageTotals).sort((a,b)=>b[1]-a[1]).map(([name])=>name);
    const activeDays = new Set(commits.map(c => c.date?.slice(0,10)).filter(Boolean)).size;
    const weeks = new Set(commits.map(c => { const d = new Date(c.date); return `${d.getUTCFullYear()}-${Math.ceil((d.getTime()-new Date(Date.UTC(d.getUTCFullYear(),0,1)).getTime())/604800000)}`; }).filter(Boolean)).size;
    const scores = { commitFrequency: Math.min(100, Math.round(commits.length / Math.max(repos.length,1) * 8)), codeComplexity: Math.min(100, Math.round(repos.reduce((s,r)=>s+Math.min(r.size||0,1000),0)/Math.max(repos.length,1)/10)), languageDiversity: Math.min(100, languages.length * 14), debugging: Math.min(100, commits.filter(c=>/fix|bug|patch|edge/i.test(c.message)).length / Math.max(commits.length,1) * 400), collaboration: Math.min(100, new Set(repos.map(r=>r.full_name)).size * 5), consistency: Math.min(100, Math.round(weeks / 12 * 100)) };
    const repoCommitCache = new Map();
    const repoLanguageCache = new Map();
    const challengeEvidence = await Promise.all(submissions.map(async credential => {
      let parsed;
      try { parsed = new URL(credential.githubRepoUrl); } catch { return null; }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parsed.hostname.toLowerCase() !== 'github.com' || parts.length < 2) return null;
      const fullName = `${decodeURIComponent(parts[0])}/${decodeURIComponent(parts[1].replace(/\.git$/i, ''))}`;
      if (!repoCommitCache.has(fullName)) repoCommitCache.set(fullName, (async () => {
        const authorFilter = user.githubUsername ? `?author=${encodeURIComponent(user.githubUsername)}&per_page=100` : '?per_page=100';
        const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(fullName.split('/')[0])}/${encodeURIComponent(fullName.split('/')[1])}/commits${authorFilter}`, { headers, cache: 'no-store' });
        return response.ok ? response.json() : [];
      })());
      if (!repoLanguageCache.has(fullName)) repoLanguageCache.set(fullName, (async () => {
        const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(fullName.split('/')[0])}/${encodeURIComponent(fullName.split('/')[1])}/languages`, { headers, cache: 'no-store' });
        return response.ok ? response.json() : {};
      })());
      const [authorCommits, repoLanguages] = await Promise.all([repoCommitCache.get(fullName), repoLanguageCache.get(fullName)]);
      const commitRows = Array.isArray(authorCommits) ? authorCommits : [];
      let report = null;
      try { report = credential.workSession?.analysisJson ? JSON.parse(credential.workSession.analysisJson) : null; } catch {}
      const days = new Set(commitRows.map(item => (item.commit?.author?.date || item.commit?.committer?.date || '').slice(0, 10)).filter(Boolean));
      return {
        credentialId: credential.id, challenge: credential.challenge, repository: `https://github.com/${fullName}`,
        authorMatched: Boolean(user.githubUsername), authorMatchedCommits: user.githubUsername ? commitRows.length : null, repositoryCommitCount: user.githubUsername ? undefined : commitRows.length, activeDays: user.githubUsername ? days.size : null,
        languages: Object.entries(repoLanguages || {}).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(([name])=>name),
        commitEvidence: user.githubUsername ? commitRows.slice(0, 8).map(item => ({ sha: item.sha?.slice(0, 7), message: String(item.commit?.message || '').split('\n')[0].slice(0, 180), date: item.commit?.author?.date || item.commit?.committer?.date || null })) : [],
        solutionSummary: String(report?.summary || '').slice(0, 1200), strengths: (report?.strengths || []).slice(0, 5), improvements: (report?.improvements || []).slice(0, 5),
        sessionDimensions: (report?.dimensions || []).map(({ name, score }) => ({ name, score: Math.max(0, Math.min(100, Number(score) || 0)) })),
        submittedCommits: credential.commits, analyzedAt: new Date().toISOString(),
      };
    })).then(rows => rows.filter(Boolean));
    let previous = {};
    try { previous = JSON.parse(user.codePrint || '{}'); } catch {}
    const codePrint = { ...previous, scores: user.githubUsername ? scores : previous.scores || null, languages: languages.slice(0,8), commitFrequency: { peakHours, hourlyDistribution: hours }, debugging: { ratio: commits.length ? commits.filter(c=>/fix|bug|patch/i.test(c.message)).length/commits.length : 0, commits: commits.filter(c=>/fix|bug|patch/i.test(c.message)).length }, collaboration: { repositories: repos.length }, analyzedAt: new Date().toISOString(), reposAnalyzed: repos.length, totalCommits: commits.length, activeDays, challengeEvidence };
    await prisma.user.update({ where: { id: user.id }, data: { codePrint: JSON.stringify(codePrint) } });
    return NextResponse.json({ codePrint });
  } catch (error) { console.error('GitHub analysis failed', error); return NextResponse.json({ error: 'Could not analyze GitHub right now. Please retry.' }, { status: 502 }); }
}
