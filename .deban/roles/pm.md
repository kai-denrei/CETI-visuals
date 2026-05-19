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
| 2026-05-18 | **v3 ships as a third sibling tab — hydroacoustics**: rasterplot + LTSA heat-clock + PPI sweep, all governed by one shared `PlaybackClock` so the page feels alive and pausable. | HYDROACOUSTICS.md ranks the canonical display types; one section per primitive (one exchange-scale, one corpus-scale, one categorical/aesthetic) gives a balanced trio without over-committing. The shared clock is the architectural through-line. | [[arch]] [[ux]] [[dev]] |
| 2026-05-18 | **v3 extends `pipeline/bundle.py` with `corpus_timeline.json`** — derived from Dataset 1's `Date` column, binned into a (day-of-week × year-month) density grid. v1/v2 bundles untouched. | LTSA needs corpus-wide deployment density. Dataset 1 has 8,719 codas with `Date` but no time-of-day, so the canonical (frequency × time-of-day) LTSA reduces to a 2-D calendar density. Documented in the section caption. | [[dev]] [[qa]] |
| 2026-05-18 | **v3 audio is opt-in only** via a per-section toggle that creates the AudioContext on user gesture. Auto-play in §1 means the visual playhead, not sound. | Browser autoplay policy blocks AudioContext.start() outside a user gesture; defaulting to silent also respects the editor-reader environment most viewers will use. | [[ux]] |
| 2026-05-18 | **Tab switch auto-pauses the clock and detaches v3 subscriptions**. Re-entering v3 leaves the clock paused; user must hit play to resume. | A clock that keeps running on a hidden tab burns battery and confuses the user when they come back. Auto-pause is the conservative default. | [[arch]] |
| 2026-05-18 | **v4 ships as a fourth sibling tab — telemetry**: faithful reconstruction of Impact Subsea seaView (ISD4000 + ISS360 + ISA500). Single shared `v4-sim.js` browser-side simulator; six gauges, polar sonar, altimeter + scrolling echogram. v3 clockbar re-parented to be shared across v3 and v4; tab-switch auto-pause logic preserved. No pipeline change. | A reconstruction tab anchors the abstract acoustic vocabulary built in v1-v3 to the physical instrument an operator actually drives. v3-clock reuse keeps the architecture coherent. | [[arch]] [[ux]] [[dev]] |
| 2026-05-18 | **v4 OVERRIDE FOR v4 ONLY**: jet colourmap on the sonar polar and echogram; dashboard tile layout. Both rules from `HYDROACOUSTICS.md` ("perceptually uniform colourmaps only") and `CLAUDE.md` ("avoid dashboard-template look") are explicitly waived for v4. v1, v2, and v3 unchanged. | The brief is *reconstruction* of an existing operator software, not improvement. A faithful look-and-feel requires the source's colour conventions. Bounded scope makes the override safe. | [[ux]] [[arch]] |

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
- 2026-05-18 — **v3 lesson: the hardest non-obvious bit was the canvas-arc-on-hidden-tab issue.** The clock's `subscribe()` immediately fires the new subscriber once with current state — but at that moment the v3 pane is `hidden`, so `canvas.clientWidth === 0`, and `Math.min(cssW, cssH) / 2 - 18 < 0`, which the PPI then passes to `ctx.arc()` as a negative radius — instant `InvalidStateError`. Guard pattern: bail out at the top of any render call when `cssW < 80`. Same trap would have caught any future v3 section. Cost: 3 console errors on first smoke. Lesson: when a subscribe-on-mount pattern fires through a hidden DOM tree, every consumer must tolerate zero-size canvases.
- 2026-05-18 — **v4 lesson: an explicit user directive can override a project aesthetic rule for one tab only; record the boundary so the rule remains in force everywhere else.** The brief asked for jet on the sonar and dashboard layout — both rule-breakers under the rest of the project's discipline. The right move is not to silently break the rules nor to negotiate the brief away; it's to enact the override exactly where requested, bound the scope to v4 only, and write the boundary down in three places (`DEAD_ENDS.md`, `ux.md`, `pm.md`) so a future agent reading just one of those files can see "this exception is intentional and stops here". A bounded violation is healthier than an unbounded one; an undocumented violation is the worst kind. The brief is reconstruction, not improvement — and that distinction itself is the load-bearing decision.
- 2026-05-18 — **v4 lesson: the hardest non-obvious bit was the shared-clockbar lifecycle.** The clockbar was originally inside the v3 pane, meaning when the user left v3 the bar's DOM was inside a `hidden` ancestor. To share it with v4, the bar had to be re-parented above all panes; visibility is now gated by a `hidden` attribute that the tab router toggles based on `tab === 'v3' || tab === 'v4'`. The auto-pause-on-tab-leave logic that originally said `if (tab === 'v3') attach else detach + clock.pause()` had to be generalised to three branches: attach v3, attach v4, or detach both + pause. Every "v3-or-v4" predicate had to be written symmetrically — a casual `if (tab === 'v3') attach v3; if (tab === 'v4') attach v4;` chain (without the corresponding `detach`) would leave both module sets attached after a tab switch, doubling subscriptions on every sim notification. Lesson: when promoting "section-local UI" to "shared UI", the wiring topology grows from a 1-of-N switch into a full attach/detach matrix. Spell out every branch.
- 2026-05-19 — **Meta-lesson: dispatch one PM agent per phase, not per task.** v1, v2, v3, v4 were each built by a single long-running PM agent with full authority to make tactical decisions, update the deban vault, and verify itself. The main thread did the cross-phase glue (cache-busting install, GitHub repo creation, Pages enable, /deban sync) but never touched the per-phase implementation. Result: zero merge conflicts across four phases in one session, vault stayed coherent because each PM owned the same set of role files, and the human reviewer (Gerald) saw four clean shipping reports instead of forty incremental updates. The alternative — dispatching one agent per task — would have fragmented the deban writes across overlapping sessions and risked conflicting decisions. Lesson: an autonomous PM agent's lane is a *phase*, not a *task*; phase boundaries are where the main thread coordinates.

## Session Log
- 2026-05-19 — SYNC. Terminal closing; vault current at commit `798c198`. Added meta-lesson on dispatch-per-phase pattern and devops gaps (cache-busting + Pages publication) that the PMs didn't capture.
- 2026-05-18 — Project scaffolded; decisions on v1 bar, reproduction order, and out-of-scope set recorded.
- 2026-05-18 — v1 SHIPPED. Pipeline (load/features/colour/bundle/figures) and web (4 sections, vanilla ESM) complete. All three QA checkpoints pass. Headless puppeteer smoke test confirms render. Screenshots saved to /tmp/ceti-sec-*.png.
- 2026-05-18 — v2 SHIPPED. Tab nav added; v1 untouched; three new sections (pseudocoda, translation, unmask) under #v2/*. JSON bundle reused as-is. Headless smoke test passes with zero JS errors. Screenshots: /tmp/ceti-v2-tab-v1.png, /tmp/ceti-v2-tab-v2.png, /tmp/ceti-v2-after-interactions.png, /tmp/ceti-tx-closeup.png, /tmp/ceti-um-{masked,stepped}.png.
- 2026-05-18 — v3 SHIPPED. Third tab (`#v3`); shared `PlaybackClock` singleton; three new sections: click-train rasterplot with live playhead + opt-in audio (`v3-rasterplot.js`), LTSA-style corpus heat-clock from extended `bundle.py` (`v3-ltsa.js`), and a stylised PPI sweep (`v3-ppi.js`). v1 and v2 unchanged. Headless smoke test passes with zero JS errors after the canvas-arc-on-hidden-tab guard. Screenshots: /tmp/ceti-v3-{initial,playing,raster,ltsa,ppi,ppi-playing}.png.
- 2026-05-18 — v4 SHIPPED. Fourth tab (`#v4`); shared `v4-sim.js` simulator; four modules: six-gauge ISD4000 strip (`v4-gauges.js`), ISS360 polar imaging sonar (`v4-sonar.js`), ISA500 altimeter + scrolling echogram (`v4-altimeter.js`), baked jet LUT (`v4-jet.js`). v3 clockbar promoted to shared widget (visible on v3 and v4, hidden on v1/v2). Tab router widened to N=4. AESTHETIC OVERRIDE recorded in three places: jet colourmap + dashboard layout, bounded to v4 only. v1/v2/v3 unchanged — regression smoke confirms m-codas=3,840, exchange canvas + grid svg + v3 raster all present. Headless smoke passes with zero JS errors. Screenshots: /tmp/v4-{full,instruments,sonar,altimeter,smoke-paused,smoke-playing,smoke-4x}.png.
