---
role: dev
owner: Gerald
status: active
last-updated: 2026-05-18
---

# Development

## Scope

Implementation: data loaders, feature extraction (ICI sequences, rhythm/tempo clustering,
rubato drift, ornament detection), matplotlib figure scripts, JSON bundle builder, and
web rendering modules.

## Decisions

| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-18 | Use the published feature extraction from `sw-combinatoriality` where it exists; only reimplement when needed for the JSON bundle or for verification | Don't re-derive published clustering from scratch unless we have to — risk of subtle reproduction drift. Cite the source script in code comments | [[qa]] [[arch]] |
| 2026-05-18 | All notebooks in `notebooks/` are exploratory and one-concept-per-file (per CLAUDE.md layout); shippable code lives in `pipeline/` (Python) and `web/` (JS) | Keep exploration noise out of the production path | [[arch]] |
| 2026-05-18 | **Pickle/CSV alignment**: Dataset 2 has 3840 rows and all four pickles (rhythms.p, ornaments.p, tempos-dict.p semantics aside, mean_codas.p shape-aside) are length 3840. They align 1:1 by zero-based row index with `pd.read_csv` (the source's `genfromtxt[1:]` slicing made this look off-by-one). Codified by `assert` in `pipeline.load.load_dataset2()`. | The off-by-one warning in REPRO_PLAN was wrong; verified empirically with `len(df) == len(rhythms) == 3840` | [[qa]] |
| 2026-05-18 | **Tempo cluster assignment uses the paper's piecewise duration thresholds** {0.45, 0.61, 0.93, 1.08} from source notebook 4-rubato.ipynb's `return_tempo()` function, not the per-coda membership of `tempos-dict.p` (which is a 6-component GMM that misses 32 codas with d=0). | These thresholds are what the source itself uses downstream for rubato/ornament conditioning — they are the de facto canonical labels. | [[qa]] |
| 2026-05-18 | **Rubato drift** computed as `duration(curr) − duration(prev_same_speaker_in_exchange)` with `prev` defined by source 4-rubato.ipynb: same REC root (first 9 chars), same Whale, within 6s of TsTo, abs(nClicks delta) < 3. Ornament-flagged codas have their final ICI subtracted before differencing. Result: mean |Δ|=0.050s on 2,653 codas — matches paper. | Direct port of source logic to vectorised pandas | [[qa]] |
| 2026-05-18 | **PCA in browser** (web/embedding.js): implemented power-iteration with deflation on the 20×20 covariance of `[rhythm one-hot ⊕ log-duration ⊕ ornament]`. Each dimension is mean-centred and unit-scaled first so the log-duration doesn't drown the one-hots. | scipy in browser = bundler. Power iteration on 20×20 cov in ~100 iters is essentially instant. | [[arch]] |
| 2026-05-18 | **v2 pseudocoda synthesis** = `centroid` (normalised cumulative ICI shape) → adjacent-difference → multiply by `tempo.mean_duration` → for repeat k, scale tempo by `1 + (k * rubato) / max(0.05, baseDur)` → if ornament, duplicate the final ICI. | Mirrors Sharma's four-axis decomposition exactly at the feature level. The `max(0.05, ...)` guards against absurdly tiny tempos that would explode the rubato factor. | [[ux]] |
| 2026-05-18 | **v2 translation lattice distance**: default = Euclidean over the 20-D standardised feature vectors, with a toggle to cosine. Baseline reference is the median pairwise distance over 200 randomly-sampled natural codas, recomputed once per metric. Nearest-neighbour search is brute-force O(N·D) = O(3840·20) per prompt — sub-2ms. | Cosine ≈ angle, useful when magnitudes diverge across prompts. Brute force is fine at N=3840; KD-trees would add code without runtime payoff. | [[arch]] |
| 2026-05-18 | **v2 token-stream unmask 1-NN predictor**: for each masked position, find the natural coda whose ICI sequence has the same length and minimises Euclidean distance over currently-visible positions. The predictor commits its ICI at the masked index. Confidence = `1 − distance / 0.15`, clamped to [0,1]. | The 0.15s normaliser is empirically calibrated against ICI variance in the natural cloud. Any natural neighbour within ~30 ms agreement reads as high confidence. | [[ux]] |
| 2026-05-18 | **v2 Web Audio click synthesis**: per click, a 1 ms exponentially-decaying sine burst at 5 kHz. Amplitude peaks at 0.22 then exp-ramps to 0.0001 over 12 ms. Click train scheduled via `AudioContext.currentTime + cumulative-ICI`. Gaps of 0.20 s between repeats. | Matches the broadband-click impression at modest volume. Real sperm-whale clicks are ~10-20 kHz with multi-pulse structure; 5 kHz sine is the audible surrogate without trying to fool a marine biologist. | [[ux]] |
| 2026-05-18 | **Dataset 1 date parsing** = try `%d/%m/%Y` first, then `%d-%m-%Y` for the residue. CSV holds both formats: slash (2005-2014) and dash (2014-2017). All 8,719 rows parse cleanly. | Single-format parse drops 1,922 rows silently. The fallback recovers them with zero special-casing. | [[qa]] |
| 2026-05-18 | **v3 corpus timeline binning**: X = year × month (2005-2017, 156 columns to keep the sweep uniform across whole years); Y = day-of-week (Mon=0..Sun=6, from `pd.Timestamp.dayofweek`). Cell value = raw coda count; web layer applies `log(count+1)` against `max_count` for ramp lookup. | Dataset 1 carries Date only (no time-of-day) so the canonical (frequency × time-of-day) LTSA collapses to a calendar-density grid. Documented in the section caption. | [[ux]] [[qa]] |
| 2026-05-18 | **v3 PlaybackClock base period = 60 s for one full sweep at 1×**. Cursor loops back to 0 on reaching 1. RAF-driven; advance = `(speed × dt) / 60`. | At 1× the 13-year deployment scrubs end-to-end in a minute, which lines up with the rasterplot's typical 30-300 s exchange durations and the PPI's 6 rpm (10 s per rev). | [[ux]] |
| 2026-05-18 | **v3 PPI bearing assignment**: rhythm cluster `i` (0..17) is mapped to bearing `i / 18 × 360°` from screen-north, clockwise. Spoke intensity is a sliding-window count of codas with `c.rhythm_cluster == i` whose normalised global-rank falls in `[cursor - 0.04, cursor + 0.04]`. | The dataset has no per-coda bearing; we use rank within an arbitrary but stable ordering (exchange-id then t_start) as the corpus-scrub axis. This is a stylised view, captioned as such. | [[ux]] |
| 2026-05-18 | **Canvas render-guards**: every v3 canvas render bails when `cssW < 80`. Mount-time `clock.subscribe()` fires the new subscriber immediately while the v3 pane may still be `hidden` (clientWidth 0); without the guard the PPI passes a negative radius to `arc()`. | One subscribe-fire-on-add pattern × three canvas consumers × one hidden pane = three console errors in the headless smoke. The guard is one line per consumer and fixes the class of bug. | [[qa]] |
| 2026-05-18 | **v4 sim physics — small phase accumulator, not a dynamics model.** Depth = base + low-frequency sin + tiny noise. Temperature = base + slow sin. Heading rotates at 1°/s (full turn in 6 min). Pitch ±5° period 20 s, roll ±10° period 30 s. Distance follows the heading via a smooth `0.4·sin(h) + 0.3·cos(2.7h) + wobble` profile clamped to [0.2, 2.8] m. Sonar returns are sampled from three world-fixed synthetic targets (pool wall arc, pipe segment, secondary blob) plus a small per-pixel speckle floor. | The brief is "look like real telemetry, not jittery, not static". A real ROV's hover-state values drift slowly; a synth that ticks 1 Hz noise looks fake. Sinusoidal drift + small noise is the cheapest mechanism that reads as plausible across the four-decade `speed` range (0.5×–4×). | [[ux]] |
| 2026-05-18 | **v4 sonar uses an ImageData inner loop** — per-pixel polar→cartesian sampling into a typed array buffer, then `putImageData` to an offscreen canvas, then `drawImage` to the main canvas. Range rings + crosshairs + deadzone + sweep line are stroked separately on top. | A naïve canvas-per-bin fillRect (`360 × 200 = 72000 rects`) is too slow even at modest DPR. ImageData fills are O(pixels) and `putImageData` is the single GPU-uploadable path. At 638×638 DPR=2 the inner loop is ~1.6M pixel iterations, ~30ms in V8 — acceptable, well below 60fps budget when paired with the always-on RAF. | [[arch]] |
| 2026-05-18 | **v4 echogram uses a ring buffer** — `Float32Array(RING × BINS) = 256 × 64 = 16384 floats`. New columns overwrite the oldest in place. Read in display order via `(head - 1 - (filled - 1 - ago) + 2·RING) % RING`. The cyan distance overlay traces `argmax(bin)` per displayed column. | A push-pop array would re-allocate; a ring is constant-memory and O(1) per append. The argmax-per-column distance line is cheaper than running a peak tracker in the sim itself. | [[ux]] |
| 2026-05-18 | **v4 sim subscribers receive `this` directly, not a snapshot copy.** All v4 modules read fields off the live sim object during render. | A defensive copy per frame is 70 floats × N subscribers = a lot of needless garbage. Subscribers are short-lived render functions; they don't retain references. | [[arch]] |
| 2026-05-18 | **v4 clockbar widened to v3+v4 shared widget.** `app.js` tab router toggles its `hidden` attribute based on `tab === 'v3' || tab === 'v4'`. Attach/detach matrix written symmetrically: each branch explicitly detaches the other tab's modules. | An asymmetric router (attach v3 on v3-enter, never detach v3 on v4-enter) leaves the v3 raster subscribed to `clock` while v4 also subscribes its sim — doubles the work per frame. | [[arch]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->

| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Is `pandas.read_csv` enough for the annotated coda dataset, or is there a more idiomatic format in the source repo (e.g., MATLAB `.mat`, parquet)? — owner: [[dev]] — since: 2026-05-18
- [ ] Ornament detection criterion from paper: "final click in a coda containing one more click than the nearest preceding or following coda within a window of ten seconds" — needs careful implementation; verify against paper's reported 4% rate — owner: [[qa]] — since: 2026-05-18

## Assumptions
- [Rhythm clustering uses normalised-cumulative ICI vectors padded to fixed length, with hierarchical clustering — but the exact linkage / distance is not yet verified] — status: untested — since: 2026-05-18
- [Tempo clustering on absolute coda duration uses KDE + peak finding, not a parametric mixture — based on paper Fig 2A] — status: untested — since: 2026-05-18

## Dependencies
Blocked by: [[arch]] (JSON schema), inventory of sw-combinatoriality repo
Feeds into: [[ux]] [[qa]]

## Session Log
- 2026-05-18 — Implementation scope and reuse-vs-reimplement principle recorded.
- 2026-05-18 — Built pipeline/{load,features,colour,bundle,figures}.py + web/{app,exchange-plot,alphabet-grid,context-dist,embedding}.js. All four sections render. JSON bundles in data/derived/ total ~900kB.
- 2026-05-18 — Added web/{v2-pseudocoda,v2-translation,v2-unmask}.js and extended app.js with hash-routed tab nav. styles.css adds tab-bar + range-input rules. No pipeline change. Cache-bust token now d0a1610d.
- 2026-05-18 — Added web/{v3-clock,v3-rasterplot,v3-ltsa,v3-ppi}.js plus extended app.js to N-tab object-keyed routing. Extended `pipeline/bundle.py` with `build_corpus_timeline()` that parses `DominicaCodas.csv` Date (two formats) and emits `data/derived/corpus_timeline.json` (9 kB, 144 months × 7 day-of-week density grid). Extended `pipeline/colour.py` with `magma_like_ramp()`. styles.css adds `.v3-clockbar` sticky controls. Cache-bust token now 0215de45.
- 2026-05-18 — Added web/{v4-sim,v4-gauges,v4-sonar,v4-altimeter,v4-jet}.js. `app.js` widened to N=4 with explicit attach/detach matrix. `index.html` adds tab button + TOC list + v4 pane with six gauge canvases + sonar canvas + altimeter dual-canvas grid. v3 clockbar re-parented above all panes. styles.css adds `.v4-gauges-strip` (6-col grid), `.v4-sonar-wrap` (square aspect-ratio frame), `.v4-alt-grid` (1+2.2 fr split). No pipeline change. Cache-bust token now a185adb0.
