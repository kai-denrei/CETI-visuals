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
| 2026-05-18 | **Cache-busting toolkit installed** at `web/scripts/` + `web/public/cb-shapes/` + `web/public/cb-badge.js`. URL fingerprinting (`?v=<token>`) + anti-cache meta tags + favicon-shape rotation + corner badge. Wired into Makefile as `make bust`. Token bumped on each phase: v1→v2 was `2be66d72`/`5cea4c10`; v2→v3 was `d0a1610d`; v3→v4 was `0215de45`; v4 = `a185adb0`. Favicon shape rotates with every bump as visual confirmation. | Without this, each iteration on a deployed site risked Gerald seeing a stale build. The shape favicon is the at-a-glance "did the bust take?" signal that survives even when the developer console isn't open. | [[arch]] [[ux]] |
| 2026-05-18 | **Patched cache-busting paths from absolute to relative** (e.g. `/cb-shapes/43.svg` → `public/cb-shapes/43.svg`) because the server roots at the repo, not at `web/`. The default toolkit assumes a typical project layout with assets at root. `bust.sh`'s regex still rewrites the numbered cell across bumps; verified after a bump cycle. | Absolute paths would 404 under our two-deep serve layout. Rewrote rather than re-rooting the server, since the latter would have invalidated the v1 `../data/derived/` fetches. | [[arch]] |
| 2026-05-18 | **Public release on GitHub Pages** at `https://kai-denrei.github.io/CETI-visuals/`. Repo `kai-denrei/CETI-visuals` is public; default branch `main`; Pages source = `main / /`; root `index.html` is a 0-second meta-refresh redirect to `web/`. Repo homepage set to the Pages URL. | A public live URL lets anyone open the work without a clone or a venv. Root redirect is simpler than restructuring `web/` into `docs/` (which would have broken the local dev pattern) or routing through a workflow-driven `gh-pages` branch (over-engineered for static content). | [[arch]] |
| 2026-05-18 | **Gitignore excludes the two heavy reference PDFs** (`s41467-024-47221-8.pdf` 1.4 MB, `miscCETI_Notes/` 22 MB+) and `data/sw-combinatoriality/` (the raw cloned source) — all linked from `CLAUDE.md` so a future agent can re-fetch on demand. `data/derived/*.json` IS committed (~927 KB total) so the live site works from a clean clone. | A 22 MB PDF in the repo would slow every clone for content that's already canonically available elsewhere. Derived data is small and load-bearing for the site; raw data is large and reproducible. | [[arch]] |

## Session Log
- 2026-05-18 — v3 + v4 deployments: cache-bust tokens bumped per phase (`0215de45` → `a185adb0`); favicon rotated cell `28 → 16 → 33`; Pages rebuilt cleanly on each push.
- 2026-05-18 — Public release: created `kai-denrei/CETI-visuals` on GitHub, pushed `main`, enabled Pages, set repo homepage. Build duration ~35-50s; HTTP 200 on all critical assets from the CDN.
- 2026-05-18 — Cache-busting toolkit installed; favicon-shape rotation wired; absolute → relative path patch for our two-deep serve layout.
- 2026-05-18 — Local env, serve path, gitignore strategy, and Makefile pattern recorded.
- 2026-05-18 — Makefile.serve updated to serve from repo root (was: `cd web && python -m http.server`); URL is now `http://localhost:8000/web/`.
