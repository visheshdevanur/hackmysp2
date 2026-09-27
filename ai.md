# AI Usage Disclosure

[← Back to README](./README.md)

This disclosure describes the current implementation and the work on this repository. Update the model/tool names and team acknowledgments before final submission if other members used additional tools.



| Question | Answer |
|---|---|
| AI tools used during development? | Yes — OpenAI Codex/ChatGPT assistance was used for implementation, debugging, and documentation in this workstream. Team members should add any other tools they used. |
| AI/ML used at runtime? | Yes — Gemini API for configured evidence analysis and assessment generation; MediaPipe Tasks Vision for an in-browser face-presence signal. |
| Portion of code AI-assisted? | Not measured reliably; do not claim a percentage. |
| Human review? | The team must review, understand, and validate submitted code and outputs. AI assistance is not a substitute for that review. |

## 1. AI Tools Used During Development

| Tool | Model/plan | Used by | Use |
|---|---|---|---|
| OpenAI Codex/ChatGPT | Model varies by session | Add team member/handle | Coding assistance, debugging, and preparing this disclosure |
| Add any other tools used by the team | Add model/plan | Add handle | Add actual use |

## 2. Where AI Helped in the Codebase

| Area | Level of assistance | Human responsibility |
|---|---|---|
| Dashboard and API implementation | Assistance used during iterative changes; exact share not tracked | Check authorization, data handling, and actual behavior before submission |
| Scoring and assessment flows | Assistance used for code changes and debugging; exact share not tracked | Verify scoring rules against product requirements and inspect evidence use |
| Documentation | AI-assisted draft based on repository files and available project details | Confirm team facts, demo links, and every product claim |

## 3. AI Inside the Product (Runtime)

| Model/API | Product use | Hosted where | Trained by team? |
|---|---|---|---|
| Google Gemini API | Configured repository/session analysis, assessment support, and quiz/speaking question generation | Google API; key is server-side | No |
| MediaPipe Tasks Vision face detector | Counts visible faces in the candidate's browser during supported monitored assessments and reports integrity events | Browser-side package/model loaded from CDN in current implementation | No |

- **Accuracy measured by the team:** Not measured in a controlled evaluation.
- **When output is wrong or unavailable:** AI assessments are supporting evidence and require human review; API/model failures surface as pending/retry states. Face-check failures should be shown as unavailable and must not be described as a successful face check.
- **Offline behavior:** Gemini and GitHub features need a network. MediaPipe currently fetches its module/model from CDNs, so face detection also needs network access unless cached by the browser.
- **Data sent to third parties:** Repository and recorded assessment evidence may be sent to Gemini as described by the in-product consent. Avoid private repositories, secrets, and unrelated personal data. Review provider terms and consent before public use.
- **Cost at scale:** Not measured; depends on model, prompt/video volume, and provider pricing/quota.

## 4. Key Prompts

Prompts are maintained in server-side feature code and can change. Add representative prompts only after reviewing the exact current prompts and confirming they do not expose secrets.

## 5. How We Verified AI Output

- The application stores generated results with their related challenge/credential so a reviewer can inspect supporting context.
- Two independent human reviews are required for credential verification.
- No controlled benchmark has been completed for Gemini assessment accuracy or face-detection precision/recall; these are open validation tasks.
- Team must record a concrete AI-introduced bug and how it was caught if one is identified during final QA.

## 6. What We Deliberately Do Not Claim AI Does

- It does not prove code authorship or detect whether code was written by AI.
- It does not make a final hiring decision.
- Face detection is not face recognition, identity verification, or proof of candidate identity.
- The app does not claim its score predicts job performance; no hiring-outcome model is trained.

**Declaration:** The team should verify this disclosure against all tools used and sign it before submission.
**Signed:** Add team lead name · **Date:** Add submission date
