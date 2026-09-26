import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
const MAX_CHUNK_BYTES = 12 * 1024 * 1024;

export async function POST(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'student') return NextResponse.json({ error: 'Developer account required.' }, { status: 403 });
  const credential = await prisma.credential.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, quizAttemptStatus: true, quizAttemptFinishedAt: true, speakingStatus: true, speakingStartedAt: true, speakingFinishedAt: true } });
  if (!credential) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  const url = new URL(request.url);
  const segmentIndex = Number(url.searchParams.get('segment'));
  const chunkIndex = Number(url.searchParams.get('chunk'));
  const type = (request.headers.get('content-type') || '').toLowerCase();
  const quizOpen = segmentIndex === 0 && ['in_progress', 'completed', 'failed'].includes(credential.quizAttemptStatus) && (credential.quizAttemptStatus === 'in_progress' || Date.now() - new Date(credential.quizAttemptFinishedAt || 0).getTime() <= 45_000);
  const speakingOpen = [1, 2].includes(segmentIndex) && ['in_progress', 'analyzing', 'completed', 'timed_out', 'failed'].includes(credential.speakingStatus) && (credential.speakingStatus === 'in_progress' ? Date.now() - new Date(credential.speakingStartedAt || 0).getTime() <= 422_000 : credential.speakingStatus === 'analyzing' || Date.now() - new Date(credential.speakingFinishedAt || 0).getTime() <= 45_000);
  if ((!quizOpen && !speakingOpen) || ![0, 1, 2].includes(segmentIndex) || !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 100_000 || !/^video\/webm(;|$)/.test(type)) return NextResponse.json({ error: 'Invalid or closed recording segment.' }, { status: 409 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_CHUNK_BYTES) return NextResponse.json({ error: 'Quiz recording chunk must be under 12 MB.' }, { status: 413 });
  const directory = resolve(process.cwd(), 'storage', 'session-recordings', 'pri-quiz', credential.id);
  const filePath = resolve(directory, `segment-${segmentIndex}-chunk-${chunkIndex}.webm`);
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, bytes);
  await prisma.priQuizRecording.upsert({
    where: { credentialId_segmentIndex_chunkIndex: { credentialId: credential.id, segmentIndex, chunkIndex } },
    create: { credentialId: credential.id, segmentIndex, chunkIndex, filePath, mimeType: 'video/webm', byteSize: bytes.length },
    update: { filePath, mimeType: 'video/webm', byteSize: bytes.length },
  });
  return NextResponse.json({ saved: true, byteSize: bytes.length }, { status: 201 });
}
