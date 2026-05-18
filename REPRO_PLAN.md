# REPRO_PLAN — Sharma et al. 2024 Reproduction

Status: **draft**, surfaced before reproduction code is written. v1 = working local interactive
artefact for the four visuals named in CLAUDE.md. Source: <https://github.com/pratyushasharma/sw-combinatoriality>
(cloned to `data/sw-combinatoriality/`, gitignored from this repo).

## 1 — Inventory

### 1.1 Notebooks (`code/*.ipynb`)

| File                              | Reproduces                                             |
|-----------------------------------|--------------------------------------------------------|
| `1-exchange-plot.ipynb`           | **Fig 1** — exchange plot (headline visual)            |
| `2-tempo.ipynb`                   | **Fig 2A** — tempo KDE + tempo small-multiples         |
| `3-rhythm.ipynb`                  | **Fig 2B** — rhythm dendrogram + 18 rhythm exemplars   |
| `4-rubato.ipynb`                  | **Fig 2C** — rubato histogram + rubato exchange panels |
| `5-ornament.ipynb`                | **Fig 2D** — ornament density + ornamented exchanges   |
| `6-information-capacity.ipynb`    | **Fig 3** — phonetic-alphabet grid + capacity calcs    |
| `7-supplementary-extra.ipynb`     | Supplementary; out of scope for v1                     |

The mapping is 1:1 with the paper. Reproduction is therefore primarily a *port*
(Jupyter + seaborn → modules + matplotlib + JSON export → vanilla-ESM web layer), not a
re-derivation.

### 1.2 Data (`data/*`)

| File                          | Shape / type                              | Role                                               |
|-------------------------------|-------------------------------------------|----------------------------------------------------|
| `DominicaCodas.csv`           | 8,718 rows × 18 cols                      | **Dataset 1** — broad EC-1 corpus 2005-2018, ICI1-9, CodaType, clan/unit/IDN. No exchange/speaker timing |
| `sperm-whale-dialogues.csv`   | 3,839 rows × 32 cols                      | **Dataset 2** — DTag subset 2014-2018, ICI1-28, `Whale` (speaker ID), `TsTo` (start-time in recording), `REC` (audio file = exchange identifier). This is the dataset with conversational context |
| `mean_codas.p`                | list of 18 ndarrays, each shape `(4,)`    | 18 rhythm-cluster centroids in normalised-cumulative-ICI space |
| `rhythms.p`                   | list of 3,840 ints                        | Per-coda rhythm cluster ID (1-indexed into mean_codas) |
| `ornaments.p`                 | list of 3,840 ints (0/1)                  | Per-coda ornament flag                              |
| `tempos-dict.p`               | dict[int → list[float]], 5 non-empty keys | Tempo clusters; each key is a cluster ID, values are member-coda durations. Cluster 5 is empty (so effectively 5 active tempo modes, matching paper) |

Two row-count quirks worth flagging at QA time, not blockers:

- `DominicaCodas.csv` has 8,718 data rows; paper text says 8,719. Off-by-one likely BOM /
  header artefact.
- ~~`sperm-whale-dialogues.csv` has 3,839 data rows but the pickled label arrays are length 3,840.~~ **RESOLVED 2026-05-18 by PM execution**: the CSV actually contains 3,840 data rows (the inventory had an off-by-one — `pd.read_csv` already drops the header, while `genfromtxt` in the source notebooks reads it as row 0 and then indexes `my_data[1:]`). All pickles align 1:1 with `df.iloc[i]` using zero-based indexing. No realignment needed.

### 1.3 Other repo contents (out of scope)

- `TheBookofWhales.pdf` and `whalesbook/page_*.pdf` (197 pages) — printed coda atlas for
  reference; not used by reproduction code.

### 1.4 What is NOT needed externally

Every figure in CLAUDE.md's priority list (1-4) can be reproduced **from the bundled data
alone**. No external audio fetches, no MATLAB-only files, no auth-walled assets. Good
news.

## 2 — Reproduction order and effort

Order is by reward-to-cost, matching `pm.md` decision of 2026-05-18.

| # | Visual                                                  | Source notebook                | Effort (rough) | Notes |
|---|---------------------------------------------------------|--------------------------------|----------------|-------|
| 1 | **Exchange plot** (Fig 1B/C) — clicks plotted on time-time axes, lines between matched clicks of adjacent codas | `1-exchange-plot.ipynb`        | 1.5 h (static) + 2 h (interactive web port) | Headline visual. Interactivity = hover-inspect on each click; brushing to highlight a single coda; toggle for rubato connectors / ornament markers |
| 2 | **Phonetic-alphabet grid** (Fig 3) — 18 × 5 rhythm/tempo grid, cell shading by count, pies for rubato/ornament rates | `6-information-capacity.ipynb` | 1.5 h (static) + 1.5 h (interactive web) | Interactivity = cell hover shows aggregate exchange-plot snippet of member codas; click drills into a member exchange in the headline plot |
| 3 | **Context-conditional rubato / ornament distributions** (Fig 2C/D) | `4-rubato.ipynb`, `5-ornament.ipynb` | 1 h (static) + 1 h (interactive) | Interactivity = toggle "given previous coda matches" vs "all pairs" |
| 4 | **2D coda embedding** (paper Suppl., not main-text figure but in CLAUDE.md scope) | derive from rhythms.p + tempos-dict + ornaments.p; project on (rhythm one-hot, log-duration, ornament) | 1 h | If a "true" embedding (UMAP/t-SNE) is in the supplement / a notebook, prefer that. Otherwise a sensible PCA on the same feature set lands the concept |

Totals are rough but useful for cut decisions: ~9 hours of focused work to land all four
visuals interactively. Static-only reproductions for QA are ~5 hours.

## 3 — Build pipeline

```
data/sw-combinatoriality/   <-- raw, gitignored
        |
        v
pipeline/                   <-- Python (numpy/pandas/scipy/matplotlib only)
  ├─ load.py                normalise both CSVs, attach pickle labels
  ├─ features.py            rubato drift, ornament check, exchange grouping
  ├─ bundle.py              emit codas.json, exchanges.json, clusters.json
  └─ figures.py             matplotlib re-renders of paper Figs 1, 2A-D, 3
        |
        v
data/derived/*.json         <-- COMMITTED, small (kB-MB)
        |
        v
web/                        <-- vanilla ESM + canvas/SVG; `python -m http.server`
  ├─ index.html             single page, four scroll sections
  ├─ styles.css             dark editorial; paper-blue/orange for caller data
  ├─ exchange-plot.js       canvas 2D, the headline
  ├─ alphabet-grid.js       SVG, hover-linked to exchange-plot
  ├─ context-dist.js        SVG, the rubato/ornament conditioning view
  └─ embedding.js           canvas, 2D scatter
```

## 4 — Risks and unknowns

| Risk                                                                 | Mitigation                                                            |
|----------------------------------------------------------------------|-----------------------------------------------------------------------|
| Pickle/CSV row alignment off-by-one (3,840 vs 3,839)                 | Resolve in `load.py` first; assert lengths match before proceeding    |
| Source notebooks import seaborn (CLAUDE.md forbids)                  | Port styling to matplotlib + a small `style.mplstyle` rc file         |
| "156 vs 143 distinguishable codas" — compute both, document which is which | Defer until phonetic-grid step; the grid itself surfaces the answer |
| Browser canvas performance with many exchanges                       | Virtualise: render only the currently-focused exchange at full detail, summarise the rest in a strip-mini view |
| OKLCH not natively renderable in canvas2D                            | Bake colours to sRGB hex once at bundle time                          |

## 5 — Gate to start coding

This plan is now surfaced. The PM agent (to be dispatched next) will execute steps 1-4
above in order, halting if any of the QA checkpoints fail (`qa.md` lists them).

Open scope question for Gerald, default answers in brackets:
- Sliders that re-cluster on the fly, or hover/brush only? **[brush + hover]**
- Audio playback in v1? **[no, defer to v1.1]**
- Single-page or multi-page? **[single page, scroll]**

## v3 — hydroacoustics (planned, surfaced 2026-05-18)

v3 adds a third tab — **hydroacoustics** — placing the CETI dataset in the canonical
hydroacoustic-display vocabulary (per `HYDROACOUSTICS.md`). Three sections, each driven by
a single shared `PlaybackClock` so the page feels alive but is fully pausable:

1. **Click-train rasterplot with live playhead.** Canvas 2D. Per-exchange view: each coda is
   a horizontal lane, each click is a tick on that lane. A vertical playhead sweeps left-to-
   right at the global speed, brightening any tick it crosses and decaying it over ~300 ms.
   Optional Web Audio click train (opt-in, user-gesture only, reusing the 5 kHz exp-decay
   recipe from `v2-pseudocoda.js`). Reuses `exchanges.json` unchanged.

2. **LTSA-style corpus heat-clock.** SVG. Extends `pipeline/bundle.py` to emit
   `corpus_timeline.json` from `DominicaCodas.csv` (Dataset 1, 8,719 codas, 2005-2018).
   Dataset 1 has `Date` (DD/MM/YYYY) but no time-of-day, so the LTSA reduces to a 2-D
   density grid: X = year×month (156 columns across 13 years), Y = day-of-week (7 rows).
   Cell shading = `log(count + 1)`, baked through an OKLCH magma-like ramp (extending
   `pipeline/colour.py`). Caption flags the limitation explicitly. An auto-advancing month
   cursor highlights the current column and shows the year/month label plus coda count.

3. **PPI rotating sonar sweep.** Canvas 2D. 18 spokes (one per rhythm cluster, mapped to
   bearings 0-360°), constant 6 rpm. Spoke intensity = sliding-window count of codas in
   that rhythm cluster as the global clock scrubs through the deployment timeline.
   Alpha-decay trail for persistence. Stylised, not a real bearing-array output —
   caption is honest about this.

Shared clock module (`web/v3-clock.js`) exports a `PlaybackClock` singleton with
`play / pause / toggle / setSpeed / setCursor / subscribe`, RAF-driven. UI controls live
above the v3 sections: play/pause button, speed selector (0.5× / 1× / 2× / 4×), master
scrubber, and a monospace date readout. Sections subscribe on mount and unsubscribe on
tab hide to save battery.

Architecture rules: vanilla ESM, canvas/SVG only, no bundler. v1 and v2 modules untouched.
Tab router stays hash-based (`#v3`, `#v3/rasterplot`, etc.). AudioContext created on first
user gesture in §1 only. Perceptually uniform colour ramps only — no jet/rainbow.
