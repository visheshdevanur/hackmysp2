import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const session = await prisma.workSession.findUnique({ where: { id: params.id }, include: { challenge: { select: { creatorId: true } } } });
  if (!session) return NextResponse.json({ error: 'Recording not found.' }, { status: 404 });
  const allowed = user.id === session.userId || (user.role === 'recruiter' && user.id === session.challenge.creatorId) || user.role === 'reviewer';
  if (!allowed) return NextResponse.json({ error: 'You cannot view this recording.' }, { status: 403 });
  const segmentIndex = Number(params.segment);
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0) return NextResponse.json({ error: 'Invalid recording segment.' }, { status: 400 });
  const chunks = await prisma.workSessionRecording.findMany({ where: { workSessionId: session.id, segmentIndex }, orderBy: { chunkIndex: 'asc' } });
  if (!chunks.length) return NextResponse.json({ error: 'No saved video for this segment.' }, { status: 404 });
  const root = resolve(process.cwd(), 'storage', 'session-recordings', session.id);
  try {
    const buffers = await Promise.all(chunks.map(async chunk => {
      const path = resolve(chunk.filePath);
      if (!path.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error('Invalid stored path');
      return readFile(path);
    }));
    return new Response(Buffer.concat(buffers), { headers: { 'Content-Type': chunks[0].mimeType, 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'The saved recording file is unavailable.' }, { status: 500 });
  }
}
