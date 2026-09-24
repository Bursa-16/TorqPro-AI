TorqPro AI repository:
D:\TorqPro_TR_EN

TASK:
Update README.md to accurately represent the current TorqPro AI state after v3.3.4.

IMPORTANT:
This is a documentation-only task.
Do NOT change application code.
Do NOT modify tests.
Do NOT modify VERSION.
Do NOT create a release.
Do NOT create or move tags.
Do NOT push anything until validation is complete.
Do NOT delete or overwrite unrelated working-tree changes.

CURRENT RELEASE BASELINE

Repository:
Bursa-16/TorqPro-AI

Branch:
main

Current release:
v3.3.4

Release commit:
a8f621ae027f788f3fce6b10ffaccc12d426ac8d

VERSION:
3.3.4

GitHub tag:
v3.3.4

Known validated release results:
- Full pytest suite: 4152 passed, 20 skipped
- GitHub Actions CI: PASS
- GitHub Pages deployment: PASS
- frontend build: PASS
- frontend typecheck: PASS
- quality gate: PASS
- auth/security validation: PASS
- git diff --check: PASS

v3.3.4 scope:
- GitHub Pages -> Render backend connectivity
- production frontend API-base configuration
- VITE_API_BASE_URL support
- production API URL:
  https://torqpro-ai.onrender.com/api
- local development fallback remains:
  /api
- Vite local proxy remains:
  http://127.0.0.1:8000
- backend CORSMiddleware added
- allowed GitHub Pages origin:
  https://bursa-16.github.io
- credentials enabled
- OPTIONS/preflight support through CORSMiddleware

IMPORTANT LIVE DEPLOYMENT STATUS:
Do NOT claim that the Render deployment is already running v3.3.4.

Current live Render health has been observed as:
- HTTP 200
- version: 3.2.0
- database_ok: true

Current live Render login POST works:
- POST /api/login -> 200 with valid demo credentials

But live CORS preflight currently returns:
- OPTIONS /api/login -> 405
- Access-Control-Allow-Origin missing

Therefore the repository/release is v3.3.4, but the existing Render backend deployment has not yet been redeployed to the v3.3.4 backend commit.

README must distinguish:
1. CURRENT SOFTWARE RELEASE = v3.3.4
2. LIVE RENDER BACKEND DEPLOYMENT = pending redeploy / currently older runtime

Do NOT say the complete GitHub Pages -> Render browser login path is operational until the live Render deployment is updated and verified.

==================================================
README UPDATE REQUIREMENTS
==================================================

1. Preserve the existing README structure where useful.

2. Keep and preserve the core engineering philosophy:

"Deterministic engineering calculations remain authoritative. AI is additive, explainable, traceable, and cannot override validated engineering results."

3. Preserve the existing major sections unless they are genuinely obsolete:
- Overview
- Key Features
- Fastener Engineering
- Engineering Knowledge
- AI-Assisted Engineering
- Engineering Architecture
- AI Engineering Principles
- AI Provider Architecture
- Provider Transport Layer
- Privacy and Provider Safety
- Torque Recommendation Engine
- Engineering Reasoning Engine
- Grounding and Evidence
- Audit and Traceability
- Product Direction
- Engineering Principle
- Release Philosophy

4. Do NOT invent capabilities that are not supported by the repository.

5. Audit current repository implementation before editing README.

Inspect at minimum:
- VERSION
- backend/app.py
- frontend/app/src
- frontend/app/.env.production
- frontend/app/vite.config.ts
- backend API routes
- docs/releases/
- tests/
- git log --oneline --decorate -30
- git tag --sort=-version:refname
- git status --short

6. Update all stale "Current Version", "Current Release", "Release Status",
"Release Commit", validation counts and release references.

7. Replace v3.3.2 as current release with:

Current Version:
v3.3.4

Release Stage:
Stable

Release Status:
GitHub Pages / Render API Connectivity Hotfix Released

Current Engineering Focus:
Deterministic Engineering + Governed AI + Production Web Integration

Release Commit:
a8f621ae027f788f3fce6b10ffaccc12d426ac8d

8. If docs/releases/v3.3.4.md exists, link to it.

If it does NOT exist:
- do NOT invent the file
- either omit the release-note link or explicitly state that README is the current release summary
- do not create docs/releases/v3.3.4.md unless I explicitly authorize it

9. Add a concise v3.3.4 section.

Suggested scope:

## GitHub Pages / Production API Connectivity — v3.3.4

TorqPro AI v3.3.4 introduces production frontend-to-backend connectivity support for the GitHub Pages deployment.

Include factual bullets such as:
- Production API base URL is environment-configurable.
- GitHub Pages production frontend can target the Render API.
- Local development retains the /api Vite proxy.
- Backend CORS policy explicitly permits the GitHub Pages origin.
- CORS is restricted to the intended GitHub Pages origin rather than a wildcard origin.
- Existing deterministic engineering behavior remains unchanged.
- No engineering calculation logic was changed by the connectivity hotfix.

10. Add a deployment-status note.

Use wording similar to:

### Deployment Status

The v3.3.4 source release and GitHub Pages frontend deployment are complete.

The existing Render backend service must be redeployed to the v3.3.4 release commit before the browser-based GitHub Pages -> Render login path can use the new CORS configuration.

Do NOT call this a product defect.
It is a deployment synchronization status.

11. Update validation section for v3.3.4.

Use verified results:

| Validation Item | Result |
| --- | --- |
| Full Python Test Suite | 4152 passed |
| Skipped Tests | 20 |
| Quality Gate | PASS |
| Auth / Security Tests | PASS |
| Frontend Build | PASS |
| Frontend Typecheck | PASS |
| GitHub Actions CI | PASS |
| GitHub Pages Deployment | PASS |
| git diff --check | PASS |
| Existing-Test Regressions | 0 observed in validated suite |

Do not fabricate lint results if not independently verified.

12. Update Development Roadmap.

Keep historical versions, but add at least:
- v3.1.0 — Stable AI provider/runtime milestone if supported
- v3.3.1 — previous stable baseline where appropriate
- v3.3.2 — Tool Tracking frontend/API integration
- v3.3.3 — CI compatibility / release stabilization
- v3.3.4 — GitHub Pages / Render API connectivity hotfix

Derive exact descriptions from git history and repository evidence.

Do NOT invent dates or features.

13. Correct inconsistencies in AI provider documentation.

The current README contains both:
- Ollama / Anthropic provider architecture
and
- a separate OpenAI Configuration section.

Audit the repository and make the README reflect only currently implemented providers.

Do NOT remove valid historical information merely because it is old.

Clearly distinguish:
- current production/provider architecture
- optional providers
- historical release information

Do NOT claim a provider is available unless repository code supports it.

14. Preserve security guidance:
- no API keys in source control
- deterministic calculations remain authoritative
- AI output remains advisory
- fail-closed behavior
- auditability / traceability

15. Add or update a "Deployment Architecture" section if appropriate.

Suggested architecture:

GitHub Pages
    |
    | HTTPS
    v
React / Vite Frontend
    |
    | Production API Base
    v
Render Backend / FastAPI
    |
    +-- Deterministic Engineering Services
    +-- Engineering Libraries
    +-- Production Validation
    +-- Tool Tracking
    +-- Engineering Knowledge
    +-- Governed AI Gateway
    +-- Audit / Traceability

Local development:

React / Vite
    |
    | /api proxy
    v
127.0.0.1:8000
    |
    v
FastAPI backend

Make clear that GitHub Pages hosts the static frontend only.
Do not imply that the FastAPI backend runs on GitHub Pages.

16. Add links if already valid:

Repository:
https://github.com/Bursa-16/TorqPro-AI

GitHub Pages:
https://bursa-16.github.io/TorqPro-AI/

Render API:
https://torqpro-ai.onrender.com/

Do not state that Render currently runs v3.3.4 until live verification proves it.

17. Maintain professional engineering tone.

Avoid:
- marketing exaggeration
- unsupported "industry-leading" claims
- unsupported AI capability claims
- claims of autonomous engineering decisions
- claims that AI overrides deterministic calculations

18. Keep README suitable for:
- engineering users
- recruiters
- technical reviewers
- research/software evaluators
- potential industrial customers

19. Preserve this engineering principle prominently:

"Calculate deterministically. Reason from evidence. Explain transparently. Preserve traceability."

20. Review the README for duplicated or contradictory content.

In particular inspect:
- Current Version
- Release
- Historical Release Notes
- Validation
- AI provider sections
- deployment information

Resolve contradictions without deleting valuable technical history.

==================================================
VALIDATION
==================================================

After editing README.md run:

git diff --check README.md

Then show:

git diff -- README.md

Then verify with searches for stale current-release references:

Select-String -Path README.md -Pattern "v3\.3\.2|v3\.3\.3|v3\.3\.4|Current Version|Current Release|Release Commit|Render|GitHub Pages"

Interpretation:
- Historical references to v3.3.2 / v3.3.3 are allowed.
- They must not remain identified as the current release.
- Current release must consistently be v3.3.4.

Also run:

git status --short

==================================================
DO NOT COMMIT YET
==================================================

Do not commit or push.

Return a report with exactly:

README_UPDATE_STATUS
CURRENT_VERSION
CURRENT_RELEASE
RELEASE_COMMIT
SECTIONS_UPDATED
STALE_CURRENT_VERSION_REFERENCES
DEPLOYMENT_STATUS_DOCUMENTED
PROVIDER_DOCUMENTATION_STATUS
VALIDATION_RESULT
README_ONLY_CHANGE
OTHER_WORKTREE_CHANGES_PRESERVED
READY_TO_COMMIT = YES / NO

If READY_TO_COMMIT=YES, wait for my approval before committing.
