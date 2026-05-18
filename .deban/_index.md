---
project: CETI-visuals
created: 2026-05-18
status: active
mode: solo
stale_threshold_days: 30
---

# CETI-visuals — Index

## Brief

Reproduce locally the key visuals that operationalise Project CETI's core claims on
sperm whale communication, anchored on Sharma et al. (Nat Commun, 2024) — *Contextual and
Combinatorial Structure in Sperm Whale Vocalisations*. Bar is **understanding through
rebuilding**, not pixel-matching. v1 = a locally-running interactive web artefact that
makes the four axes (rhythm, tempo, rubato, ornamentation) legible from the data alone,
plus a static-figure replica set for cross-check against the paper.

Aesthetic constraint: dark editorial, OKLCH-internal palette, vanilla ESM, canvas/SVG only.
No framework bloat. No PII. Compression over completeness.

## Active Roles
- [[pm]] — owner: Gerald
- [[arch]] — owner: Gerald
- [[dev]] — owner: Gerald
- [[ux]] — owner: Gerald
- [[qa]] — owner: Gerald
- [[devops]] — owner: Gerald

## Key Decisions
<!-- Cross-role summary, maintained by COMPACT -->

- 2026-05-18 — **Two-track build**: Python pipeline produces the static reference figures
  *and* exports a normalised JSON bundle; the web layer consumes only the JSON. Decouples
  scientific verification (matplotlib vs paper) from rendering (canvas/SVG). [[arch]] [[dev]]
- 2026-05-18 — **Caller-identity colours stay blue/orange** to match paper convention.
  Editorial palette (amber/teal accents on dark) is applied to chrome only — never to data
  encoding. [[ux]]
- 2026-05-18 — **Headline visual is the exchange plot (Fig 1B/C)**, not the phonetic
  alphabet (Fig 3). The exchange plot is what makes rubato + ornamentation *visible* in a
  way prose cannot. The grid is a downstream summary. [[pm]] [[ux]]
- 2026-05-18 — **v2 ships as a sibling tab** to v1 with three WhAM-inspired surrogates:
  pseudocoda playground (generation, Fig 1d), translation lattice (Fig 3), token-stream
  unmask (Fig 2). Reuses the existing JSON bundle; no pipeline change; v1 untouched.
  All three v2 visuals are explicitly conceptual — not model outputs. [[pm]] [[arch]]
  [[ux]] [[dev]]

## Open Questions (cross-role)
<!-- Unresolved items spanning more than one role -->

- [x] **RESOLVED 2026-05-18** Dataset 2 IS in the public release: `sperm-whale-dialogues.csv`
  with 3,840 codas (not 3,948 as initially noted), 48 distinct exchanges via REC, 11 speakers
  via Whale column. All contextual analyses reproduce per-pair.
- [x] **RESOLVED 2026-05-18** "Interactive variables" = brushing + hover for v1 (linked
  cell-to-exchange highlighting in the alphabet grid, hover-tooltips on every mark).
  Parameter sliders deferred to v1.1.
- [ ] CLAUDE.md cites "~156 distinguishable codas"; paper text says "at least 143
  combinations frequently realised" with 18 rhythms × 5 tempos × rubato × ornament.
  Resolve which count is canonical and document the arithmetic. Note: our grid shows
  about 58 non-empty cells before adding rubato × ornament; with both axes the
  combinatorial maximum is 18 × 5 × 2 × 2 = 360, of which 143 or 156 are "frequently
  realised" depending on threshold. — owners: [[pm]] [[qa]] — since: 2026-05-18
