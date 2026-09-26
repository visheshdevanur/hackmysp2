import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function currentUser() {
  const session = await getServerSession(authOptions);
  return session?.user || null;
}

export async function requireRole(...roles) {
  const user = await currentUser();
  if (!user) return { user: null, status: 401 };
  if (roles.length && !roles.includes(user.role)) return { user: null, status: 403 };
  return { user, status: 200 };
}
