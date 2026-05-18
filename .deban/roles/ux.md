---
role: ux
owner: Gerald
status: active
last-updated: 2026-05-18
---

# UX / Visual Design

## Scope

Visual language of the web artefact: layout, typography, colour, interactivity model.
Owns the dark-editorial aesthetic mandate from CLAUDE.md and the scientific-legibility
mandate from the paper.

## Decisions

| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-18 | **Caller-identity colours = paper's blue/orange** for the exchange plot and rubato visualisations | Match the paper. Caller A vs Caller B is a *data encoding*, not a chrome choice. Substituting our palette would actively impair comparison with published figures | [[arch]] |
| 2026-05-18 | **Editorial palette** (dark background, warm-amber and cool-teal accents) applied to UI chrome only: section headers, axis labels, hover-state highlights, side annotations | The aesthetic mandate lives in the chrome, not in the data ink | [[arch]] |
| 2026-05-18 | **Typography**: serif (Source Serif / EB Garamond fallback) for body and prose annotations; monospace (JetBrains Mono / system-ui mono fallback) for axis labels, ICI values, cluster IDs | Mirrors a printed scientific monograph; monospace for any number that must be aligned in a column | |
| 2026-05-18 | **Interactivity for v1**: hover-inspect on all marks, brushing between exchange plot and phonetic-alphabet grid (hovering a cell highlights member exchanges; hovering an exchange shows which cell it belongs to), no parameter sliders | "Interactive variables" interpreted as linked exploration, not as re-running clustering live. Adding sliders that re-cluster pushes into v1.1 territory | [[pm]] [[dev]] |
| 2026-05-18 | **Layout** = single long page, four stacked sections, sticky table of contents on the left at desktop widths | Tells a linear story (the paper's argument order) while letting Gerald jump to any visual | [[arch]] |
| 2026-05-18 | **v2 tab bar styling**: tabs are flat (no chip background), monospaced "v1" / "v2" pills + italic-serif tab labels + monospaced citation eyebrow. Active tab gets an amber bottom-rule and amber pill. Layout sits above the cover header. | A loud tab bar would compete with the page. The amber-rule active indicator borrows from the existing eyebrow palette; no new colours introduced. | [[arch]] |
| 2026-05-18 | **v2 keeps the v1 palette discipline**: paper-blue (#3b82c4) / paper-orange (#e08a3c) for caller-like identity (alternating repeats in the pseudocoda staircase), amber/teal for chrome (sliders, ornament marker, certainty heat-strip). No new hues introduced. | The data encoding is unchanged across iterations; chrome accents reuse exactly what v1 established. | [[pm]] |
| 2026-05-18 | **v2 control affordances**: native HTML `<input type="range">` and `<select>` with amber slider-thumb. Numeric readouts (e.g. `+0.05 s`) sit immediately after each slider in monospace. The pseudocoda "play" button is a single `▶ play` glyph, no audio scrubber. | Sliders need *visible value*. Audio is incidental, not the focus, so it gets one verb. | [[dev]] |
| 2026-05-18 | **ICI colour bin scale** (introduced for the unmask tile grid): 6 bins from 0–50 ms (blue) to 250+ ms (orange), interpolating through teal-grey-amber. The transition at 120 ms maps to the paper-orange tail. Bin legend rendered above the tile row. | The token-stream metaphor needs *categorical* colour, not a continuous gradient — distinct bins read like a token vocabulary. | [[dev]] |
| 2026-05-18 | **v3 clockbar is sticky-top within the v3 pane.** Single horizontal control row: play/pause button, four speed pills (0.5×/1×/2×/4×), master scrubber, monospaced YYYY-MM readout. Teal accent on the scrubber thumb, amber on the active speed pill. | A floating clock breaks reading; an inline one disappears mid-scroll. Sticky keeps it visible as the reader walks through the three sections, but the styling reuses existing chrome accents (no new hues). | [[arch]] [[dev]] |
| 2026-05-18 | **v3 LTSA uses an OKLCH-baked magma-like ramp** (32 stops, L=0.10→0.92, hue 290°→30° via magenta). Cell shading = log(count+1). | HYDROACOUSTICS.md forbids jet/rainbow. Magma is the canonical perceptually-uniform diverging-monotone-lightness ramp; baked through `oklch_to_srgb_hex` so the page ships sRGB hex with no client-side colour-space code. | [[dev]] |
| 2026-05-18 | **v3 §1 audio is opt-in via a `♪ audio off / on` toggle**, off by default. State is amber when on. | Autoplay is forbidden by every modern browser; visual playhead carries the "alive" sensation without sound. Reader chooses when (and whether) to hear the click train. | [[dev]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->

| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Should the phonetic-alphabet grid be a true small-multiples of exchange-plot snippets (one mini exchange-plot per cell), or paper-style pies (rubato / ornament rates)? Pies are denser; mini-plots are more honest. — owner: [[ux]] — since: 2026-05-18
- [ ] Do we annotate the headline exchange plot with prose pull-quotes from the paper, or let the data speak unannotated? Lean light-annotation: one or two pointers per visual, no walls of text — owner: [[ux]] — since: 2026-05-18
- [ ] Audio playback of representative codas — defer to v1.1, but reserve a UI affordance (small ▶ button) on each row so retrofitting doesn't require redesign — owner: [[ux]] — since: 2026-05-18

## Assumptions
- [Dark background does not impair readability of paper-blue/paper-orange — both pass WCAG AA against a near-black background] — status: untested — since: 2026-05-18

## Dependencies
Blocked by: [[arch]] (decides canvas vs SVG per visual)
Feeds into: [[dev]]

## Session Log
- 2026-05-18 — Palette split (data = paper colours, chrome = editorial), interactivity scope, typography decisions recorded.
- 2026-05-18 — v1 rendered. Sticky TOC, cover, four sections. Caller A in paper-blue (#3b82c4), Caller B in paper-orange (#e08a3c). Amber (#d9a766) for ornament markers, teal (#6ec5c0) for rubato connectors. Serif body + monospace data labels confirmed in production screenshot.
- 2026-05-18 — v2 tab bar added. Sliders, range readouts, ICI colour bins introduced. v1 visual identity unchanged. Screenshots /tmp/ceti-v2-tab-v1.png and /tmp/ceti-v2-tab-v2.png confirm both tabs share the editorial frame.
- 2026-05-18 — v3 tab added. Sticky clockbar (play/pause/speed/scrubber/readout) sits above three sections: rasterplot (paper-blue/orange caller lanes, amber ornament rings, teal playhead), LTSA (OKLCH magma cells, teal column cursor), PPI (rhythm-cluster spokes, teal sweep with alpha-decay trail). No-rainbow rule applied. Screenshots /tmp/ceti-v3-{raster,ltsa,ppi,ppi-playing,initial,playing}.png.
