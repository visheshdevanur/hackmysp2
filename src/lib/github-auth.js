import { prisma } from '@/lib/db';

export async function githubApiHeaders(userId) {
  const account = await prisma.account.findFirst({ where: { userId, provider: 'github' }, select: { access_token: true } });
  const token = account?.access_token || process.env.GITHUB_TOKEN;
  return { Accept: 'application/vnd.github+json', 'User-Agent': 'CodeVeritas', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
