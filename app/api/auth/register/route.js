import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(request) {
  try {
    const { name, email, password, role = 'student', inviteCode, companyName } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || String(password || '').length < 10) return NextResponse.json({ error: 'Enter your name, a valid email, and a password with at least 10 characters.' }, { status: 400 });
    if (!['student', 'reviewer', 'recruiter'].includes(role)) return NextResponse.json({ error: 'Choose a valid account role.' }, { status: 400 });
    if (role !== 'student') {
      const expected = role === 'reviewer' ? process.env.REVIEWER_INVITE_CODE : process.env.RECRUITER_INVITE_CODE;
      if (!expected || inviteCode !== expected) return NextResponse.json({ error: `${role === 'reviewer' ? 'Reviewer' : 'Recruiter'} accounts require a valid invitation code from your organization.` }, { status: 403 });
    }
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 409 });
    if (role === 'recruiter' && !String(companyName || '').trim()) return NextResponse.json({ error: 'Enter your company name.' }, { status: 400 });
    const user = await prisma.user.create({ data: { name: name.trim(), email: normalizedEmail, passwordHash: await hash(password, 12), role, ...(role === 'recruiter' ? { companyName: companyName.trim() } : {}) } });
    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (error) {
    console.error('Account registration failed', error);
    return NextResponse.json({ error: 'We could not create your account. Please try again.' }, { status: 500 });
  }
}
