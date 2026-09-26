import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { githubApiHeaders } from '@/lib/github-auth';

export async function GET(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const credential = await prisma.credential.findUnique({ where: { id: params.id }, include: { challenge: { select: { creatorId: true } } } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  const allowed = user.role === 'reviewer' || (user.role === 'student' && credential.userId === user.id) || (user.role === 'recruiter' && credential.challenge.creatorId === user.id);
  if (!allowed) return NextResponse.json({ error: 'You cannot view this repository timeline.' }, { status: 403 });
  try {
    const parsed = new URL(credential.githubRepoUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname !== 'github.com' || parts.length < 2) throw new Error('Invalid GitHub repository URL.');
    const owner = decodeURIComponent(parts[0]);
    const repository = decodeURIComponent(parts[1].replace(/\.git$/, ''));
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
    const headers = await githubApiHeaders(user.id);
    const commitsResponse = await fetch(`https://api.github.com${path}/commits?per_page=8`, { headers, cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!commitsResponse.ok) return NextResponse.json({ error: commitsResponse.status === 404 ? 'Repository timeline is unavailable; check that the repository remains public.' : 'GitHub rate-limited the timeline request. Try again shortly.' }, { status: 502 });
    const commits = await commitsResponse.json();
    let ci = null;
    const sha = commits[0]?.sha;
    if (sha) {
      const checksResponse = await fetch(`https://api.github.com${path}/commits/${encodeURIComponent(sha)}/check-runs`, { headers, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (checksResponse.ok) {
        const checks = await checksResponse.json();
        const runs = checks.check_runs || [];
        const passed = runs.filter(run => run.conclusion === 'success').length;
        ci = { total: runs.length, passed, status: !runs.length ? 'not_configured' : passed === runs.length ? 'passed' : runs.some(run => run.status !== 'completed') ? 'running' : 'failed' };
      }
    }
    return NextResponse.json({ repository: `${owner}/${repository}`, commits: commits.map(item => ({ sha: item.sha.slice(0, 7), message: String(item.commit?.message || '').split('\n')[0].slice(0, 180), author: item.commit?.author?.name || item.author?.login || 'Unknown author', date: item.commit?.author?.date || item.commit?.committer?.date || null, url: item.html_url })), ci, latestSha: sha || null });
  } catch (error) {
    return NextResponse.json({ error: error.name === 'TimeoutError' ? 'GitHub took too long to return this timeline.' : 'Could not load the GitHub timeline.' }, { status: 502 });
  }
}
