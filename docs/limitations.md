# Known Limitations & Future Scope

[← Back to README](../README.md)

## What Doesn't Work Yet

| Limitation | Why it exists | Next step |
|---|---|---|
| No cryptographic portable credential or selective disclosure | CodePassport currently reads platform records; its identifier is not an externally verifiable signed credential | Define a threat model and adopt a reviewed credential/signature standard |
| PRI is a fixed formula | The MVP uses hand-set weights and available evidence | Validate the current rubric with real outcomes before considering statistical calibration |
| No hiring-outcome feedback or fairness audit | No 90-day employment outcome dataset or approved demographic audit process exists | Design opt-in, privacy-preserving outcome collection and an independent audit plan |
| GitHub activity is incomplete evidence | Public API data is rate-limited and cannot prove authorship or code quality | Show coverage/limits, support retries, and keep human review central |
| Face detection can fail | Browser camera access and CDN/model availability vary | Bundle and test a dependable model path; always communicate unavailable status clearly |
| Local recording storage is not production storage | Development writes session segments to the app machine | Move to private durable object storage with access controls and deletion/retention policies |
| Database setup artifacts disagree | Current schema is SQLite but checked-in migration lock identifies PostgreSQL | Pick one production database and regenerate/validate migrations before deployment |
| Empty candidate directory when nobody has submitted | Candidate records are based on real registered developer accounts and submissions | Keep the honest empty state; add onboarding and authorized sample data only if the team creates it |

## Edge Cases Not Fully Handled

- GitHub rate limits, inaccessible/deleted repositories, changed visibility, and commits with no matching GitHub username.
- AI timeouts, malformed provider responses, language/model changes, and inconsistent assessment quality.
- Camera permission loss, low light, multiple faces, or face-model download failure; a face signal is not identity proof.
- Collusive reviews, reviewer bias, and identity fraud are not fully prevented by requiring two reviewers.
- Recording privacy, consent withdrawal, retention, and deletion policies need production-level operational controls.
- Simultaneous users, high-volume recruiter search, and interview scheduling across time zones need broader load and usability testing.

## Scaling

| What may become a bottleneck | Why | Next step |
|---|---|---|
| Reviewer throughput | Every verified credential requires two independent reviews | Add workload-aware assignment and reviewer quality monitoring |
| GitHub/Gemini quotas and latency | External services serve analysis and evidence requests | Add bounded queues, caching, retries with backoff, and visible provider status |
| Recording storage and upload bandwidth | Video segments are large and contain personal data | Use private object storage, resumable uploads, and retention/deletion jobs |
| Database consistency during deployment | SQLite schema and PostgreSQL migration metadata currently disagree | Choose and test a single production database path before scaling |

## Roadmap

1. Reconcile and document one production database configuration and secure recording storage.
2. Improve evidence reliability and face-check delivery with graceful, explicit failure states.
3. Validate rubrics and score interpretation with participants and reviewers before adding advanced ranking claims.
4. Add portable, selectively disclosed credentials only after a security review.
