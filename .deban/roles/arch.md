---
role: arch
owner: Gerald
status: active
last-updated: 2026-05-18
---

# Architecture

## Scope

Data flow, module boundaries, language/runtime choices, and the interface between the
scientific reproduction layer (Python) and the rendering layer (web). Owns the contract
that lets each layer be verified independently.

## Decisions

| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-18 | **Two-stage pipeline**: Python (data → features → JSON bundles + matplotlib PNG/SVG) → Web (vanilla ESM consuming JSON only) | Lets us cross-check our Python reproduction against the paper figures *first*, then render web visuals from already-validated data. Reduces "is the bug in the maths or in the canvas?" ambiguity | [[dev]] [[qa]] |
| 2026-05-18 | **JSON bundle schema** = `codas.json` (one row per coda: id, speaker, exchange_id, t_start, ici_seq, rhythm_cluster, tempo_cluster, rubato_drift, has_ornament) + `exchanges.json` (one row per exchange: id, codas[], speakers[]) + `clusters.json` (rhythm/tempo cluster centroids + colour assignments) | Flat, denormalised, easy to load in browser; small enough to ship inline if needed | [[dev]] [[ux]] |
| 2026-05-18 | **No frontend framework** — vanilla ES modules, canvas 2D for the exchange plot (many lines, hover hit-test cheap), SVG for the phonetic-alphabet grid (cells + pies, accessible) | CLAUDE.md mandates no framework bloat. Tool choice per visual: canvas where line count is high, SVG where structure benefits from DOM (accessibility, CSS hover) | [[ux]] [[dev]] |
| 2026-05-18 | Python deps locked: `numpy`, `pandas`, `scipy`, `matplotlib`. NO seaborn/plotly/bokeh | CLAUDE.md explicit. Matplotlib can reproduce all four paper visuals; the others add weight without earning it | [[devops]] |
| 2026-05-18 | Dev-only local static server (`python -m http.server` from `web/`); zero build step | "Working v1 locally" should mean `cd web && python -m http.server` and open browser. No bundler, no transpile | [[devops]] |
| 2026-05-18 | OKLCH → sRGB conversion happens **once**, at JSON-bundle build time, baked into the cluster colour assignments | Avoids shipping a colour-space library to the browser; canvas/SVG can't render OKLCH directly anyway in older webviews | [[ux]] |
| 2026-05-18 | **v2 tab navigation = pure DOM** — two `[data-pane]` divs + hash routing (`#v1/...` / `#v2/...`). No router library, no `:target` CSS, no per-section `hidden` toggle. `applyHash()` runs once on load and on `hashchange`. | One-page state model preserved. Refresh and deep-links work. Adding a third tab later is a 5-line change. | [[ux]] [[dev]] |
| 2026-05-18 | **v2 modules inline-copy the PCA recipe** from v1 `embedding.js` rather than extracting to a shared `web/lib/features.js`. | Only one duplicate site (translation lattice). Premature DRY would add a module boundary for a 60-line algorithm that hasn't been changed since v1. If a third consumer arrives, extract then. | [[dev]] |
| 2026-05-18 | **v2 reuses the existing JSON bundle unchanged.** No new fields, no `pipeline/bundle.py` edits. Rhythm centroids + tempo mean_durations + raw ICI sequences are sufficient for all three v2 surrogates. | Keeps the pipeline → web contract stable. v1 cannot regress from a v2 change because v1 doesn't share a single mutable surface with v2. | [[dev]] [[qa]] |
| 2026-05-18 | **v3 introduces a shared `PlaybackClock` singleton** (`web/v3-clock.js`) — RAF-driven, normalised cursor in [0,1], play/pause/setSpeed/setCursor/subscribe API. Each v3 section attaches a subscriber on mount and detaches on tab hide. | One clock = one source of truth for "where in the deployment are we?". RAF means renders only happen when the browser is ready to paint. Detach-on-hide is the no-zombie-render guarantee. | [[dev]] [[ux]] |
| 2026-05-18 | **v3 extends `pipeline/bundle.py`** with `corpus_timeline.json` (8,719-coda 2-D density grid from Dataset 1). Existing three bundles untouched. v1 and v2 unaffected. | The LTSA section needs a different dataset (Dataset 1, which has Date but no time-of-day). Loading it client-side would mean shipping a 600 kB CSV and parsing it in the browser; precomputing the 144-column density grid is 9 kB. | [[dev]] |
| 2026-05-18 | **v3 audio uses the same Web Audio recipe as v2-pseudocoda** (5 kHz exp-decay sine, 1 ms burst), with a lookahead-scheduler that uses `AudioContext.currentTime` plus the cursor-derived future tick offset. Audio is gated on a per-section opt-in button to satisfy browser autoplay policy. | DRY without extracting a shared module yet — only two callers and the recipe is 10 lines. Lookahead lets the clock drive timing even at 4× speed without click-jitter. | [[dev]] |
| 2026-05-18 | **Tab router becomes object-keyed** (`panes[k]`, `tocs[k]`, `tabs[k]`) — old code paired v1/v2 booleans, new code generalises to N tabs. | Anticipates a v4 without needing another rewrite. Adding a tab = adding three entries to the object and one `else if` to `applyHash`. | [[dev]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->

| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Does the source repo provide cluster assignments per coda, or do we need to recompute the 18-rhythm × 5-tempo clustering ourselves? Affects effort estimate by 1-2 hrs — owner: [[dev]] — since: 2026-05-18
- [ ] One web page with four sections, or four routes? Lean one-page; data is shared — owner: [[ux]] — since: 2026-05-18

## Assumptions
- [The sw-combinatoriality repo includes a CSV/parquet of annotated codas with ICI sequences and at least rhythm/tempo cluster IDs] — status: untested — since: 2026-05-18
- [Browser canvas can comfortably render 100+ exchanges (each up to ~30 codas of 3-40 clicks) without virtualisation] — status: untested — since: 2026-05-18

## Dependencies
Blocked by: nothing
Feeds into: [[dev]] [[ux]] [[devops]]

## Session Log
- 2026-05-18 — Two-stage pipeline + vanilla ESM + Python-only scientific layer recorded.
- 2026-05-18 — v1 contract realised: Python writes codas.json (3840 rows, 879KB), exchanges.json (48 rows, 25KB), clusters.json (4.5KB). Web reads only those. Zero shared state, zero build chain.
- 2026-05-18 — v2 tab + three modules added: `web/v2-pseudocoda.js`, `web/v2-translation.js`, `web/v2-unmask.js`. `app.js` extended with `applyHash()` tab router. No bundle.py change. Cache-bust token bumped to d0a1610d.
- 2026-05-18 — v3 tab + four modules added: `web/v3-clock.js` (shared playback singleton), `web/v3-rasterplot.js`, `web/v3-ltsa.js`, `web/v3-ppi.js`. `app.js` tab router generalised to object-keyed N-tab routing. `pipeline/bundle.py` extended with `build_corpus_timeline()` producing `data/derived/corpus_timeline.json` (9 kB). `pipeline/colour.py` extended with `magma_like_ramp()` (OKLCH-walked 32-step perceptually uniform ramp). Cache-bust token bumped to 0215de45.
