# Project CETI — Investigation & Visual Reproduction

## Mission

Investigate Project CETI's published work on sperm whale communication and reproduce locally the
key visuals that operationalise its core concepts. The bar is *understanding through rebuilding*,
not pixel-matching the published figures. Each reproduction should make a concept legible from
the data alone.

## Context (compressed)

Project CETI = Cetacean Translation Initiative. Multi-institution (MIT CSAIL, CUNY, Dominica
Sperm Whale Project, etc.). Studies the Eastern Caribbean 1 (EC-1) clan via biologging D-tags
and hydrophones. Two anchor results:

1. **Sharma et al., Nat Commun, May 2024** — *Contextual and Combinatorial Structure in Sperm
   Whale Vocalisations*. Reframes the coda inventory from ~21 types to ~156 distinguishable
   codas via four axes: **rhythm**, **tempo**, **rubato**, **ornamentation**. Rhythm and tempo
   are context-independent; rubato (smooth tempo modulation across an exchange) and
   ornamentation (an added terminal click) are context-dependent.
2. **Coda-vowel phonology, late 2024** — when ICI silences are compressed out, codas reveal
   formant-like structure clustering into two vowel-like categories ("a" / "i").

Sperm whales emit codas: short bursts of 3–40 broadband clicks. The fundamental measurement is
the **inter-click interval (ICI)** sequence per coda. Everything else is downstream of ICIs.

## Primary source

- Repo: `pratyushasharma/sw-combinatoriality` (mirrored at `Project-CETI/sw-combinatoriality`).
- Dataset: 8,719 manually annotated codas from EC-1, recordings 2005–2018, including D-tag
  audio 2014–2018. Includes click timestamps → ICI sequences per coda, plus context
  (vocaliser ID where available, exchange grouping).
- Paper PDF: <https://www.biorxiv.org/content/10.1101/2023.12.06.570484.full.pdf>

First move: clone the repo, inventory what's in it (notebooks, data files, scripts → figures
mapping), and produce a `REPRO_PLAN.md` before writing any code. Do not start figures until
the plan exists.

## Visuals to reproduce (priority order)

1. **ICI-vs-click-index "musical score" per exchange.** One coda = a small staircase of ICIs
   indexed by click position. An exchange = two staircases overlaid, visibly co-varying in
   tempo (rubato) and gaining/losing trailing clicks (ornamentation). Headline figure. Most
   rewarding to render from scratch — natural fit for canvas 2D or SVG.

2. **2D embedding of the coda repertoire.** Whatever feature space and projection the paper
   uses (UMAP / t-SNE / PCA — confirm from code, do not assume), producing the ~156-cluster
   structure. Good substrate for OKLCH-driven density / hexbin plots.

3. **Context-conditional distributions of rubato & ornamentation.** Given partner's previous
   coda, distribution over the focal whale's rubato/ornamentation. Aligned-pair heatmaps or
   Sankey are both legitimate; pick whichever survives the data shape.

4. **Combinatorial grid: rhythm × tempo × {rubato} × {ornamentation}.** Small-multiples
   faceting of the repertoire. The Alex Boersma press illustration is a stylised version —
   the goal here is the data-driven one.

Push back on figures that don't earn their ink. If a visual reproduces but doesn't reveal
the concept more clearly than a sentence would, note it as such in Dead Ends.

## Secondary work

- **Coda-vowel phonology** (`Project-CETI/coda-vowel-phonology`). Different primitives:
  spectrograms, ICI-compressed waveforms, formant scatter plots. Treat as a separate sub-
  project once the combinatoriality figures are landed. Do not interleave.

## Other repos (brief, mostly out of scope for v1)

| Repo                               | What it is                                    | In scope?         |
|------------------------------------|-----------------------------------------------|-------------------|
| `tag-vizier`                       | Viewer for multimodal tag data                | Reference only    |
| `avatars-code`                     | Whale ID/tracking from segmentation masks     | No                |
| `data-ingest`                      | Tag → cloud → dataset pipeline                | No                |
| `whale-tag-embedded` / `-recovery` | Firmware / hardware                           | No                |
| `libCetiRecovery`                  | Tag ↔ recovery board protocol                 | No                |
| `Predicting-Mesoscale-Movements-…` | Social dynamics, supplementary data only      | Maybe later       |

Most recent paper at time of writing: cooperation by non-kin during sperm whale births,
Maalouf/DelPreto/Lucas/Poetto et al., *Science* 2026. No public code located yet — check
the org page again at end of project.

## Constraints

- **No PII** in any generated file, notebook, screenshot, or commit message. Keep outputs
  anonymous / generic.
- **Aesthetic**: dark editorial. Serif body + monospace for data labels. Amber/teal accents
  permitted, used sparingly. Avoid dashboard-template look. The figures should feel closer
  to a printed scientific monograph than to a SaaS analytics tile.
- **Colour**: OKLCH as the internal representation for any palette work; sRGB only at export.
- **No framework bloat** for any web-side rendering. Vanilla ES modules; canvas 2D or SVG.
  Python side: numpy / scipy / pandas / matplotlib are fine. Avoid plotly / bokeh / seaborn
  unless they earn it.
- **Compression over completeness** in prose outputs. Notebooks should read like working
  notes, not tutorials.

## Working layout

```
./
├── CLAUDE.md            # this file
├── REPRO_PLAN.md        # written before any code
├── DEAD_ENDS.md         # see below — append-only
├── data/                # raw + derived; gitignore raw
├── notebooks/           # exploration, one concept per notebook
├── figures/             # exported svg/png; named <concept>_<variant>
└── web/                 # any browser-rendered visuals; vanilla ESM
```

## Dead Ends

Append-only log. Every approach that was tried and abandoned goes here with: what was tried,
why it didn't work, and what would need to change to revisit. No silent retreats.

(empty — to be filled)

## First move (literal)

1. `git clone https://github.com/pratyushasharma/sw-combinatoriality data/sw-combinatoriality`
2. Inventory the repo: top-level files, data files with shapes, notebooks with their figure
   outputs, any preprocessing scripts. Map script → figure.
3. Write `REPRO_PLAN.md`: which paper figures map to which scripts, which are reproducible
   from the included data alone, which require external assets, and the proposed order of
   reproduction with rough effort estimates.
4. Stop. Surface the plan before writing reproduction code.
