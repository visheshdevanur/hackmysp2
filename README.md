# CodeVeritas — Evidence-backed developer credentials

> HackMysuru submission · Team **Code Breakers** · Team ID **TEAM-CB001**

| Submission guide | Details |
|---|---|
| Submission index | [resource.md](./resource.md) |
| AI disclosure | [ai.md](./ai.md) |
| Architecture | [docs/architecture.md](./docs/architecture.md) |
| Trust and evidence constraints | [docs/constraints.md](./docs/constraints.md) |
| Setup and run | [docs/setup.md](./docs/setup.md) |
| Limitations and roadmap | [docs/limitations.md](./docs/limitations.md) |
| Presentation, video, decision log guides | [resource-templates/](./resource-templates/) |

## 1. Problem Understanding

**Chosen sub-problem:** Trustworthy verification of practical software engineering skills.

Hiring teams often have to infer practical ability from self-reported résumés, interviews, and disconnected project links. Candidates need a way to show work with context; reviewers and recruiters need evidence they can inspect and compare.

The product addresses this by tying challenge results to a public repository, a recorded work session, a repository-grounded quiz, a speaking assessment, and independent human reviews. It does not claim to prove who authored every line of code.

## 2. Target Users & Context

| User | Situation | Need |
|---|---|---|
| Developer applying for a role | Has projects and challenge work spread across repositories and applications | A shareable, evidence-linked record of completed challenges and assessments |
| Independent reviewer | Must assess a submission consistently and avoid conflicts | A review queue, common rubric, repository/session context, and clear evidence |
| Recruiter | Needs to find candidates for a role and compare relevant work | Candidate profiles, challenge scores, CodePassports, comparisons, and interview scheduling |

The current MVP is a web application. It assumes a supported desktop browser and an internet connection for account, GitHub, AI, and recording workflows. A Mysuru-specific hiring pilot and local user research have not yet been conducted.

## 3. Solution Overview

CodeVeritas turns challenge participation into a reviewable technical profile. Recruiters publish role-specific challenges; developers submit public repositories and can complete recorded work, repository understanding, and speaking assessments; independent reviewers score submissions; verified results appear in a shareable CodePassport.

Core flow:

1. Recruiter publishes a role-specific challenge and configures its PRI question sources.
2. Developer submits a public GitHub repository and, optionally, completes the timed recorded challenge.
3. The platform collects repository and assessment evidence; AI generates evidence-grounded analysis and quiz questions where configured.
4. Two distinct reviewers assess the submission with the shared rubric.
5. The verified credential and available scores appear in the developer’s CodePassport and recruiter discovery views.

Screenshots: add 2–4 real screenshots to [`docs/images/`](./docs/images/) and caption what each demonstrates. No demo screenshots are committed yet.

## 4. Architecture

Next.js serves the authenticated web application and API routes. Prisma persists accounts, challenges, submissions, reviews, assessments, and interview invitations. GitHub’s API supplies public repository activity; Gemini provides configured repository, recording, quiz, and speaking analysis.

See [the architecture document](./docs/architecture.md) for the diagram, data model, APIs, and data flow.

## 5. Tech Stack & AI Usage

**Stack:** Next.js 14, React 18, Prisma, SQLite for the current local configuration, GitHub REST API, and Google Gemini API. The project also contains a PostgreSQL migration artifact; see the database configuration note in [setup](./docs/setup.md) before using migrations or changing deployment databases.

AI tools were used during development. At runtime, Gemini analyzes configured repository and recording evidence and can generate challenge quiz and speaking prompts. In-browser face presence checks use MediaPipe Tasks Vision when the model and CDN are reachable. AI output supports human review and does not make a hiring decision. Full disclosure is in [ai.md](./ai.md).

## 6. Decision Log (Summary)

- **Chosen:** Connect scores to concrete challenge, repository, recording, and reviewer evidence.
- **Alternative considered:** Rank candidates from profile claims or activity counts alone.
- **Trade-off:** Evidence takes longer to collect and requires reviewer effort, but each result has inspectable context. Public GitHub activity is treated as an activity signal, not proof of code quality or authorship.
- **First scaling pressure:** Reviewer throughput and AI/GitHub provider quotas; the current app has no queueing or service-level guarantees.

See [resource.md](./resource.md) for the submission index and [resource-templates/decision-log-template.md](./resource-templates/decision-log-template.md) for the full decision-log format.

## 7. Setup & Run

```bash
git clone https://github.com/visheshdevanur/hackmysp2.git
cd hackmysp2
npm install
```

Copy `.env.example` to `.env`, add a private `NEXTAUTH_SECRET` and `GEMINI_API_KEY`, then run:

```bash
npm run db:generate
npm run db:setup
npm run dev
```

Open `http://localhost:3000`. More details and environment variables are in [docs/setup.md](./docs/setup.md). There are no seeded demo accounts; register accounts with the appropriate invitation codes for reviewer or recruiter roles.

## 8. Known Limitations

- A credential requires two distinct human reviews; results remain pending until then.
- PRI is a fixed weighted formula, not an adaptive skill model. It has no uncertainty interval or fairness audit.
- GitHub activity and AI analysis are evidence signals, not proof of authorship, code correctness, or job performance.
- The application requires network access. Recording uploads use local disk in development; production needs durable private object storage and retention controls.

See [docs/limitations.md](./docs/limitations.md) for edge cases and next steps.

## Team

| Name | Role | GitHub |
|---|---|---|
| Bhavish S | Team member | [@Bhavish-S](https://github.com/Bhavish-S) |
| Vishesh G Devanur | Team member | [@visheshdevanur](https://github.com/visheshdevanur) |
| Varshith V | Team member | [@4mh24cs167-tech](https://github.com/4mh24cs167-tech) |
| Yashavanth B N | Team member | [@bnyashavanth-pro](https://github.com/bnyashavanth-pro) |

**Program/year:** All listed members are in 3rd year.

**College:** Maharaja Institute of Technology Mysore.

## License

No license has been selected yet. All rights remain with the project owners unless a license is added.
