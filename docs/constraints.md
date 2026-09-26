# Trust, Evidence & Assessment Constraints

[← Back to README](../README.md)

The starter template's original constraints describe civic issue reporting. CodeVeritas addresses developer assessment, so this page maps the same concerns—abuse, evidence ambiguity, ranking, invalid input, and connectivity—to the product. Statuses describe implemented behavior, not guarantees.

| # | CodeVeritas constraint | Status | Demo timestamp |
|---|---|---|---|
| 1 | Fake profiles or misleading repository evidence | ⚠️ Partial | Add after recording |
| 2 | Ambiguous attribution and assessment evidence | ⚠️ Partial | Add after recording |
| 3 | Ranking that hides how scores were produced | ⚠️ Partial | Add after recording |
| 4 | Invalid submissions and assessment-integrity events | ⚠️ Partial | Add after recording |
| 5 | Use during network/provider outage | ❌ Not offline-capable | Add after recording |

## 1. Fake Profiles and Misleading Repository Evidence

- Registration and role access are server-side; reviewer/recruiter accounts require configured invitation codes.
- Submissions use public GitHub repositories, and the app stores repository/revision evidence when available. GitHub activity does **not** establish authorship or code quality.
- Two distinct reviewer accounts are required for credential verification. This reduces reliance on one opinion but does not prevent collusion or prove identity.
- **Not implemented:** identity proofing, signed portable credentials, exploit-verified reviews, or automated code execution.
- **Code:** `src/app/api/auth/register/route.js`, `src/app/api/challenges/[id]/submissions/route.js`, `src/app/api/reviews/route.js`.

## 2. Evidence Attribution

- Repository submissions are linked to a GitHub URL; a commit SHA is stored when pinned by the submission workflow. The GitHub timeline is retrieved from public repository data.
- Recorded session, quiz, and speaking evidence are associated with their credential and challenge. Face monitoring reports a face-missing or multiple-face signal; it is not facial recognition and can fail when the model/CDN/camera is unavailable.
- AI reports are generated from bounded submitted evidence and are labeled as support for human review.
- **Known gap:** repository owner identity, actual authorship, and independent authenticity of recordings are not cryptographically established.
- **Code:** `src/app/api/credentials/[id]/timeline/route.js`, `src/app/components/FaceMonitor.jsx`, `src/lib/session-evaluation.js`.

## 3. Ranking and Score Transparency

- PRI uses fixed weights: correctness 40%, independent reviewer score 35%, timeliness 10%, learning velocity 10%, and skill match 5%.
- Reviewers use five rubric dimensions: correctness, code structure, documentation, edge-case handling, and innovation. A credential remains unverified until two different reviewers complete reviews.
- Unverified results are provisional/pending; an empty value means the score is not calculated, not zero ability.
- **Not implemented:** Item Response Theory, adaptive question selection, confidence intervals, outcome-trained ranking, or a demographic fairness audit.
- **Code:** `src/lib/scoring.js`, `src/lib/challenge-scores.js`, `src/app/api/reviews/route.js`.

## 4. Invalid Input and Integrity Events

| Input or event | Current behavior |
|---|---|
| Non-public or malformed repository | Submission/analysis can be rejected or left pending when GitHub cannot verify it; provider errors are surfaced for retry |
| Duplicate assessment/review | Database uniqueness and server-side checks prevent repeated reviewer scoring for the same credential |
| Tab hidden or required capture interrupted during monitored attempts | Quiz/speaking integrity endpoints record events and the attempt workflow can lock/fail it |
| Face missing or multiple faces | Client shows a warning and sends an integrity event when detection is available; provider loading failure is reported as unavailable |
| Abusive recruiter/reviewer activity | Role gates and review workflow exist; a complete abuse reporting/moderation system is not implemented |
| Malicious repository content | The app reads bounded public repository files; it does not execute submitted code. AI output still requires human judgment |

## 5. Connectivity and Provider Outages

- **What works offline:** no full offline workflow is implemented. A browser may retain already-uploaded recording segments on the server, but that does not make the app usable offline.
- **Recovery:** saved sessions can be resumed when the app and network are available; GitHub/Gemini operations can be retried. Retry behavior depends on the relevant provider being reachable.
- **What does not work offline:** sign-in, API/database requests, repository analysis, quiz/speaking generation or submission, and recruiter/reviewer actions.
- **Test:** disconnect the network during a test account session and confirm the UI reports failures rather than claiming a saved analysis. Do not use a real candidate recording for this test.
