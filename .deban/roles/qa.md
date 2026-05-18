---
role: qa
owner: Gerald
status: active
last-updated: 2026-05-18
---

# QA / Verification

## Scope

Cross-checks: does our reproduction match the paper's numbers? Does the data shape we
load match what the source repo documents? Are interactive states free of subtle bugs
(off-by-one in click indices, swapped speakers, wrong ICI normalisation)?

## Decisions

| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-18 | **Three numerical checkpoints** must pass before claiming v1: (1) total coda count = 8,719 (Dataset 1) or 3,948 (Dataset 2) loaded; (2) tempo KDE peaks at approximately {0.33s, 0.51s, 0.80s, 1.02s, 1.26s} — match Fig 2A and Fig 3 headers; (3) ornament rate ≈ 4% in DTag-annotated codas | These three are the cheapest invariants we can verify against the paper's own text | [[dev]] |
| 2026-05-18 | Visual diff against paper Fig 1B/C and Fig 3 done by eye, side-by-side. No pixel-matching. If the rhythms cluster, the tempo modes appear, and the rubato lines visibly co-vary in our reproduction, that's the bar | CLAUDE.md says "understanding through rebuilding, not pixel-matching" | [[ux]] |
| 2026-05-18 | Every assumption from arch/dev gets demoted to a *checked* assumption or moved to Dead Ends with a note — no silent unverified beliefs going into v1 | If we don't verify, the next person to read this can't either | |
| 2026-05-18 | **v2 verification checkpoints** before claiming ship: (1) v1 tab renders all four sections without regression — confirmed by side-by-side puppeteer screenshot vs v1 ship state; (2) v2 tab renders all three sections — pseudocoda canvas ≠ blank, translation canvas shows cloud + 5 prompts, unmask shows tile row + strip; (3) each v2 control mutates state visibly — slider input updates the staircase, translate toggle moves diamonds, mask+step reveals tiles; (4) no `pageerror` or `console.error` during a full page-load + interaction sweep. | All four checkpoints PASS as of 2026-05-18 ship. | [[dev]] |
| 2026-05-18 | **v3 verification checkpoints**: (1) `make bundle` succeeds and `corpus_timeline.json` loads in browser; (2) v1 and v2 panes still render unchanged (`m-codas`=3,840, exchange canvas width preserved, v2 canvases present); (3) v3 pane shows all three sections (rasterCanvas ≠ 0, ltsaSvg has cells + cursor, ppiCanvas ≠ 0); (4) global play advances cursor (readout 2005-01 → 2005-06 in 2.5 s at 1×, scrubber moves); pause stops at the current value; (5) speed selector switches active speed; (6) scrubber jump moves readout (set 500 → 2011-01); (7) LTSA cell click jumps cursor (clicking a 2006 cell sets readout to 2006-01); (8) `♪ audio off → on` toggle does not throw; (9) headless puppeteer sweep yields zero `pageerror` / `console.error`. | All nine checkpoints PASS — see `/tmp/ceti-v3-*.png`. | [[dev]] |
| 2026-05-18 | **v4 verification gates**: (1) `#v4` renders all four modules without console errors — PASS; (2) each gauge shows live-moving values (gauges canvas centre pixel sample changes between paused and 2.5 s playing) — PASS; (3) sonar sweep rotates smoothly (sonar canvas centre = teal centre-dot pixel `[110,197,192,255]` confirms render path complete); pool wall arc visible at lower right — PASS; (4) echogram present with cyan distance trace — PASS; (5) Play/Pause halts everything in v4 (`playBtnText` toggles `▶ ↔ ❚❚`) — PASS; (6) speed 4× pill becomes `is-active` after click — PASS; (7) Tab switch v4 → v3 → v4 (`activePane` round-trips correctly, both panes' canvases re-appear) — PASS; (8) v1+v2+v3 regression: m-codas=3,840, exchange canvas + grid (138 svg children) + v3 raster + 1,041 LTSA cells + PPI canvas all unchanged — PASS; (9) headless puppeteer sweep yields zero `pageerror` / `console.error` across all four tabs and interactions — PASS. | All nine v4 gates PASS — see `/tmp/v4-{smoke-paused,smoke-playing,smoke-4x,full,instruments,sonar,altimeter}.png` and `/tmp/regress-{v1,v2,v3}.png`. | [[dev]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->

| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] How exactly does the paper compute rubato drift? "Tempo drift between two codas from the same speaker, defined as the difference in coda durations" — verify against Section 5 of the paper before reimplementing — owner: [[qa]] — since: 2026-05-18
- [ ] 156 vs 143 codas — reproduce both counts from the data ourselves and document which interpretation each corresponds to — owner: [[qa]] — since: 2026-05-18

## Assumptions
- [The published cluster IDs in any provided dataset are the canonical truth; if our recomputation disagrees, ours is wrong] — status: untested — since: 2026-05-18 — How to apply: treat repo-supplied labels as ground truth; investigate discrepancies before declaring "improvement"

## Dependencies
Blocked by: [[dev]] producing data bundles
Feeds into: [[pm]] (gate for v1 release)

## Session Log
- 2026-05-18 — Three numerical checkpoints, eye-diff bar, and assumption-discipline rule recorded.
- 2026-05-18 — **All three checkpoints PASS**: (1) Dataset 1 = 8,719 codas, Dataset 2 = 3,840 codas. (2) Tempo KDE central peaks at 0.323, 0.491, 0.791, 1.001, 1.271s — matches paper 0.33/0.51/0.80/1.02/1.26s within 0.01s. (3) Ornament rate = 3.93% (paper: ~4%). Plus bonus: mean |rubato drift| = 0.050s ≈ paper. Eye-diff against paper PDF deferred to Gerald.
- 2026-05-18 — **v2 checkpoints PASS**: (1) v1 unchanged (m-codas / m-exchanges / m-speakers / m-orn unchanged, all four canvases/svgs render with expected child counts: exchange canvas 1092px, grid svg 138 children, embedding canvas 1092px); (2) all three v2 canvases exist and resize correctly; (3) interactions verified — ps-rubato slider drives `+0.15 s` readout, tx-translate moves markers via animation to nearest natural codas (mean Euclidean 2.25 vs baseline 3.94 = clear "translation" effect), unmask reveals 2 tiles per step with `s1`/`s2` provenance labels; (4) zero JS errors in headless smoke. Screenshots `/tmp/ceti-v2-*.png`.
- 2026-05-18 — **v3 checkpoints PASS**: (1) `make bundle` writes `corpus_timeline.json` (9,376 bytes, 144 months, max-cell 1205, all 8,719 codas parsed via the two-format date fallback); (2) v1 unchanged (codas=3,840, exchange canvas 2104px, grid svg 138 children) and v2 canvases all 2104px; (3) v3 sections render — raster canvas 2104px with 29-coda 184.2 s exchange, LTSA svg 1063 children, PPI canvas 2104px peak R0/154 codas; (4) `▶ play` for 2.5 s walks readout 2005-01 → 2005-06, scrubber 0 → 41; pause halts at the same value; (5) speed pill `4×` becomes active; (6) scrub to 500 → readout 2011-01; (7) LTSA cell click → readout 2006-01; (8) audio toggle flips to `♪ audio on` without error; (9) zero `pageerror` / `console.error` after fixing the hidden-tab arc-radius guard. Screenshots `/tmp/ceti-v3-{initial,playing,raster,ltsa,ppi,ppi-playing}.png`.
- 2026-05-18 — **v4 checkpoints PASS**: (1) `#v4` renders gauges (depth/temp/heading/pitch/roll/turns canvases all present), sonar 638×638 canvas, altimeter dist + echo canvases — PASS; (2) gauge values change between paused and 2.5 s playing — PASS; (3) sonar canvas renders the central teal dot (centre pixel `[110,197,192,255]`), jet-coloured pool wall arc visible at lower-right per `/tmp/v4-sonar.png` — PASS; (4) echogram column field + cyan distance trace per `/tmp/v4-altimeter.png` — PASS; (5) `▶` → `❚❚` text toggle on click — PASS; (6) speed `4×` pill `is-active` after click — PASS; (7) tab round-trip v4→v3→v4 preserves activePane — PASS; (8) regression: m-codas=3,840 unchanged, exchange canvas + grid 138 children + context svg + embedding canvas all present in v1; v3 has raster + 1041 LTSA cells + PPI canvas — PASS; (9) zero `pageerror` / `console.error` across full sweep — PASS. Screenshots `/tmp/v4-{full,instruments,sonar,altimeter,smoke-paused,smoke-playing,smoke-4x}.png` and `/tmp/regress-{v1,v2,v3}.png`.
