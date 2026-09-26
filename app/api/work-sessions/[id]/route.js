import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const session = await prisma.workSession.findUnique({ where: { id: params.id }, include: { challenge: { select: { id: true, title: true, description: true, creatorId: true } }, recordings: { select: { segmentIndex: true, chunkIndex: true, byteSize: true, mimeType: true }, orderBy: [{ segmentIndex: 'asc' }, { chunkIndex: 'asc' }] } } });
  if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  const allowed = user.id === session.userId || (user.role === 'recruiter' && user.id === session.challenge.creatorId) || user.role === 'reviewer';
  if (!allowed) return NextResponse.json({ error: 'You cannot view this session.' }, { status: 403 });
  const { userId, challengeId, ...visible } = session;
  return NextResponse.json(visible);
}
