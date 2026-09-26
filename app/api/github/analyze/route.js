import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { githubApiHeaders } from '@/lib/github-auth';

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!user.githubUsername) return NextResponse.json({ error: 'Connect GitHub before running an analysis.' }, { status: 400 });
  const headers = await githubApiHeaders(user.id);
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(user.githubUsername)}/repos?per_page=100&sort=updated`, { headers, cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? 'The connected GitHub profile is not available.' : 'GitHub rate-limited the request. Add GITHUB_TOKEN or try later.' }, { status: 502 });
    const repos = (await response.json()).filter(r => !r.fork).slice(0, 20);
    const commits = [];
    const languageTotals = {};
    for (const repo of repos) {
      const [commitResponse, languageResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo.full_name}/commits?per_page=30`, { headers, cache: 'no-store' }),
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
    const codePrint = { scores, languages: languages.slice(0,8), commitFrequency: { peakHours, hourlyDistribution: hours }, debugging: { ratio: commits.length ? commits.filter(c=>/fix|bug|patch/i.test(c.message)).length/commits.length : 0, commits: commits.filter(c=>/fix|bug|patch/i.test(c.message)).length }, collaboration: { repositories: repos.length }, analyzedAt: new Date().toISOString(), reposAnalyzed: repos.length, totalCommits: commits.length, activeDays };
    await prisma.user.update({ where: { id: user.id }, data: { codePrint: JSON.stringify(codePrint) } });
    return NextResponse.json({ codePrint });
  } catch (error) { console.error('GitHub analysis failed', error); return NextResponse.json({ error: 'Could not analyze GitHub right now. Please retry.' }, { status: 502 }); }
}
