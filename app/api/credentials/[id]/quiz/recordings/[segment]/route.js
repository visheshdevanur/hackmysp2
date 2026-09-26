import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const credential = await prisma.credential.findUnique({ where: { id: params.id }, include: { challenge: { select: { creatorId: true } } } });
  if (!credential) return NextResponse.json({ error: 'Quiz recording not found.' }, { status: 404 });
  const allowed = user.id === credential.userId || (user.role === 'recruiter' && user.id === credential.challenge.creatorId) || user.role === 'reviewer';
  if (!allowed) return NextResponse.json({ error: 'You cannot view this quiz recording.' }, { status: 403 });
  const segmentIndex = Number(params.segment);
  if (![0, 1, 2].includes(segmentIndex)) return NextResponse.json({ error: 'Invalid recording segment.' }, { status: 400 });
  const chunks = await prisma.priQuizRecording.findMany({ where: { credentialId: credential.id, segmentIndex }, orderBy: { chunkIndex: 'asc' } });
  if (!chunks.length) return NextResponse.json({ error: 'No saved quiz video was found.' }, { status: 404 });
  const root = resolve(process.cwd(), 'storage', 'session-recordings', 'pri-quiz', credential.id);
  try {
    const files = await Promise.all(chunks.map(async chunk => {
      const path = resolve(chunk.filePath);
      if (!path.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error('Invalid stored path');
      return readFile(path);
    }));
    return new Response(Buffer.concat(files), { headers: { 'Content-Type': 'video/webm', 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'The saved quiz video is unavailable.' }, { status: 500 });
  }
}
