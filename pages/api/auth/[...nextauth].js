import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GithubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' }, role: { label: 'Role', type: 'text' } },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
        if (!user?.passwordHash || (credentials.role && user.role !== credentials.role) || !(await compare(credentials.password || '', user.passwordHash))) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, githubUsername: user.githubUsername };
      },
    }),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? [GithubProvider({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, allowDangerousEmailAccountLinking: true, authorization: { params: { scope: 'read:user user:email public_repo' } } })] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'github') return true;
      const githubId = String(profile?.id || account.providerAccountId);
      let email = user.email?.toLowerCase() || null;
      if (!email && account.access_token) {
        const result = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${account.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'CodeVeritas' } });
        if (result.ok) {
          const addresses = await result.json();
          email = addresses.find(item => item.primary && item.verified)?.email?.toLowerCase() || addresses.find(item => item.verified)?.email?.toLowerCase() || null;
        }
      }
      const [emailUser, githubUser] = await Promise.all([
        email ? prisma.user.findUnique({ where: { email } }) : null,
        prisma.user.findUnique({ where: { githubId } }),
      ]);
      if (emailUser?.githubId && emailUser.githubId !== githubId) return false;
      if (githubUser && emailUser && githubUser.id !== emailUser.id) return false;
      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.id) token.userId = user.id;
      if (account?.provider === 'github') {
        const dbUser = await prisma.user.findFirst({ where: { OR: [{ githubId: String(account.providerAccountId) }, ...(user?.email ? [{ email: user.email }] : [])] } });
        if (dbUser) token.userId = dbUser.id;
      }
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.userId } });
        if (dbUser) { token.role = dbUser.role; token.githubUsername = dbUser.githubUsername; token.name = dbUser.name; token.email = dbUser.email; }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) { session.user.id = token.userId; session.user.role = token.role || 'student'; session.user.githubUsername = token.githubUsername || null; }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'github' || !user?.id) return;
      const githubId = String(profile?.id || account.providerAccountId);
      const githubUsername = profile?.login || null;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          githubId,
          ...(githubUsername ? { githubUsername } : {}),
          name: user.name || undefined,
          image: user.image || undefined,
        },
      });
    },
  },
};

export default NextAuth(authOptions);
