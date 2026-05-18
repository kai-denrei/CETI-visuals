PY := .venv/bin/python
PIP := .venv/bin/pip

.PHONY: help venv bundle figures serve clean

help:
	@echo "Targets:"
	@echo "  venv     — create .venv and install Python deps"
	@echo "  bundle   — pipeline/bundle.py: emit data/derived/*.json from raw"
	@echo "  figures  — pipeline/figures.py: emit figures/*.png|svg"
	@echo "  bust     — bump cache-busting token (run after editing assets)"
	@echo "  serve    — start a local static server on http://localhost:8000 (web/)"
	@echo "  clean    — remove .venv, derived bundles, generated figures"

bust:
	cd web && bash scripts/bust.sh

venv:
	python3 -m venv .venv
	$(PIP) install -q --upgrade pip
	$(PIP) install -q numpy pandas scipy matplotlib jupyter

bundle:
	$(PY) -m pipeline.bundle

figures:
	$(PY) -m pipeline.figures

serve:
	@echo "Serving CETI-visuals at http://localhost:8000/web/"
	python3 -m http.server 8000

clean:
	rm -rf .venv data/derived/*.json figures/*.png figures/*.svg
