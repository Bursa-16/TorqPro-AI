# Changelog

All notable changes to TorqPro AI are documented here.
Historical release notes are in [docs/releases/](docs/releases/).

---

## [3.4.0] — 2026-10-20

### Added
- Advanced VDI 2230 joint analysis: axial operating stress (σ_axial, η_axial),
  separation safety (F_K,res, ΔF_k, F_A,sep), joint stiffness (c_b, c_p),
  average contact pressure (A_contact, p_avg)
- Engineering charts: ΔF_K vs. F_A, joint stiffness force–displacement diagram
- Parameter-context engineering diagrams for all 11 Advanced Analysis input fields
  with live focus and value updates (t, L, n, FA, F_M, ΔT, A_s, Rp0.2, material,
  D_outer, d_h)
- TR/EN runtime localization for all new engineering sections and context descriptions
- Collapsible and resizable engineering result rail with persistent state

### Fixed
- Advanced context panel remained on generic schematic when focusing fields
  v_FM, v_AS, v_rp02, v_dOuter, v_dH — all 11 fields now wire focus correctly
- Same-origin API routing for private Docker deployment
- Legacy route embedding for same-origin environments
- React app served from production Dockerfile

### Changed
- Engineering result rail layout: primary scalar highlighted, supporting scalars
  below; result panel collapsed/expanded state and width persisted in localStorage

### Engineering Integrity
- No VDI 2230 formula changes (δp, δb, Φ, ΔFb, ΔFk, FK_res, FA_sep,
  cb, cp, σ_axial, η_axial, A_contact, p_avg)
- No backend API contract changes
- No authentication changes

---

## [3.3.4] — hotfix

GitHub Pages / Render API connectivity hotfix.
See git tag v3.3.4.

## [3.3.3]

CI compatibility and release stabilization.
See git tag v3.3.3.

## [3.3.2]

Tool Tracking frontend/API integration.
See [docs/releases/v3.3.2.md](docs/releases/v3.3.2.md).

## [3.2.0]

See [docs/releases/v3.2.0.md](docs/releases/v3.2.0.md).

## [3.1.1]

See [docs/releases/v3.1.1.md](docs/releases/v3.1.1.md).

## [3.1.0]

See [docs/releases/v3.1.0.md](docs/releases/v3.1.0.md).

## [3.0.0]

See [docs/releases/v3.0.0.md](docs/releases/v3.0.0.md).
