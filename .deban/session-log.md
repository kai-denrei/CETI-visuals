# Session Log — CETI-visuals

Append-only timestamped event log. Newest at bottom.

2026-05-18 14:00 — INIT — mode: solo, roles: pm, arch, dev, ux, qa, devops
2026-05-18 18:30 — V1 SHIPPED — pipeline + web complete. All three QA checkpoints pass. Headless puppeteer smoke test confirms all four visualisations render. Server: `make serve` → `http://localhost:8000/web/`.
2026-05-18 22:15 — V2 SHIPPED — tab nav + three WhAM-inspired modules (v2-pseudocoda, v2-translation, v2-unmask). v1 unchanged. Zero JS errors in headless sweep across both tabs and all interactions. Cache-bust token bumped to d0a1610d. View: `make serve` → `http://localhost:8000/web/#v2`.
2026-05-18 23:50 — V3 SHIPPED — third tab (hydroacoustics) with shared `PlaybackClock` singleton and three new modules: `v3-rasterplot` (live playhead + opt-in audio), `v3-ltsa` (OKLCH magma corpus heat-clock from `corpus_timeline.json`), `v3-ppi` (rotating sonar sweep). `pipeline/bundle.py` extended to emit `corpus_timeline.json` from `DominicaCodas.csv`. v1 and v2 unchanged. Nine v3 verification gates PASS, zero JS errors in headless sweep. Cache-bust token bumped to 0215de45. View: `make serve` → `http://localhost:8000/web/#v3`.
