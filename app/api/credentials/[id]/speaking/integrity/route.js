import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

function parse(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Developer account required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const allowed = new Set(['tab_hidden', 'capture_interrupted', 'attempt_reloaded']);
  const reason = allowed.has(body.reason) ? body.reason : 'tab_hidden';
  const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, select: { speakingStatus: true, speakingDataJson: true } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  if (credential.speakingStatus === 'failed') return NextResponse.json({ status: 'failed' });
  if (credential.speakingStatus !== 'in_progress') return NextResponse.json({ error: 'No active speaking attempt exists.' }, { status: 409 });
  const data = parse(credential.speakingDataJson);
  const event = { type: reason, occurredAt: new Date().toISOString() };
  const next = { ...data, integrityEvents: [...(data.integrityEvents || []), event] };
  const saved = await prisma.credential.updateMany({ where: { id: params.id, userId: user.id, speakingStatus: 'in_progress', speakingDataJson: credential.speakingDataJson }, data: { speakingStatus: 'failed', speakingFinishedAt: new Date(), speakingDataJson: JSON.stringify(next) } });
  if (!saved.count) return NextResponse.json({ error: 'The speaking attempt already changed.' }, { status: 409 });
  return NextResponse.json({ status: 'failed', event });
}
