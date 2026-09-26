# CodeVeritas

CodeVeritas is an account-backed developer verification platform. It uses a local SQLite database for development; users, challenges, submissions, reviews and GitHub analyses are stored in the database. There are no seeded users or demo credentials.

| Project overview | Submission index | Technical docs | Setup | AI disclosure | Templates |
|---|---|---|---|---|---|
| [Architecture](./docs/architecture.md) · [Constraints](./docs/constraints.md) · [Limitations](./docs/limitations.md) | [Resource index](./resource.md) | [Architecture](./docs/architecture.md) | [Local setup](./docs/setup.md) | [AI usage](./ai.md) | [Resource templates](./resource-templates/) |

**Stack:** Next.js 14, React 18, Prisma, SQLite for local development, GitHub API, and Gemini for repository/video-grounded evaluation.

## Start locally

1. Install Node.js 18 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a private `NEXTAUTH_SECRET`. Keep `.env` local; it contains secrets. Set `DATABASE_URL=file:./dev.db` for local SQLite development.
4. Run `npm run db:generate` and `npx prisma db push`.
5. Run `npm run dev`, then open http://localhost:3000.
6. Register your student account at `/register` and sign in at `/login`.

Local SQLite file: `prisma/dev.db` (ignored by Git). `npm run db:setup` creates an empty database from the checked-in SQL schema and leaves an existing database untouched.

## Three account roles

- **Student**: register directly, submit a public GitHub repository URL against an active challenge, complete its repository-grounded PRI quiz, and earn a credential after two independent reviews.
- **Reviewer**: select Reviewer during registration and supply an invitation code. Review submissions against five weighted rubric dimensions. A reviewer cannot assess their own submission or review it twice.
- **Recruiter**: select Recruiter, enter a company and supply an invitation code. Publish challenges and search students only after they earn verified credentials.

Set `REVIEWER_INVITE_CODE` and `RECRUITER_INVITE_CODE` in `.env` before creating those accounts. These role gates are server-side; choosing a role in the form does not grant access without the matching code. Accounts are not pre-created because no real names, emails or passwords were provided.

## Public repository quiz and AI provider

Recruiters define each job’s technical or non-technical field, experience level, responsibilities, skills, work arrangement, employment details, and optional compensation and qualifications. They configure a PRI quiz of 1–50 questions, allocating each question to GitHub/recording-grounded AI, job/role AI, or a recruiter-authored question with four options and an answer key. Allocations must add up to the total. The server validates recruiter questions and generates only the configured AI groups. Repository-grounded answers cite exact source quotes; timed submissions can also cite observable recording evidence. Questions are shuffled and delivered one at a time. Developers never receive the answer key before completing the quiz; recruiters and reviewers can see the setup and results.

Students submit a public GitHub URL; GitHub OAuth is not required for challenge submissions. The server pins the repository revision and reads a small bounded set of README/source/config/test files without running them. AI-generated-code detection is not performed.

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and add it to the local `.env` file (never commit or paste it into chat):

```env
GEMINI_API_KEY="your-server-side-api-key"
GEMINI_MODEL="gemini-3.5-flash-lite"
GEMINI_FALLBACK_MODEL="gemini-3.1-flash-lite"
```

Gemini 3.5 Flash-Lite supports structured output and currently offers free input and output tokens on the AI Studio free tier, subject to model availability and rate limits. Google states that free-tier content may be used to improve its products, so use this only with public repositories and avoid sending secrets or private source. Paid usage requires a billing-enabled Google project; the app does not enable billing for you. An optional `GITHUB_TOKEN` raises GitHub API rate limits. Restart the dev server after changing `.env`.

The quiz score feeds the existing 40% PRI correctness component, with other weights unchanged. Quiz scores count toward the displayed PRI after the related credential is independently verified. Two human reviews remain required to verify a credential.

PRI quizzes run as monitored attempts: the developer consents to full-monitor screen, camera and microphone recording, then answers one question at a time. The server records per-question elapsed time. Leaving the quiz tab, reloading an active attempt, or stopping required capture immediately fails and locks the attempt; reviewer and recruiter dashboards show the integrity event, timings and saved recording. AI tools are prohibited by the quiz rules. The app detects a browser tab becoming hidden; it cannot detect use of AI on a separate device or prove that no AI assistance occurred.

## Current product behavior

- Passwords are bcrypt-hashed; sessions use signed JWT cookies through NextAuth.
- Challenge, repository submission and reviewer rubric flows persist to SQLite.
- Public CodePassport and credential verification pages query persisted records.
- A credential is marked verified after two distinct reviewer accounts submit scores.
- CodePrint activity indicators are derived from GitHub repositories, languages and commit history. They are behavioral observations, not code-quality claims.
- The PRI formula is shown with component weights. The repository quiz measures project understanding, not AI authorship or automated test correctness.
- Empty accounts show empty states. There are no invented users, candidates, challenges or scores.

## Production deployment

Before a public launch, configure a PostgreSQL `DATABASE_URL`, create a production GitHub OAuth app, set a private `NEXTAUTH_SECRET` and invitation codes, run `npx prisma migrate deploy`, and deploy behind HTTPS. Update the datasource provider and generate a PostgreSQL migration when moving off local SQLite. Email verification, password recovery, rate limiting, automated test execution and production reviewer assignment still need to be configured before opening registration broadly.

## Solo timed challenge sessions

Recruiters can publish challenges with a 15–180 minute limit. A developer can start the optional solo session from the challenge card, explicitly consent, and share a screen with camera and microphone. The browser saves recording segments continuously to `storage/session-recordings/`; closing the tab, signing out, pausing capture, or losing the shared screen pauses the timer and keeps the uploaded segments. Resuming the same challenge continues from saved elapsed time. Submitting a public GitHub URL sends the repository source plus recorded segments to Gemini for an evidence-grounded coaching report and PRI quiz. AI tools are permitted; the feature does not assess AI authorship. Recruiters can open submissions from their challenge card; reviewers can see recordings in the review queue. AI reports support human review and do not make hiring decisions.

Recording requires a browser with `getDisplayMedia`, `MediaRecorder`, camera, and microphone access (latest Chrome/Edge recommended). Keep `GEMINI_API_KEY` server-side; set `GEMINI_VIDEO_MODEL=gemini-3.5-flash-lite` if you want to override the default. Gemini free-tier model availability and rate limits can change. The recording files are stored on the application server's local disk in development. A multi-instance production deployment must use durable private object storage and configure retention/deletion policies before launch; recordings contain sensitive personal data. Participants must provide explicit consent before capture.

PRI quiz recordings are stored in `storage/session-recordings/pri-quiz/` in development and are served only to the candidate, the challenge's recruiter, or a reviewer account. Deployments should migrate these files to private durable storage and define retention/deletion policies before recording real candidates.

## Monitored speaking round

After a completed PRI quiz, candidates have up to seven minutes for a recorded speaking round. Gemini generates a role/job-description question, followed by a company-contribution question. Candidates answer aloud, select Ask next question, then Submit. Screen, camera and microphone recordings are sent to Gemini for transcription and assessment of role knowledge, relevance, clarity and organization. The developer, reviewer and challenge recruiter can view the transcript, scores, timings and recordings. Switching away from the tab or interrupting capture automatically locks the attempt. AI tools are prohibited; the app cannot detect assistance from a separate device. Candidate consent is required before recording.

