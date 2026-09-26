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
  if (user.role !== 'student') return NextResponse.json({ error: 'Student account required.' }, { status: 403 });
  const session = await prisma.workSession.findFirst({ where: { id: params.id, userId: user.id, status: { in: ['active', 'paused'] } } });
  if (!session) return NextResponse.json({ error: 'This recording session is not active.' }, { status: 409 });
  // A paused session may still have an in-flight MediaRecorder chunk. Accept late chunks
  // until submission starts; the segment and chunk indexes remain constrained below.
  const url = new URL(request.url);
  const segmentIndex = Number(url.searchParams.get('segment'));
  const chunkIndex = Number(url.searchParams.get('chunk'));
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= session.segmentCount || !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 100_000 || !/^video\/(webm|mp4)(;|$)/.test(type)) return NextResponse.json({ error: 'Invalid recording chunk.' }, { status: 400 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_CHUNK_BYTES) return NextResponse.json({ error: 'Recording chunk must be under 12 MB.' }, { status: 413 });
  const extension = type.startsWith('video/mp4') ? 'mp4' : 'webm';
  const directory = resolve(process.cwd(), 'storage', 'session-recordings', session.id);
  const filePath = resolve(directory, `segment-${segmentIndex}-chunk-${chunkIndex}.${extension}`);
  if (!filePath.startsWith(`${directory}${process.platform === 'win32' ? '\\' : '/'}`)) return NextResponse.json({ error: 'Invalid recording path.' }, { status: 400 });
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, bytes);
  await prisma.workSessionRecording.upsert({
    where: { workSessionId_segmentIndex_chunkIndex: { workSessionId: session.id, segmentIndex, chunkIndex } },
    create: { workSessionId: session.id, segmentIndex, chunkIndex, filePath, mimeType: type.split(';')[0], byteSize: bytes.length },
    update: { filePath, mimeType: type.split(';')[0], byteSize: bytes.length },
  });
  return NextResponse.json({ saved: true, segmentIndex, chunkIndex, byteSize: bytes.length }, { status: 201 });
}
