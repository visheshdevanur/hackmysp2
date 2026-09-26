import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const rows = await prisma.challenge.findMany({ where: { isActive: true }, include: { creator: { select: { companyName: true } }, _count: { select: { credentials: true } } }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(rows.map(c => ({ ...c, requirements: JSON.parse(c.requirements || '[]'), companyName: user.role === 'student' ? null : c.companyName })));
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'recruiter') return NextResponse.json({ error: 'Recruiter account required.' }, { status: 403 });
  try {
    const body = await request.json();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (title.length < 6 || description.length < 30 || !['frontend','backend','ml'].includes(body.role) || !['beginner','intermediate','advanced'].includes(body.difficulty)) return NextResponse.json({ error: 'Add a clear title, a 30-character description, role and difficulty.' }, { status: 400 });
    const sessionDurationMinutes = Number(body.sessionDurationMinutes || 60);
    if (!Number.isInteger(sessionDurationMinutes) || sessionDurationMinutes < 15 || sessionDurationMinutes > 180) return NextResponse.json({ error: 'Set a timed recording duration between 15 and 180 minutes.' }, { status: 400 });
    const requirements = Array.isArray(body.requirements) ? body.requirements.map(String).slice(0, 12) : [];
    const challenge = await prisma.challenge.create({ data: { title, description, role: body.role, difficulty: body.difficulty, requirements: JSON.stringify(requirements), sessionDurationMinutes, companyName: user.companyName, creatorId: user.id, deadline: body.deadline ? new Date(body.deadline) : null } });
    return NextResponse.json({ ...challenge, requirements }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Could not save challenge. Check the details and try again.' }, { status: 400 }); }
}
