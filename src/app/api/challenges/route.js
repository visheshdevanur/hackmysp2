import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { challengeForClient } from '@/lib/challenge-data';

const categories = ['technical', 'non-technical'];
const experienceLevels = ['internship', 'entry', 'junior', 'mid', 'senior', 'lead'];
const workModes = ['remote', 'hybrid', 'on-site'];
const employmentTypes = ['full-time', 'part-time', 'contract', 'internship', 'temporary'];
const cleanList = (value, limit = 20) => Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean).slice(0, limit) : [];

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const rows = await prisma.challenge.findMany({ where: { isActive: true }, include: { creator: { select: { companyName: true } }, _count: { select: { credentials: true } } }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(rows.map(challenge => {
    const canSeeKey = user.role === 'reviewer' || (user.role === 'recruiter' && challenge.creatorId === user.id);
    return { ...challengeForClient(challenge, canSeeKey ? user.role : 'student'), companyName: user.role === 'student' ? null : challenge.companyName };
  }));
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'recruiter') return NextResponse.json({ error: 'Recruiter account required.' }, { status: 403 });
  try {
    const body = await request.json();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || '');
    const area = String(body.area || '').trim();
    const experienceLevel = String(body.experienceLevel || '');
    const difficulty = String(body.difficulty || '');
    if (title.length < 6 || title.length > 120 || description.length < 30 || description.length > 8_000 || !categories.includes(category) || !/^[a-z0-9][a-z0-9_-]{1,79}$/i.test(area) || !experienceLevels.includes(experienceLevel) || !['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
      return NextResponse.json({ error: 'Enter a clear job title and description, role type, field/area, experience level, and difficulty.' }, { status: 400 });
    }
    const sessionDurationMinutes = Number(body.sessionDurationMinutes || 60);
    if (!Number.isInteger(sessionDurationMinutes) || sessionDurationMinutes < 15 || sessionDurationMinutes > 180) return NextResponse.json({ error: 'Set a timed recording duration between 15 and 180 minutes.' }, { status: 400 });

    const requirements = cleanList(body.requirements);
    const responsibilities = cleanList(body.responsibilities);
    const preferredSkills = cleanList(body.preferredSkills);
    const workMode = String(body.workMode || 'remote');
    const employmentType = String(body.employmentType || 'full-time');
    if (!responsibilities.length || !requirements.length || !workModes.includes(workMode) || !employmentTypes.includes(employmentType)) return NextResponse.json({ error: 'Add responsibilities and required skills, then choose a valid work mode and employment type.' }, { status: 400 });
    const workLocation = String(body.workLocation || '').trim().slice(0, 200);
    if (workMode !== 'remote' && !workLocation) return NextResponse.json({ error: 'Add a location for hybrid or on-site roles.' }, { status: 400 });
    const salaryMin = body.salaryMin === '' || body.salaryMin == null ? null : Number(body.salaryMin);
    const salaryMax = body.salaryMax === '' || body.salaryMax == null ? null : Number(body.salaryMax);
    if ((salaryMin != null && (!Number.isFinite(salaryMin) || salaryMin < 0)) || (salaryMax != null && (!Number.isFinite(salaryMax) || salaryMax < 0)) || (salaryMin != null && salaryMax != null && salaryMax < salaryMin)) return NextResponse.json({ error: 'Enter a valid optional salary range.' }, { status: 400 });
    const deadline = body.deadline ? new Date(body.deadline) : null;
    if (deadline && !Number.isFinite(deadline.getTime())) return NextResponse.json({ error: 'Enter a valid application deadline.' }, { status: 400 });

    const config = body.priQuestionConfig || {};
    const totalQuestions = Number(config.totalQuestions);
    const evidenceQuestionCount = Number(config.evidenceQuestionCount);
    const jobQuestionCount = Number(config.jobQuestionCount);
    const recruiterQuestionCount = Number(config.recruiterQuestionCount);
    const recruiterQuestions = Array.isArray(config.recruiterQuestions) ? config.recruiterQuestions : [];
    if (!Number.isInteger(totalQuestions) || totalQuestions < 1 || totalQuestions > 50 || [evidenceQuestionCount, jobQuestionCount, recruiterQuestionCount].some(count => !Number.isInteger(count) || count < 0) || evidenceQuestionCount + jobQuestionCount + recruiterQuestionCount !== totalQuestions || recruiterQuestionCount !== recruiterQuestions.length) {
      return NextResponse.json({ error: 'Choose 1–50 PRI questions, allocate all questions to the three sources, and enter the recruiter questions you counted.' }, { status: 400 });
    }
    const normalizedRecruiterQuestions = recruiterQuestions.map(item => ({
      question: String(item.question || '').trim(),
      options: Array.isArray(item.options) ? item.options.map(option => String(option || '').trim()) : [],
      correctIndex: Number(item.correctIndex),
      explanation: String(item.explanation || '').trim().slice(0, 1_000),
    }));
    if (normalizedRecruiterQuestions.some(item => item.question.length < 8 || item.question.length > 800 || item.options.length !== 4 || item.options.some(option => !option || option.length > 300) || new Set(item.options).size !== 4 || !Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 3)) {
      return NextResponse.json({ error: 'Each recruiter question needs text, four distinct options, and one correct answer.' }, { status: 400 });
    }
    if (new Set(normalizedRecruiterQuestions.map(item => item.question.toLocaleLowerCase())).size !== normalizedRecruiterQuestions.length) return NextResponse.json({ error: 'Recruiter-authored question text must be unique.' }, { status: 400 });

    const roleDetails = body.roleDetails && typeof body.roleDetails === 'object' && !Array.isArray(body.roleDetails) ? body.roleDetails : {};
    if (category === 'technical' && !String(roleDetails.technicalSkills || '').trim()) return NextResponse.json({ error: 'Add the main languages, frameworks, or tools for this technical role.' }, { status: 400 });
    if (category === 'non-technical' && !String(roleDetails.domainFocus || '').trim()) return NextResponse.json({ error: 'Add the domain or core workflow for this non-technical role.' }, { status: 400 });
    const jobDetails = {
      category,
      area,
      experienceLevel,
      responsibilities,
      preferredSkills,
      workMode,
      workLocation,
      employmentType,
      qualifications: String(body.qualifications || '').trim().slice(0, 4_000),
      salaryMin,
      salaryMax,
      salaryCurrency: String(body.salaryCurrency || 'INR').slice(0, 3).toUpperCase(),
      roleDetails: Object.fromEntries(Object.entries(roleDetails).map(([key, value]) => [key, String(value || '').trim().slice(0, 2_000)])),
    };
    const priQuestionConfig = { totalQuestions, evidenceQuestionCount, jobQuestionCount, recruiterQuestionCount, recruiterQuestions: normalizedRecruiterQuestions };
    const challenge = await prisma.challenge.create({ data: {
      title, description, role: area, difficulty, requirements: JSON.stringify(requirements), jobDetailsJson: JSON.stringify(jobDetails), priQuestionConfigJson: JSON.stringify(priQuestionConfig),
      sessionDurationMinutes, companyName: user.companyName, creatorId: user.id, deadline,
    } });
    return NextResponse.json(challengeForClient(challenge, 'recruiter'), { status: 201 });
  } catch (error) {
    console.error('Recruiter challenge could not be saved', error);
    return NextResponse.json({ error: 'Could not save challenge. Check the job details and PRI question setup.' }, { status: 400 });
  }
}
