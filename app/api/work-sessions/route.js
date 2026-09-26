import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const rows = await prisma.workSession.findMany({
    where: { userId: user.id },
    include: { challenge: { select: { id: true, title: true, description: true, sessionDurationMinutes: true } }, recordings: { select: { id: true, segmentIndex: true, byteSize: true, mimeType: true, createdAt: true }, orderBy: [{ segmentIndex: 'asc' }, { chunkIndex: 'asc' }] } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(rows);
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Student account required.' }, { status: 403 });
  try {
    const { challengeId, privacyAccepted } = await request.json();
    if (!privacyAccepted) return NextResponse.json({ error: 'Consent is required before recording starts.' }, { status: 400 });
    const challenge = await prisma.challenge.findFirst({ where: { id: String(challengeId || ''), isActive: true } });
    if (!challenge) return NextResponse.json({ error: 'This challenge is not available.' }, { status: 404 });
    const existing = await prisma.workSession.findFirst({ where: { userId: user.id, challengeId: challenge.id, status: { in: ['ready', 'active', 'paused', 'analyzing'] } }, include: { recordings: { select: { id: true, segmentIndex: true, byteSize: true, mimeType: true, createdAt: true }, orderBy: [{ segmentIndex: 'asc' }, { chunkIndex: 'asc' }] } }, orderBy: { updatedAt: 'desc' } });
    if (existing) {
      let resumed = existing;
      if (existing.status === 'active') {
        const elapsed = Math.min(15, Math.max(0, Math.floor((Date.now() - new Date(existing.lastHeartbeatAt || existing.updatedAt).getTime()) / 1000)));
        resumed = await prisma.workSession.update({ where: { id: existing.id }, data: { status: 'paused', elapsedSeconds: Math.min(existing.durationSeconds, existing.elapsedSeconds + elapsed), lastHeartbeatAt: null } });
      }
      return NextResponse.json({ ...resumed, challenge, recordings: existing.recordings, resumed: true });
    }
    const row = await prisma.workSession.create({ data: { userId: user.id, challengeId: challenge.id, durationSeconds: challenge.sessionDurationMinutes * 60, privacyAcceptedAt: new Date() } });
    return NextResponse.json({ ...row, challenge, recordings: [], resumed: false }, { status: 201 });
  } catch (error) {
    console.error('Timed session creation failed', error);
    return NextResponse.json({ error: 'Could not start this challenge session. Please try again.' }, { status: 400 });
  }
}
