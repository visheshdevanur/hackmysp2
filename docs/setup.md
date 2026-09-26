# Setup & Run Instructions

[← Back to README](../README.md)

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18 or later |
| npm | Included with Node.js |

## 1. Clone

```bash
git clone https://github.com/visheshdevanur/hackmysp2.git
cd hackmysp2
```

## 2. Environment Variables

Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`). Keep `.env` private and never commit real keys.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Current Prisma schema uses a local SQLite URL; the checked-in migration metadata says PostgreSQL and must be reconciled before using migrations or production PostgreSQL |
| `NEXTAUTH_URL` | Yes for local auth | Set to the local app URL, normally `http://localhost:3000` (match the port you run) |
| `NEXTAUTH_SECRET` | Yes | Signs authentication session tokens; generate a private random value |
| `GEMINI_API_KEY` | For AI features | Server-side key for configured Gemini evaluation and question generation |
| `GITHUB_TOKEN` | Optional | Raises GitHub REST API rate limits for public repository reads |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Only if GitHub OAuth is enabled | GitHub sign-in integration |
| `REVIEWER_INVITE_CODE`, `RECRUITER_INVITE_CODE` | To create those roles | Invitation gates for reviewer and recruiter registration |

The `.env.example` currently uses `DATABASE_URL="file:./dev.db"`. The Prisma schema declares SQLite while `prisma/migrations/migration_lock.toml` declares PostgreSQL. For the checked-in local setup, use `npm run db:setup` (`prisma db push`) rather than `prisma migrate deploy`. Reconcile the schema/provider and migrations before production deployment.

## 3. Install and Initialize the Local Database

```bash
npm install
npm run db:generate
npm run db:setup
```

There is no seed script and no shared demo account. Register a developer account; configure invitation codes in `.env` before registering reviewer or recruiter accounts.

## 4. Run

```bash
npm run dev
```

Open `http://localhost:3000`. If that port is busy, stop the existing dev server or start Next.js on another port and update `NEXTAUTH_URL` to match.

## Testing the Main Flow

1. Register a developer and a recruiter (set `RECRUITER_INVITE_CODE` first).
2. As the recruiter, publish a challenge and configure its question sources.
3. As the developer, submit a public GitHub repository. For a timed challenge, grant browser screen, camera, and microphone permissions and accept the recording notice.
4. Complete available quiz and speaking steps; review the submission from two separate reviewer accounts after setting `REVIEWER_INVITE_CODE`.
5. Inspect the developer's scores and CodePassport, then use recruiter Discover Talent.

This application has no offline mode. For provider outage behavior, see [constraints.md](./constraints.md#5-connectivity-and-provider-outages).

## Troubleshooting

| Problem | Fix |
|---|---|
| Port already in use | Stop the process using the port or use `npm run dev -- -p 3001`; set `NEXTAUTH_URL=http://localhost:3001` to match |
| Prisma cannot connect or schema validation fails | Confirm `DATABASE_URL`, run `npm run db:generate`, then `npm run db:setup`; do not run the PostgreSQL migration against the SQLite schema |
| GitHub analysis is rate-limited | Wait for the limit to reset or add a valid `GITHUB_TOKEN` in `.env` and restart the server |
| Gemini analysis cannot finish | Confirm `GEMINI_API_KEY`, model availability, network access, and provider quota; saved submissions can be retried |
| Camera or face check unavailable | Allow browser camera/microphone permissions; face check also needs the MediaPipe CDN/model to load. Recording and face checking are separate status signals |
