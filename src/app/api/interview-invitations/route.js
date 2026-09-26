import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!['student', 'recruiter', 'reviewer'].includes(user.role)) return NextResponse.json({ error: 'Workspace account required.' }, { status: 403 });
  const where = user.role === 'recruiter' ? { recruiterId: user.id } : { candidateUserId: user.id };
  const invitations = await prisma.interviewInvitation.findMany({ where, include: { challenge: { select: { id: true, title: true, role: true, companyName: true } }, candidate: { select: { id: true, name: true, githubUsername: true } }, recruiter: { select: { id: true, name: true, companyName: true } } }, orderBy: { scheduledAt: 'asc' } });
  return NextResponse.json(invitations);
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'recruiter') return NextResponse.json({ error: 'Recruiter account required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.invitations) ? body.invitations : [];
  if (items.length < 1 || items.length > 100) return NextResponse.json({ error: 'Select at least one candidate.' }, { status: 400 });
  const challenge = await prisma.challenge.findFirst({ where: { id: body.challengeId, creatorId: user.id }, select: { id: true } });
  if (!challenge) return NextResponse.json({ error: 'Challenge not found in your recruiter workspace.' }, { status: 404 });
  const normalized = [];
  for (const item of items) {
    const scheduledAt = new Date(item.scheduledAt);
    const durationMinutes = Number(item.durationMinutes);
    const meetingLink = String(item.meetingLink || '').trim();
    let parsedLink;
    try { parsedLink = new URL(meetingLink); } catch { parsedLink = null; }
    if (!item.credentialId || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000 || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 240 || !parsedLink || !['https:', 'http:'].includes(parsedLink.protocol)) return NextResponse.json({ error: 'Each invite needs a future time, a 5–240 minute allotment, and a valid meeting link.' }, { status: 400 });
    const credential = await prisma.credential.findFirst({ where: { id: item.credentialId, challengeId: challenge.id }, select: { id: true, userId: true } });
    if (!credential) return NextResponse.json({ error: 'One selected candidate does not belong to this job.' }, { status: 400 });
    normalized.push({ recruiterId: user.id, candidateUserId: credential.userId, challengeId: challenge.id, credentialId: credential.id, scheduledAt, durationMinutes, meetingLink });
  }
  if (new Set(normalized.map(item => item.candidateUserId)).size !== normalized.length) return NextResponse.json({ error: 'Choose only one submission per developer for an interview round.' }, { status: 400 });
  const created = await prisma.$transaction(normalized.map(data => prisma.interviewInvitation.create({ data })));
  return NextResponse.json({ created: created.length }, { status: 201 });
}
