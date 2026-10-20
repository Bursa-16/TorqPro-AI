# TorqPro AI

**Deterministic engineering calculations remain authoritative. AI is additive,
explainable, traceable, and cannot override validated engineering results.**

---

## Current Release

| Item | Value |
|---|---|
| Version | v3.4.0 |
| Release stage | Stable |
| Deployment | Private Docker / Tailscale |
| Engineering standard | VDI 2230 Blatt 1 |

---

## Overview

TorqPro AI is a fastener engineering platform combining deterministic VDI 2230
calculations with a governed AI assistant. Engineering outputs are calculated
deterministically from user inputs. The AI layer is additive: it explains,
traces, and contextualises — it does not override or replace calculations.

**Engineering principle:**
> Calculate deterministically. Reason from evidence. Explain transparently.
> Preserve traceability.

---

## Key Features

- VDI 2230 Blatt 1 compliant fastener analysis
- Torque recommendation engine with material and lubrication context
- Advanced joint analysis: compliance, load distribution, axial stress,
  separation safety, stiffness, contact pressure
- Governed AI engineering assistant (Ollama / Anthropic)
- Bilingual interface (TR / EN runtime switching)
- Private deployment via Docker and Tailscale

---

## Fastener Engineering

### Torque Calculation
Deterministic torque recommendations based on bolt grade, material, lubrication,
and friction coefficients. No AI in the calculation path.

### Advanced Joint Analysis — VDI 2230

The Advanced Analysis module implements the VDI 2230 Blatt 1 compliance model:

| Parameter | Symbol | Description |
|---|---|---|
| Plate compliance | δp | Clamped-part compliance (mm/N) |
| Bolt compliance | δb | Bolt compliance (mm/N) |
| Load distribution factor | Φ | Bolt force fraction of external load |
| Additional bolt force | ΔFb | Force increase under operating load |
| Axial operating stress | σ_axial | Bolt axial stress under load (MPa) |
| Utilisation ratio | η_axial | σ_axial / Rp0.2 |
| Residual clamp force | F_K,res | Joint clamp force after external load (kN) |
| Clamp force loss | ΔF_k | Clamp force reduction (kN) |
| Separation limit | F_A,sep | Load at joint separation (kN) |
| Bolt stiffness | c_b | kN/mm |
| Clamped-part stiffness | c_p | kN/mm |
| Contact area | A_contact | Annular bearing area (mm²) |
| Average contact pressure | p_avg | F_M / A_contact (MPa) |

**Scope declarations:**
- σ_axial covers axial stress only; tightening torsion is not included.
  This is not the full VDI 2230 reduced stress check (σ_red).
- p_avg is the scalar average contact pressure; it is not a radial pressure
  distribution and is not FEA-derived.
- Schematic contact visuals are qualitative only.

### Parameter-Context Engineering Diagrams

Focusing any input field in the Advanced Analysis module updates the Engineering
Context panel with a field-specific schematic showing the symbol, live value, and
relevant dimension or force indication.

---

## Engineering Knowledge

The AI assistant is grounded in a curated engineering knowledge base covering:

- VDI 2230 terminology, parameters, and scope
- Bolt grades, material properties, tensile stress areas
- Friction coefficients and lubrication context
- Assembly preload and yield stress relationships

No values are invented. Formulae are validated against VDI 2230 before inclusion.

---

## AI-Assisted Engineering

The AI assistant answers engineering questions in context. It has access to:

- Current calculation inputs and results
- Engineering knowledge base
- Session context

The AI cannot modify calculation results. All calculation outputs are deterministic
and computed from user inputs only.

---

## AI Provider Architecture

| Provider | Type | Status |
|---|---|---|
| Ollama | Local LLM runtime | Primary (private deployment) |
| Anthropic | Cloud API | Optional |

The provider registry is configured at runtime via environment variables.
No provider API keys are stored in the repository.

---

## Privacy and Provider Safety

- All calculation logic runs entirely in the application — no external API call
  is required for engineering results.
- AI queries are routed only when the user explicitly invokes the AI assistant.
- No calculation inputs or results are sent to any external service without user
  action.
- Fail-closed: if the AI provider is unavailable, calculations proceed normally.

---

## Deployment Architecture

```
Browser
  |
  | HTTPS (Tailscale tailnet only)
  v
React / Vite Frontend (served from Docker container)
  |
  | same-origin /api
  v
FastAPI Backend (Docker container, 127.0.0.1:8000)
  |
  +-- Deterministic Engineering Services
  +-- Engineering Knowledge Base
  +-- Governed AI Gateway
  +-- Tool Tracking
  +-- Auth / Session
```

Local development:

```
React / Vite dev server
  |
  | /api Vite proxy
  v
FastAPI backend (127.0.0.1:8000)
```

---

## Validation — v3.4.0

| Validation Item | Result |
|---|---|
| Frontend test suite | 32 / 32 passed |
| Frontend build | PASS |
| Frontend typecheck | PASS |
| git diff --check | PASS |
| Private browser acceptance | PASS |
| Engineering formula parity | Confirmed — no formula changes |

---

## Release History

| Version | Scope |
|---|---|
| v3.4.0 | Advanced VDI analysis, engineering charts, context diagrams, TR/EN |
| v3.3.4 | GitHub Pages / Render API connectivity hotfix |
| v3.3.3 | CI compatibility and release stabilization |
| v3.3.2 | Tool Tracking frontend/API integration |
| v3.2.0 | See docs/releases/v3.2.0.md |
| v3.1.1 | See docs/releases/v3.1.1.md |
| v3.1.0 | See docs/releases/v3.1.0.md |
| v3.0.0 | See docs/releases/v3.0.0.md |

Full release notes: [docs/releases/](docs/releases/)
Changelog: [CHANGELOG.md](CHANGELOG.md)

---

## Repository

https://github.com/Bursa-16/TorqPro-AI
