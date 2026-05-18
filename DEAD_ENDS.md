# Dead Ends — CETI-visuals

Append-only. Every approach that was tried and abandoned: what was tried, why it failed,
what would need to change to revisit. No silent retreats.

---

## 2026-05-18 — REPRO_PLAN's "3839 vs 3840 pickle/CSV mismatch"

**Tried:** Building a defensive alignment layer in `pipeline/load.py` to reconcile a
supposed off-by-one between `sperm-whale-dialogues.csv` (3839 data rows per the
source notebooks) and the pickled label arrays (3840 entries).

**Why it failed / was rejected:** There is no mismatch. The source notebooks use
`numpy.genfromtxt(...)` which loads the header as row 0 and then indexes via
`my_data[1:]`, giving an off-by-one when comparing `my_data.shape[0]` to `len(rhythms)`.
With `pandas.read_csv` (which discards the header automatically), the dataframe has
3840 rows and aligns 1:1 with all four pickles by zero-based index. Verified with
`assert len(df) == len(rhythms) == len(ornaments) == 3840`.

**What would need to change to revisit:** Nothing for the public data. If a future
release of `sw-combinatoriality` changes pickle layout, re-verify by `assert`.

---

## 2026-05-18 — `tempos-dict.p` as a per-coda tempo cluster label source

**Tried:** Using `tempos-dict.p` (dict[cluster → list of durations]) directly as
per-coda tempo labels by reverse-indexing each duration back to its cluster.

**Why it failed / was rejected:** The pickle's membership sums to 3,808 (=
723+236+743+524+1582), not 3,840 — 32 codas with `Duration=0` were dropped before
the source's GMM fit. Reverse-indexing is therefore both lossy and ambiguous when
duplicate durations land in different clusters. The source itself uses
piecewise duration thresholds `{0.45, 0.61, 0.93, 1.08}` (`return_tempo()` in
4-rubato.ipynb) for all downstream conditional analysis — so do we.

**What would need to change to revisit:** Use the GMM/KDE membership only if a
future analysis specifically requires the soft-cluster posteriors (not just hard
labels). Bake them as a parallel column.

---

## 2026-05-18 — v2: extracting a shared `web/lib/features.js` for PCA

**Tried:** Pulling the 20-D feature-vector build + power-iteration PCA out of
`embedding.js` into a shared `web/lib/features.js` so that the translation
lattice could call the same recipe without inline-copying.

**Why it failed / was rejected:** Only one duplicate site. The brief warned
against over-DRY for a single duplicate, and the inline copy is ~60 lines of
known-good code that hasn't been touched since v1. Pulling it out would
introduce a new module surface with no second consumer to motivate it. If a
third visual ever needs the same projection, extract then.

**What would need to change to revisit:** A third consumer of the PCA recipe,
or a change to the feature spec that needs to ripple across both v1 embedding
and v2 translation simultaneously.

---

## 2026-05-18 — v2: precomputed nearest-neighbour table in `bundle.py`

**Tried:** Considered emitting a `pipeline/bundle.py` table of
`(coda_id → nearest_natural_id, distance)` so the translation lattice could
skip the in-browser brute-force NN search.

**Why it failed / was rejected:** Brute-force NN at N=3840, D=20 is sub-2ms per
prompt; we have 5 prompts; total <10ms even on cold cache. Precomputation would
have meant extending the JSON bundle (breaks the contract), choosing a metric
at bake time (locks out the toggle), and shipping more data for zero perceived
latency win. Premature optimisation.

**What would need to change to revisit:** Move to N≥100k coda candidates, or
ship a model-derived feature space where the projection cost exceeds the NN
cost.

---

## 2026-05-18 — v2: actually running a transformer in the browser

**Tried:** Considered shipping a small distilled VampNet-style model via
onnxruntime-web to make the unmask step a real masked-token prediction rather
than a 1-NN surrogate.

**Why it failed / was rejected:** WhAM's checkpoint isn't released yet, the
DAC codec assumes a Python+torch stack, and even a stripped student model
weighs in at tens of MB — instantly violating the CLAUDE.md "no framework
bloat, no build step" mandate. The 1-NN-over-ICI-sequences surrogate captures
the *pattern* WhAM exhibits (mask → confidence-ordered iterative reveal)
without claiming the substrate is acoustic tokens.

**What would need to change to revisit:** A published WhAM checkpoint in a
browser-friendly format AND a relaxation of the no-bundler constraint, AND a
genuine user need that the surrogate fails to convey.

---

## 2026-05-18 — v4: perceptually uniform colourmap for the ISS360 polar and ISA500 echogram

**Tried:** Considered using the project's standard OKLCH-baked magma ramp (the
one v3 uses for the LTSA) for v4's sonar polar and altimeter echogram instead
of jet, so the no-rainbow rule from `HYDROACOUSTICS.md` would hold across all
four tabs.

**Why it failed / was rejected:** v4's brief is *reconstruction* of the Impact
Subsea seaView operator software, not improvement on it. The source instrument
ships with jet, every operator who has used the hardware reads the display
with jet, and substituting a different ramp would actively break the
"recognise the source software at a glance" goal that justifies v4 existing
in the first place. The override is bounded to v4 only — v1, v2, and v3 keep
their perceptually-uniform discipline; the rule is unchanged everywhere except
the one tab whose entire purpose is faithful imitation.

**What would need to change to revisit:** v4 being promoted from
"reconstruction" to "general hydroacoustic primitive" — i.e. lifted out of
the seaView lineage and reused for arbitrary sonar/echogram displays.
At that point the brief stops being faithful imitation and the rainbow
rule re-applies.

---

## 2026-05-18 — v4: simulated audio click / sonar ping

**Tried:** Considered synthesising the audible ping for the ISS360 sweep (a
short ~50 ms tone burst per ping) and the ISA500 echo return.

**Why it failed / was rejected:** The source software itself doesn't synthesise
audio — the sonar is silent at the operator console; only the underwater
acoustics matter. Adding audio would be inventing UX the brief explicitly
says to reconstruct, not improve. Also: the v3 audio toggle is already the
project's audio surface, and duplicating that pattern for a tab that has no
audio in source is gratuitous.

**What would need to change to revisit:** A specific Gerald request to add a
sonar-ping audio cue, or a need to teach the rhythm of the sweep through a
non-visual channel (e.g. accessibility).

