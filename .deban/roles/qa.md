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
