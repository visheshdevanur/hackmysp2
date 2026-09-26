import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Student account required.' }, { status: 403 });
  try {
    const body = await request.json();
    const session = await prisma.workSession.findFirst({ where: { id: params.id, userId: user.id } });
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    if (['submitted', 'analyzing'].includes(session.status)) return NextResponse.json({ error: 'This session has already been submitted.' }, { status: 409 });
    const now = new Date();
    const delta = session.status === 'active' && session.lastHeartbeatAt
      ? Math.min(15, Math.max(0, Math.floor((now.getTime() - new Date(session.lastHeartbeatAt).getTime()) / 1000)))
      : 0;
    const elapsedSeconds = Math.min(session.durationSeconds, session.elapsedSeconds + delta);
    if (body.action === 'heartbeat') {
      if (session.status !== 'active') return NextResponse.json({ error: 'Session is paused.' }, { status: 409 });
      const updated = await prisma.workSession.update({ where: { id: session.id }, data: { elapsedSeconds, lastHeartbeatAt: now, ...(elapsedSeconds >= session.durationSeconds ? { status: 'paused', lastHeartbeatAt: null } : {}) } });
      return NextResponse.json({ status: updated.status, elapsedSeconds: updated.elapsedSeconds, durationSeconds: updated.durationSeconds });
    }
    if (body.action === 'pause') {
      const updated = await prisma.workSession.update({ where: { id: session.id }, data: { status: 'paused', elapsedSeconds, lastHeartbeatAt: null } });
      return NextResponse.json({ status: updated.status, elapsedSeconds: updated.elapsedSeconds, durationSeconds: updated.durationSeconds });
    }
    if (body.action === 'resume') {
      if (session.status === 'active') return NextResponse.json({ status: 'active', elapsedSeconds: session.elapsedSeconds, durationSeconds: session.durationSeconds, segmentIndex: Math.max(0, session.segmentCount - 1) });
      if (elapsedSeconds >= session.durationSeconds) return NextResponse.json({ error: 'The challenge time has expired. Submit your repository to finish.' }, { status: 409 });
      const segmentIndex = session.segmentCount;
      const updated = await prisma.workSession.update({ where: { id: session.id }, data: { status: 'active', elapsedSeconds, lastHeartbeatAt: now, segmentCount: session.segmentCount + 1 } });
      return NextResponse.json({ status: updated.status, elapsedSeconds: updated.elapsedSeconds, durationSeconds: updated.durationSeconds, segmentIndex });
    }
    return NextResponse.json({ error: 'Unknown session action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Could not update this session.' }, { status: 400 });
  }
}
