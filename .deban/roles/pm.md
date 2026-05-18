---
role: pm
owner: Gerald
status: active
last-updated: 2026-05-18
---

<!-- v2 update — see Decisions below for new 2026-05-18 rows -->


# Project Manager

## Scope

Sequencing, scope cuts, and small-decisions authority on the CETI-visuals reproduction.
Single source of truth for what counts as v1, what is deferred, and when to surface
something to Gerald.

## Decisions

| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-18 | v1 ships when the **four CLAUDE.md visuals** are reproducible from the local data bundle AND the headline exchange plot is interactive in a browser served from the local repo | "Working v1 locally" needs a concrete bar; this is the smallest set that demonstrates the paper's central claim (rhythm + tempo + rubato + ornament jointly produce the inventory) | [[arch]] [[dev]] [[qa]] |
| 2026-05-18 | Reproduction order: (1) exchange plot, (2) phonetic-alphabet grid, (3) context-conditional rubato/ornament distributions, (4) 2D coda-embedding | Order rewards-first: the exchange plot is the most legible, the grid the most cited; the conditional distributions and embedding refine, not anchor | [[ux]] [[dev]] |
| 2026-05-18 | Hold the literal first move from CLAUDE.md: clone → inventory → write REPRO_PLAN.md → **surface** before any reproduction code | Stated explicitly in CLAUDE.md; skipping it forfeits the calibration the plan provides | [[arch]] [[qa]] |
| 2026-05-18 | Coda-vowel phonology sub-project is **out of scope** for v1 | CLAUDE.md says do not interleave; mixing primitives (spectrograms vs ICI staircases) blurs both | [[arch]] |
| 2026-05-18 | **v2 ships as a sibling tab to v1** with three WhAM-inspired visuals: pseudocoda playground (Fig 1d analogue), translation lattice (Fig 3 analogue), token-stream unmask (Fig 2 analogue) | WhAM (Paradise et al. 2025) is the freshest paper in the canon; these three visuals operationalise its three core moves (generate / translate / unmask) at the *feature* level — without invoking the model itself. v1 stays untouched. | [[arch]] [[ux]] [[dev]] |
| 2026-05-18 | **v2 visuals are explicitly conceptual surrogates**, not model outputs. The captions say so. | We don't ship a transformer in the browser; trying to fake the model's outputs would be dishonest. Each visual is a 1-NN / PCA / linear-composition surrogate of the same *move* WhAM makes. | [[ux]] [[qa]] |
| 2026-05-18 | **No bundle.py change for v2.** All three visuals reuse the existing `codas.json` / `exchanges.json` / `clusters.json` schema; rhythm centroid (normalised cumulative ICI) + tempo mean_duration are sufficient to compose pseudocodas, and the existing 20-D feature recipe gives the translation lattice its space. | Extending the bundle was tempting (precomputed PCA, precomputed nearest neighbours) but the in-browser cost is sub-100ms and shipping more JSON breaks the existing contract. | [[arch]] [[dev]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->

| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Is Dataset 2 (3948 DTag codas with speaker IDs) available in the public release? Drives whether rubato/ornament reproductions are per-pair or aggregate-only — owner: [[dev]] — since: 2026-05-18
- [ ] Definition of "interactive variables" — sliders that re-cluster, brushing, or hover-only? Default to brushing+hover for v1 — owner: [[ux]] — since: 2026-05-18
- [ ] 156 vs 143 distinguishable codas — which arithmetic? Resolve and document — owner: [[qa]] — since: 2026-05-18
- [ ] Does v1 ship with audio playback of representative codas/exchanges? Not in CLAUDE.md visual list; defer to v1.1 unless asked — owner: [[ux]] — since: 2026-05-18
- [ ] Single-page web app vs four separate pages (one per visual)? Lean single-page with sectioned scroll, since visuals share data and reinforce each other — owner: [[arch]] — since: 2026-05-18

## Assumptions
- [Sharma 2024 sw-combinatoriality repo contains complete Dataset 1 and reproduction code] — status: untested — since: 2026-05-18
- [The published 18 rhythm clusters and 5 tempo modes are deterministic given the same data + seeds] — status: untested — since: 2026-05-18
- [Gerald wants v1 in this session, not a multi-session arc] — status: validated — since: 2026-05-18 (explicit in /deban args)
- [Vanilla ESM + canvas is fast enough to render an exchange plot with ~hundreds of clicks interactively at 60fps] — status: untested — since: 2026-05-18

## Dependencies
Blocked by: nothing
Feeds into: [[arch]], [[dev]], [[ux]], [[qa]], [[devops]]

## Lessons

- 2026-05-18 — **Verify pickle/CSV row counts with the loader you actually use, not the source notebook's loader.** REPRO_PLAN's "3839 vs 3840 mismatch" was an artefact of the source code using `numpy.genfromtxt` (which keeps the header as row 0 and slices `[1:]`). With `pandas.read_csv` the count is 3840 and pickles align cleanly. Cost: nearly built a defensive alignment layer that wasn't needed. Lesson: when a published "off-by-one" warning exists, reproduce it first before patching around it.
- 2026-05-18 — **Two-stage Python→JSON→browser pays off immediately on a v1 sprint.** Each numerical question had exactly one place to land — pipeline. Each rendering question had exactly one place to land — web. No "is the bug in the maths or the canvas?" diagnostic loops.
- 2026-05-18 — **v2 lesson: the hardest non-obvious bit was honesty about the surrogate.** WhAM's actual model can't run in a static page; pretending its outputs would be dishonest. Naming the visuals "playground" / "lattice" / "unmask" + captions that say "conceptual surrogate, not model output" let the visuals carry weight without claiming model fidelity. The visualisation is *the move*, not *the result*.
- 2026-05-18 — **Section ids containing `/` (e.g. `id="v1/exchange"`) work fine** with `getElementById` and hash-anchor scrolling, but CSS selectors need `\/` escaping. Used hash-routing only for tab+section state — no CSS targeting of the slash ids — so the trade-off was free.

## Session Log
- 2026-05-18 — Project scaffolded; decisions on v1 bar, reproduction order, and out-of-scope set recorded.
- 2026-05-18 — v1 SHIPPED. Pipeline (load/features/colour/bundle/figures) and web (4 sections, vanilla ESM) complete. All three QA checkpoints pass. Headless puppeteer smoke test confirms render. Screenshots saved to /tmp/ceti-sec-*.png.
- 2026-05-18 — v2 SHIPPED. Tab nav added; v1 untouched; three new sections (pseudocoda, translation, unmask) under #v2/*. JSON bundle reused as-is. Headless smoke test passes with zero JS errors. Screenshots: /tmp/ceti-v2-tab-v1.png, /tmp/ceti-v2-tab-v2.png, /tmp/ceti-v2-after-interactions.png, /tmp/ceti-tx-closeup.png, /tmp/ceti-um-{masked,stepped}.png.
