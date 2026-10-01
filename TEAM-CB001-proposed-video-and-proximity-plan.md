# CodeVeritas — HackMysuru Video and Proximity Sentinel Proposal

**Status:** Proposal and recording plan only. Proximity Sentinel is not implemented by this document. No application code, AI pipeline, database, assessment flow, or architecture is changed by this plan.

| Submission detail | Value |
|---|---|
| Team | Code Breakers |
| Team ID | `TEAM-CB001` |
| College | Maharaja Institute of Technology Mysore |
| Members | Bhavish S, Vishesh G Devanur, Varshith V, Yashavanth B N |
| Year | All members are in 3rd year |
| Video target | 9:45, one continuous recording, maximum 10:00 |
| Proposed artifact name | `TEAM-CB001_video.mp4` |

> **Scope distinction:** The HackMysuru video guide and the attached Proximity Sentinel brief are planning inputs. Existing CodeVeritas capabilities below are summarized from the repository documentation. Proximity Sentinel is a separate proposed subsystem and must be described as future work unless it is implemented and verified before recording.

## 1. Goals

This plan has two purposes:

1. Prepare a judge-facing video that demonstrates CodeVeritas honestly and meets the HackMysuru format.
2. Record a future proposal for **Proximity Sentinel**, a consent-based, platform-aware environmental evidence subsystem, without suggesting it already exists.

The video should communicate the problem, show the real product, explain the architecture and trade-offs, and show that the team understands the limits of its evidence. It should not imply that automated scores prove authorship, identity, cheating, or job performance.

## 2. Hackathon video requirements

According to `resource-templates/video-guide.md`:

- Submit one continuous MP4 no longer than 10 minutes, named `<TeamID>_video.mp4`.
- Part 1, pitch and product demo, should be 2–3 minutes.
- Part 2, code and system design, should be 5–7 minutes.
- Show the actual running product. Slides are allowed only for the architecture diagram.
- Every registered team member must speak in at least one segment.
- 1080p is preferred and 720p is the minimum; use an IDE font of at least 16 pt or 125% zoom, clear audio, and no music under speech.
- Speak in English. Kannada may appear in the product if explained in English.
- Include a bad-input demonstration and an offline/network behavior segment. The guide treats both as mandatory.
- Upload to Drive with “Anyone with the link” viewer access, verify playback in an incognito window, then record the link, chapter timestamps, and SHA-256 in `resource.md`.

The guide’s sample demo describes civic reports, routing, ward staff, fake photos, and offline synchronization. Those are not CodeVeritas features. This plan adapts the requested demonstrations to the actual developer-assessment platform and requires the team to state honestly that full offline use and offline synchronization are not implemented.

## 3. CodeVeritas product facts to use in the video

### 3.1 Product and users

CodeVeritas addresses trustworthy verification of practical software-engineering skills. Its users are:

- **Developer:** submits a public repository and may complete applicable recorded work, repository quiz, and speaking assessments.
- **Reviewer:** reviews a credential with a shared rubric. Two distinct reviews are required for verification.
- **Recruiter:** creates role-specific challenges and discovers or compares developer profiles and credentials.

### 3.2 Current documented workflow

1. A recruiter creates a role-specific challenge and configures its PRI question sources.
2. A developer submits a public GitHub repository. A timed recorded session may also be part of the challenge.
3. The platform collects repository and assessment evidence. Gemini provides configured repository/session analysis and assessment support; quiz and speaking activities are separate assessment stages.
4. Two different reviewer accounts submit rubric reviews.
5. Persisted assessment and review records determine verification and displayed PRI state. Verified evidence can appear in the developer’s CodePassport and recruiter views.

If GitHub or Gemini is unavailable, the submission may still be saved while analysis remains incomplete or pending. The UI provides retry states where available; the video must show actual behavior and must not call a failed or pending analysis successful.

### 3.3 Claims and limitations

- GitHub activity is an activity signal. It does not establish authorship or code quality.
- Gemini output is supporting evidence for human review. It is not a final hiring decision or AI-authorship detector.
- MediaPipe face checks are a browser-side face-presence/count signal where available. They are not identity recognition or proof of who is taking the assessment. If model loading fails, show unavailable rather than a successful check.
- The current web application requires network access for authentication, API/database operations, GitHub, Gemini, and assessment workflows. No full offline queue/sync is implemented.
- Recording storage is local in the development setup. Do not imply that production storage, retention controls, load testing, or a hosted deployment has been verified.
- The documented local database schema uses SQLite, while migration metadata has a PostgreSQL mismatch; do not present a production database architecture as settled.
- PRI uses fixed weighted dimensions in the current docs: correctness 40%, independent reviewer score 35%, timeliness 10%, learning velocity 10%, and skill match 5%. It is not an outcome-trained hiring model.

### 3.4 Product walkthrough paths

Use the current application and accounts that the team has privately prepared. Do not put passwords, API keys, candidate recordings, or private answers on screen.

Recommended walk-through:

1. Recruiter view: open a role-specific challenge and show its published/configured state, if available in the prepared data.
2. Developer view: open the challenge, show a real repository submission and current review/assessment status.
3. Show the relevant assessment evidence and whether the state is pending, provisional, failed, or complete. Do not assume a result is verified.
4. Reviewer view: show the rubric/review queue and, if prepared, two independent reviews submitted by separate reviewer accounts.
5. Open the resulting CodePassport only if actual records show verified evidence. Otherwise show the honest pending/empty state and explain what is needed for verification.
6. Recruiter discovery: show the candidate profile/CodePassport view only with accounts and sample data approved for the demo.

**Pre-recording verification:** The repository README lists `http://localhost:3000` as its default setup URL, while the current team screenshots and `resource.md` show port `3001`. Confirm which port the prepared app actually uses on recording day; do not hard-code an unverified URL in narration.

## 4. Video run of show — target 9:45

The target leaves 15 seconds below the 10-minute cap. Keep each segment within its window; if a live operation is slow, explain the real pending state and continue without cutting around the failure.

| Time | Segment | Speaker | Screen / demo action | Narration points |
|---|---|---|---|---|
| 00:00–00:20 | Hook and problem | Bhavish S | Start on the real CodeVeritas app or a restrained title card, then move to the product. | Introduce Code Breakers, `TEAM-CB001`, and the problem: hiring teams need inspectable evidence of practical developer skills, not unsupported profile claims. Use a Mysuru hiring/applicant scenario, not a civic complaint scenario. |
| 00:20–00:40 | Who it serves | Varshith V | Show the developer, reviewer, and recruiter entry points or dashboards. | Explain each role and its need. Mention that accounts, GitHub evidence, and configured AI/provider operations depend on the network. Do not claim offline participation. |
| 00:40–01:50 | Live core flow | Vishesh G Devanur | Walk the real prepared flow through recruiter challenge, developer submission/evidence, review state, and CodePassport/recruiter view as records permit. | Explain what is submitted, what evidence is collected, how independent reviews affect verification, and which states are provisional. Do not invent instant completion or show a credential as verified unless the data confirms it. |
| 01:50–02:30 | Bad-input / failure test | Bhavish S | Use a safe test account and a malformed, inaccessible, or non-public repository URL, or a real provider/network failure already verified by the team. | Show the actual validation/error/pending state, what was saved, and any real retry path. Do not expose secrets or claim an invalid submission was accepted if it was not. |
| 02:30–03:00 | Offline behavior | Yashavanth B N | If safe, use a test account to demonstrate a network-dependent operation becoming unavailable. Restore the network and show only actual recovery behavior. | State plainly: the current application has no full offline workflow or offline queue/sync. A recording segment already uploaded to the server may remain available, but that is not offline app functionality. If a test risks losing data, narrate the documented limitation instead of staging it. |
| 03:00–04:30 | Architecture | Varshith V | Show `docs/architecture.md`’s diagram. Trace one request through the browser, Next.js route handler, Prisma persistence, and applicable GitHub/Gemini service. | Name only repository components. Clarify that session capture is consent-based and stored locally in the development setup. Mention that provider failures can leave a saved submission pending. |
| 04:30–05:30 | Data model and APIs | Yashavanth B N | Open `prisma/schema.prisma` and 2–3 actual route files. Suggested entities: `User`, `Challenge`, `Credential`, `Review`, `WorkSession`. | Explain relationships and how a credential links a developer, challenge, repository, assessments, and reviews. Verify endpoint paths from the live code before naming them. |
| 05:30–07:30 | Core logic in IDE | Vishesh G Devanur | Open `src/lib/scoring.js`, `src/lib/challenge-scores.js`, and one relevant assessment or review route. | Explain fixed score weights, pending/provisional values, and two distinct reviewers. Explain only the logic visible in the code. Do not claim the score predicts job performance or proves authorship. |
| 07:30–08:30 | Decision and trade-offs | Bhavish S | Show the submitted Decision Log PDF or its matching source notes. | Match the chosen approach, rejected alternative, and accepted cost exactly to the final PDF. Use the team’s current decision log, not a draft in this plan. |
| 08:30–09:15 | Scale and limits | Varshith V | Show the relevant limitations/scaling notes; keep any estimates labeled. | Cover documented bottlenecks: two-reviewer throughput, GitHub/Gemini quotas and latency, local recording storage, and unresolved database deployment configuration. Do not claim load-test results. |
| 09:15–09:45 | AI use and ownership | Yashavanth B N | Open `ai.md` and one AI-assisted file that the speaker understands. | Disclose actual tools used by the team and configured runtime use. Explain what a human checked. NotebookLM is being used to prepare this video; if the hackathon requires disclosure of presentation tools, identify it as video/script assistance, not as an application runtime model or proof of code correctness. |
| 09:45–10:00 | Buffer | Any speaker | Finish the current thought, show project/repository identity, then stop recording. | Do not add a new feature claim. End before the 10:00 limit. |

### 4.1 Short sample language (adapt naturally; don’t read word-for-word)

- **Problem:** “We’re Code Breakers, Team `TEAM-CB001`. CodeVeritas helps a developer show challenge work with evidence that a reviewer can inspect.”
- **Evidence:** “Repository activity is useful context, but it cannot prove who wrote each line. That’s why review and assessment evidence are shown alongside it.”
- **Review state:** “This result is still provisional because the required independent reviews are not complete.”
- **AI:** “Gemini supports configured analysis. It can be wrong or unavailable, so the output remains evidence for human review; it doesn’t make the hiring decision.”
- **Offline:** “This build requires a network for its application and provider workflows. It does not currently provide an offline queue or automatic sync.”

Treat these as example phrasing, not verified narration. Replace any sentence that does not match the running build.

## 5. Demo preparation and recording procedure

### 5.1 Before recording

1. Read this plan together and assign one operator to control the browser/IDE while the named speaker talks.
2. Choose a safe test account and non-sensitive sample repository. Confirm the repository is public and the prepared data is suitable for judges.
3. Confirm required local services, environment variables, camera, microphone, GitHub access, Gemini access, and database are working. Never show `.env` or credentials.
4. Confirm the final product URL/port from the running app. Current repository material conflicts between port 3000 and 3001.
5. Prepare browser tabs and IDE files in advance. Close personal email, API-key pages, unrelated tabs, notifications, and private candidate data.
6. Open the architecture diagram, schema, relevant API routes, scoring code, `ai.md`, limitations, and final Decision Log so the speakers can navigate directly.
7. Verify the failure demonstration and offline behavior on disposable/test data before recording. Do not intentionally break production or alter assessment records.
8. Reconcile `ai.md`’s placeholders: the current disclosure still says to add team tools/handles. Every member must confirm actual tools, models, uses, and human verification. Do not guess a tool or code percentage.
9. Confirm whether the final Decision Log matches the decision details spoken. This repository contains `TEAM-CB001_decision-log.pdf`; read the final PDF itself before recording exact numbers or accepted trade-offs.
10. Run one full rehearsal with a timer. This rehearsal is not the submitted video and may be paused; the final take must remain continuous.

### 5.2 Recording setup

- Capture at 1080p where practical, otherwise at least 720p.
- Set IDE zoom to at least 125% / 16 pt equivalent; test readability in the recorded output.
- Use a small face-camera overlay where it does not obscure important UI.
- Use a quiet room, clear microphone level, and no music under speech.
- Keep the browser and IDE at a stable zoom; avoid showing browser password managers or saved credentials.
- Start recording before the first title/intro and stop after the final screen. Do not splice around app errors or hide the actual state.
- If a live API call takes time, narrate what the current status means. Do not pretend it completed.

### 5.3 After recording and submission

1. Confirm the video duration is at or below 10:00 and that the pitch precedes code/system design.
2. Check that all four members speak and that bad-input and offline/network behavior are addressed.
3. Watch the entire recording once. Confirm text and narration are understandable and no secrets/private data appear.
4. Save as `TEAM-CB001_video.mp4`.
5. Upload the MP4 to the organizer-approved Google Drive location and set “Anyone with the link” to Viewer if that is the required setting.
6. Test the link in an incognito/private browser window, including playback after Drive processing.
7. Add the final video link, verified chapter timestamps, and SHA-256 checksum to `resource.md`. Compute the checksum from the final uploaded artifact and recompute it if the file changes.

## 6. Proximity Sentinel — proposed subsystem only

### 6.1 Proposal status and boundary

**Proximity Sentinel is a future proposal based on the team-provided brief. It is not part of the current CodeVeritas implementation and must not be demonstrated or described as available.** It should be considered only as a separately approved future subsystem. This document does not authorize building it or changing current AI, computer-vision, recording, assessment, or review workflows.

Proposed purpose: observe supported wireless/network environment changes around a candidate’s assessment device and present privacy-minimized, time-based evidence to authorized reviewers. Wireless signals are noisy; the subsystem must not assert exact physical distance, identity, or cheating from an observation.

### 6.2 Proposed components

The supplied brief proposes:

1. **Web Assessment:** existing web assessment UI, with any new integration subject to a separate product/security design.
2. **Native Integrity Agent:** a separately installed desktop component for OS-level observations. Preferred proposal stack: Tauri, Rust, and TypeScript/React.
3. **Proximity Sentinel:** OS-specific Bluetooth/BLE, Wi-Fi, cellular-capability, and network-interface observation modules; signal filtering, calibration, baseline comparison, and temporal correlation.
4. **Integrity Backend:** authenticated event ingestion, append-only hash-linked event record, session sealing, permissions, and reviewer evidence view.

The brief suggests WebSocket for agent-to-app communication and HTTPS for backend requests. These are proposed technologies; a threat model, authentication design, and implementation feasibility review are required before adoption.

### 6.3 Proposed observations and data structures

#### Bluetooth/BLE

Where the operating system and permissions support scanning, collect only the observations required for an assessment: event/session identifiers, timestamp, privacy-safe device identifier, RSSI sample, optional manufacturer data where justified, and first-/last-seen times. Never expose raw MAC addresses to recruiters. The Windows brief names `BluetoothLEAdvertisementWatcher`; other platforms require separate capability checks and implementation.

#### Wi-Fi

Where OS APIs permit it, observe signal and connection changes such as RSSI, frequency/channel, connection status, first/last seen, and a privacy-safe network identifier. SSID/BSSID collection must be minimized and justified; use a hash/pseudonymous identifier where possible. Never infer exact AP distance from RSSI.

#### Cellular and network interfaces

Report only states exposed by the OS: cellular unavailable/present-inactive/active/unknown, Wi-Fi or Ethernet connection changes, interface added/removed, and default-route changes. Do not claim cellular towers locate nearby phones.

#### Event examples from the brief

- `BluetoothObservation`: session/event IDs, timestamp, pseudonymous device hash, RSSI, optional manufacturer value, first-seen and last-seen times.
- `WifiObservation`: session/timestamp, pseudonymous network hash, RSSI, frequency, connection flag.
- `IntegrityCorrelation`: correlation/session IDs, related event IDs, time window, confidence, risk level, and plain-language explanation.
- `IntegrityReceipt`: session ID, event count, first hash, final hash, and sealed timestamp.

These are conceptual schemas only. Final fields, retention, access, and database design require privacy/security review.

### 6.4 Proximity estimate and calibration

The proposed buckets are configurable labels, not guaranteed physical distances:

| Approximate reference range in brief | Label |
|---|---|
| 0–1 m | `VERY_CLOSE` |
| 1–3 m | `CLOSE` |
| 3–5 m | `NEAR` |
| 5 m+ | `FAR_OR_UNKNOWN` |

User-facing language must say **estimated proximity**. A result may include a bucket, confidence, smoothed RSSI, and sample count, but never present a precise meter value unless an actual supported ranging technology provides it.

Proposed signal handling:

1. Collect a window of readings rather than classify a single RSSI sample.
2. Apply median/rolling-window filtering, optional mode, exponential smoothing, and outlier rejection.
3. Use a configurable profile keyed by device model, radio type, environment, reference RSSI, and calibration date.
4. Mark classification unknown or low-confidence when readings are sparse, unstable, unsupported, or uncalibrated.
5. Make calibration an administrator-controlled, documented procedure. A threshold measured on one laptop/radio must not be assumed valid for another.

Confidence should be based on configurable persistence and data quality. The supplied example (one observation low; ten over 30 seconds medium; thirty stable over 90 seconds high) is an initial proposal, not validated certainty. Validate it with controlled false-positive testing before any policy use.

### 6.5 Baseline, drift, correlation, and policy

At assessment start, the proposal records an immutable, privacy-minimized environment baseline and a baseline hash. Later observations are compared to it for events such as a new device, transient device, network change, or signal stabilization.

The correlation engine may group Bluetooth, Wi-Fi, cellular, peripheral, network, assessment-focus, and submission-behavior events within a time window. It should report what changed, when, the supporting event references, confidence, and an explanation. Example: “A new wireless observation persisted during a network transition.”

It must never state “Candidate cheated.” Wireless/environment events are evidence for a human, not proof of intent or misconduct.

Proposed configurable policy outcomes:

- `NORMAL`
- `NOTICE`
- `WARNING`
- `HIGH_RISK`
- `MANUAL_REVIEW`

Proposed flags include warning on a new Bluetooth observation, unexpected network change, cellular activation, new peripheral, unstable session, or disconnected agent. Do not automatically disqualify a candidate because Bluetooth is detected. Administrators must define and document what each outcome means; candidates need clear notice and an appeal/review path before any consequential use.

### 6.6 Proposed user experience

#### Candidate consent and capability check

Before an assessment, explain what the native agent observes, why it is collected, who can see it, when collection starts/stops, how long it is retained, and how to withdraw/raise a concern. Request only required OS permissions. Show a capability matrix with explicit statuses:

- `SUPPORTED`
- `UNSUPPORTED`
- `PERMISSION_DENIED`
- `RESTRICTED`
- `ERROR`

Never silently simulate a real device capability. If a module cannot run, show unavailable and let the assessment policy handle that state transparently.

#### Reviewer view

Proposed dashboard elements:

- Environment status cards such as Bluetooth estimated bucket, Wi-Fi signal bucket, cellular state, and agent connection state.
- A baseline-versus-current summary.
- A chronological proximity/integrity timeline with timestamps and event explanations.
- An abstract proximity diagram with circles/buckets only; no fake GPS-style precision.
- Risk label and confidence with supporting evidence references and capability warnings.
- Clear labels for simulated/demo events versus real observations.

#### Candidate view

Show active monitoring state, agent connectivity, permission/capability issues, warnings, and a clear pause/stop/help path consistent with assessment policy. Do not hide collection in the background.

### 6.7 Proposed integrity event log

The brief proposes an append-only event chain. For each canonicalized event, compute a SHA-256 hash over the prior event hash plus the canonical event payload. At session end, seal an integrity receipt containing session ID, event count, first hash, final hash, and sealed time.

This can make post-hoc alteration detectable only if canonicalization, key/session binding, ingestion authorization, concurrency, replay handling, and storage controls are correctly designed. A hash chain alone does not prove that an observation is true, that the candidate generated it, or that an event source was uncompromised. Include event authentication, duplicate/replay handling, secure agent pairing, clock/timestamp policy, and integrity verification in the eventual design review.

### 6.8 Platform support proposal

| Platform | Bluetooth | Wi-Fi | Cellular/network |
|---|---|---|---|
| Windows | Proposed BLE advertisement watcher where supported and permitted | OS/adapter API dependent | Cellular conditional; interface and route observations subject to OS support |
| macOS | Platform and permission dependent | Platform restricted; confirm permitted APIs | Cellular conditional; interface/route support must be verified |
| Linux | BlueZ and adapter dependent | NetworkManager/driver/API dependent | Hardware/API dependent |

Every individual capability must return an explicit status. The table is a feasibility target, not a claim of current or guaranteed compatibility. Maintain a tested OS/version/adapter matrix after implementation.

### 6.9 Demo simulator proposal

For judge demonstrations, a clearly labeled simulator may emit synthetic events for:

- Bluetooth device appears/disappears.
- RSSI fluctuation and stabilization.
- Wi-Fi/network change.
- Cellular state transition.
- Agent disconnect/reconnect.

The proposed animation is: `BASELINE → NEW OBSERVATION → SIGNAL FILTERING → PROXIMITY BUCKET → CORRELATION → HUMAN REVIEW`.

Every simulated event must be visually marked **SIMULATED** and must never enter real assessment evidence as though it came from an OS scanner. If Proximity Sentinel is not implemented, do not include simulator screens in the CodeVeritas product demo; describe this section only as future scope.

### 6.10 Privacy, safety, and review gates

Before implementation or candidate use, the team should complete:

1. Data minimization review: collect no microphone, passwords, arbitrary files, or unrelated app content for this subsystem.
2. Consent and notice review, including purpose, access, retention, deletion, and withdrawal.
3. Threat model for native-agent installation, pairing, event spoofing/replay, local storage, transport, backend authorization, and reviewer access.
4. OS permission and distribution review for each supported platform.
5. False-positive and calibration evaluation across adapters, device models, rooms, distance/orientation, interference, and ordinary peripherals.
6. Human review and appeal policy; no automatic disqualification from proximity or wireless presence alone.
7. Retention and deletion controls for raw readings, derived events, logs, and receipts.
8. Accessibility review and behavior when a candidate cannot or does not wish to grant a capability.

The brief says “privacy-preserving” and “integrity”; those labels do not replace these reviews or prove compliance.

### 6.11 Proposed test plan

The supplied brief asks for automated unit and integration coverage for:

- Bluetooth unsupported/unavailable, permission denied, device appears/disappears.
- Stable, fluctuating, sparse, and outlier RSSI samples.
- Calibration absent, wrong device profile, and environment changes.
- Wi-Fi change/unavailable and cellular unavailable/activation.
- Agent disconnect/reconnect and unsupported operating system.
- Duplicate/replayed/forged events, corrupted baseline, invalid hash chain, and failed seal verification.
- Correlation windows, transient device behavior, false positives, and capability error states.
- Privacy rules: no raw MAC exposure, no unauthorized access, and only consented sessions generate observations.
- Demo simulator clearly separates synthetic data from actual observations.

Acceptance should require that unknown or unsupported inputs degrade to an explicit unavailable/unknown state rather than a confident proximity result. Tests and field calibration must establish behavior before any risk-policy claims.

### 6.12 Proposed phased delivery plan

This is a suggested order for a future approved project; it is not a commitment that any phase is complete.

| Phase | Deliverables | Exit criteria |
|---|---|---|
| 0. Feasibility and governance | Threat model, consent copy, data inventory, retention plan, OS/API permission research, scope decision | Privacy/security and platform feasibility reviewed; proceed/stop decision recorded |
| 1. Agent foundation | Native agent prototype, authenticated local pairing, capability reporting, start/stop lifecycle | Unsupported/denied/error states are explicit; no hidden collection |
| 2. Observation adapters | One platform’s BLE and network observations; other platform adapters only after feasibility validation | Real device events recorded with timestamps and pseudonymous IDs; no raw MAC in reviewer output |
| 3. Signal and baseline | Rolling filters, calibration profiles, buckets, confidence and immutable baseline | Unit tests cover noisy/missing samples; UI labels estimates and uncertainty |
| 4. Integrity backend | Authenticated ingestion, append-only hash chain, replay controls, session seal/receipt | Tamper/replay tests and hash verification pass; failure states visible |
| 5. Human review UI | Candidate notice/capability UI, reviewer timeline, abstract map, evidence explanations | Reviewer can inspect source events; no automatic cheating verdict/disqualification |
| 6. Simulator and evaluation | Clearly marked demo simulator, controlled calibration/false-positive study | Synthetic/real data cannot be confused; documented measured limitations |
| 7. Limited pilot decision | Consent-based small pilot, support matrix, incident/appeal process | Review results, privacy controls, and go/no-go approval before wider use |

## 7. Required consistency checks

Before recording or submitting:

- README, `docs/architecture.md`, `docs/constraints.md`, `docs/limitations.md`, `ai.md`, the Decision Log, and the live application must agree.
- Do not describe Proximity Sentinel as built, working, tested, or deployed unless that becomes true and has evidence.
- Do not add Proximity Sentinel to the current architecture diagram as an implemented component. If discussed, label it “proposed future subsystem.”
- The current `ai.md` contains placeholders for additional member tools/handles and asks the team to verify its disclosure. Complete that before saying all tool use is documented.
- The final Decision Log PDF is authoritative for exact decision examples and numbers. This plan does not override it.
- Do not show or publish account passwords. `resource.md` intentionally excludes them.
- Do not reuse civic demo language from the template as though it describes CodeVeritas.

## 8. Final checklist

### Product and narration

- [ ] Product claims checked against the running build and source docs.
- [ ] Demo uses safe sample/test accounts and public, non-sensitive repository evidence.
- [ ] Pending, failed, provisional, and verified states are described accurately.
- [ ] No claim of code authorship detection, identity recognition, hiring prediction, or offline sync.
- [ ] Offline/network limitations are disclosed honestly.
- [ ] Decision Log narration matches the final PDF.
- [ ] AI tools and runtime behavior match the completed `ai.md`.
- [ ] Proximity Sentinel, if mentioned, is clearly labeled as a proposal only.

### Recording and submission

- [ ] One continuous MP4, target 9:45 and hard maximum 10:00.
- [ ] Part 1 is 2–3 minutes; Part 2 is 5–7 minutes.
- [ ] All four members speak.
- [ ] Bad-input and offline/network segments are addressed without staging unsupported features.
- [ ] Real product shown; slides used only for architecture.
- [ ] 1080p preferred / 720p minimum, readable IDE, clear audio, no music under speech.
- [ ] No secrets, passwords, private answers, or unnecessary personal recordings visible.
- [ ] Final Drive link tested in an incognito window.
- [ ] Final link, chapter timestamps, and SHA-256 added to `resource.md`.

## 9. Repository sources

- `README.md` — product, users, current flow, stack, limitations, team.
- `resource-templates/video-guide.md` — timing, recording, content, and upload requirements.
- `docs/architecture.md` — current components, flow, entities, APIs, and stack.
- `docs/constraints.md` — evidence limitations, bad inputs, integrity events, and offline behavior.
- `docs/limitations.md` — current gaps, scale risks, and roadmap.
- `ai.md` — development/runtime AI disclosure and verification limits.
- `prisma/schema.prisma` — current data model.
- `resource.md` — submission metadata and reviewer path.
- `TEAM-CB001_decision-log.pdf` — final decision-log artifact; verify its exact contents before narration.
- User-provided Proximity Sentinel brief — proposal requirements captured in Section 6; not evidence of implemented capability.
