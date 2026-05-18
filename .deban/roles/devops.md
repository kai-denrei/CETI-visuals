---
role: devops
owner: Gerald
status: active
last-updated: 2026-05-18
---

# DevOps / Local Environment

## Scope

Local environment, data ingestion, build/serve steps, and the one-command path that makes
v1 "work locally" for Gerald.

## Decisions

| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-18 | Python via `uv` (or system Python 3.11+ as fallback). Single requirements file at repo root: `numpy pandas scipy matplotlib` | `uv` is fast and reproducible; the dep set is intentionally small | [[arch]] |
| 2026-05-18 | Local serve = `python3 -m http.server 8000` from `web/`. No bundler, no node | Zero-install for serving the web layer. CLAUDE.md mandates no framework bloat — extending that to no build chain | [[arch]] |
| 2026-05-18 | Raw data (cloned `sw-combinatoriality` repo) lives in `data/sw-combinatoriality/` and is gitignored. Derived data (the JSON bundles consumed by web/) lives in `data/derived/` and IS committed so the web app works after a fresh clone of this repo without re-running the Python | Reproducibility of the *visual* experience matters more than re-running the science every time. Derived data is small (kB-MB) | [[dev]] |
| 2026-05-18 | One Makefile-style runner (`make figures` / `make bundle` / `make serve`) wrapping the four common entry points | Documents the workflow; one command per task | |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->

| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] If the source repo is Matlab-only with no Python loader, do we need a one-off Matlab → CSV conversion step? Would prefer to avoid by porting the loader to Python — owner: [[dev]] — since: 2026-05-18

## Assumptions
- [System has Python 3.11+ and a recent browser (Chrome/Safari/Firefox with ES2022 modules)] — status: validated — since: 2026-05-18 (kainode Mac Mini M4)
- [Raw data fits comfortably in memory — 8719 codas × tens of click timestamps each is well under 100 MB] — status: untested — since: 2026-05-18

## Dependencies
Blocked by: nothing
Feeds into: [[dev]] [[qa]]

## Decisions

| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-18 | **Serve from repo root, not from `web/`** — URL is `http://localhost:8000/web/` and JS fetches `../data/derived/*.json`. | Lets the web layer read the committed JSON bundle without symlinks or duplication. `make serve` updated accordingly. | [[arch]] |

## Session Log
- 2026-05-18 — Local env, serve path, gitignore strategy, and Makefile pattern recorded.
- 2026-05-18 — Makefile.serve updated to serve from repo root (was: `cd web && python -m http.server`); URL is now `http://localhost:8000/web/`.
