# Hydroacoustics — Interactive Visualisation Study

## Mission

Build interactive visualisations of the canonical hydroacoustic display types: echograms,
spectrograms, LTSAs, side-scan imagery, bathymetric maps, density heatmaps, beamformer polars.
Two reasons for the detour: (1) accumulate a reusable vocabulary of hydroacoustic rendering
primitives that the main CETI work can borrow from — the spectrogram and click-train
renderers in particular port directly; (2) place CETI's coda-scale visualisations in
oceanographic context, since the same ICI staircase reads differently when you can zoom
out to a season-long LTSA of the deployment that contained it.

Sub-project. Outputs land in `./hydroacoustics/`. Primitives that survive review get lifted
into `./web/` for the main project.

## Display types, ranked by reproduction value

1. **Spectrogram with overlay layer** — frequency (y) × time (x) × power (colour). Controls:
   FFT window, hop, log/mel/linear y-axis, dB floor/ceiling. Overlay channel for click
   detections, coda boundaries, manual annotations. Ports directly to CETI work. Start here.

2. **Echogram** — range/depth (y) × ping time (x) × echo amplitude (colour). Signature output
   of every echo sounder survey. Controls: dynamic-range slider, depth-profile cursor on
   hover, time-zoom from full deployment to single ping, threshold mask, target overlay.
   Canvas 2D fine for moderate data; WebGL fragment shader for live colourmap remap on
   large arrays.

3. **Long-Term Spectral Average (LTSA)** — spectrogram compressed in time to render days /
   weeks / months in one frame. Reveals diel patterns, shipping, biological choruses,
   weather. Interactive layer: pyramidal precomputed levels for scrub-zoom from year to
   second. Recognisable instantly to anyone who has worked with long deployments.

4. **Side-scan sonar waterfall** — port and starboard channels mirrored along a track line,
   showing seafloor texture. Iconic (shipwrecks). Pan along track, slant-range correction
   toggle, intensity remap.

5. **Beamforming polar plot** — directional energy vs bearing. Rotate, snapshot, overlay
   two bearings. Useful for any directional-array work; relevant to whale localisation.

6. **Click-train rasterplot** — vertical ticks for click times across channels / animals.
   A coda is a structured click train; this is a direct CETI tie-in.

7. **Bathymetric map** — hillshaded 2D or 3D from MBES data. Standard cartography with
   acoustic provenance.

8. **Density / biomass heatmap on a basemap** — fisheries-style geo-referenced abundance.

9. **PPI (Plan Position Indicator)** — radar-style circular sweep. Not analytically deep,
   but a satisfying rendering exercise: rotating sweep, fade-out persistence, polar-to-
   cartesian sampling.

10. **Wenz-curve ambient noise budget** — frequency-domain envelope showing contributions
    of wind, shipping, biological noise. Reference plot. Static. Worth building for context
    that grounds the other displays.

Push back on any that don't survive contact with real data. If LTSA is pointless without
months of audio on hand, defer and log in Dead Ends.

## Open datasets

Pick one dataset per display type. Document the choice in REPRO_PLAN. Do not aggregate.

- **NOAA NCEI Passive Acoustic Data Archive** — multi-year hydrophone deployments. Best
  for LTSA.
- **MBARI MARS Cabled Observatory** — continuous hydrophone; public Soundscape Listening
  Room. Good for spectrogram demos.
- **Ocean Networks Canada** — Endeavour / NEPTUNE / VENUS arrays; hydrophone, ADCP, MBES.
- **Watkins Marine Mammal Sound Database** — decades of marine mammal clips. Good for
  click-train and spectrogram primitives.
- **DCLDE workshop datasets** — Detection, Classification, Localization, Density Estimation.
  Curated for algorithm development.
- **Orcasound** — live orca streams from the Salish Sea.
- **GEBCO** — global bathymetric grid for basemaps.
- **EMODnet Bathymetry** — European seafloor.
- **NOAA fisheries acoustic survey data** — echograms with companion biological samples.

## Reference tools

Listed to know the canon, not to wrap or reimplement.

- **echopype** — Python. Parses raw EK60/EK80/AZFP/Ad2CP into xarray; computes calibrated
  `Sv` (volume backscattering strength). Open-source standard for fisheries echograms.
  Acceptable as a raw-file reader; nothing else.
- **PAMGuard** — Java. Passive acoustic monitoring with click detector and classifier.
  Reference for detection-overlay UX.
- **Raven Pro / Lite** — Cornell. Spectrogram annotation; field-standard UI.
- **Triton** — MATLAB, Scripps Whale Acoustics Lab. LTSA tooling reference.
- **librosa** — Python. General-purpose spectrogram primitives.
- **Echoview** — commercial; fisheries standard echogram software. UX reference for what
  professionals expect.

## Constraints

Inherited from the parent project plus a few specific to this domain:

- No PII.
- Dark editorial aesthetic. Serif body, monospace for numeric labels. Amber/teal accents
  sparingly. Avoid the "ocean-engineering Windows 95" look that pervades this field's
  tooling.
- **Perceptually uniform colourmaps only.** Hydroacoustic publications still routinely use
  jet/rainbow. Reject. Use viridis-family, magma, or hand-designed OKLCH ramps. OKLCH
  internally; sRGB only at export.
- Vanilla ES modules. Canvas 2D for moderate data; WebGL fragment shaders where live
  colourmap remap or >~1M pixel resampling is needed. No d3 unless a specific plot earns it.
- Python side: numpy / scipy / pandas / matplotlib / xarray fine.
- Compression over completeness in any prose output.

## Working layout

```
hydroacoustics/
├── HYDROACOUSTICS.md         # this file
├── REPRO_PLAN.md             # written before any code
├── DEAD_ENDS.md              # append-only
├── data/                     # raw + derived; gitignore raw; provenance documented per file
├── notebooks/                # one display type per notebook
├── primitives/               # reusable renderers (spectrogram.js, echogram.js, …)
└── demos/                    # one HTML page per interactive display, vanilla ESM
```

## Dead Ends

Append-only. Every approach tried and abandoned: what was tried, why it failed, what would
need to change to revisit.

(empty — to be filled)

## First move

1. Read this brief. Read the main project's `CLAUDE.md` if not already in context.
2. Pick **one** display type. Default: spectrogram — transfers most directly to CETI, works
   with the smallest dataset.
3. Pick one dataset for that display type. Document provenance.
4. Write `REPRO_PLAN.md`: chosen display, chosen data, ranked target features, what "done"
   looks like for v1, what is explicitly deferred.
5. Stop. Surface the plan before any rendering code.

Do not start multiple displays in parallel. Do not start by building a "framework." Each
display type is self-contained until a primitive demonstrates reusability across at least
two of them.
