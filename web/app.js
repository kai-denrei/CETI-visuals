// CETI-visuals — entry point.
// Loads the JSON bundles, mounts each section module, wires the v1/v2/v3 tab
// bar. Tab + section state lives in location.hash, e.g. #v2/pseudocoda or
// #v3/ltsa.

import { mountExchange } from "./exchange-plot.js";
import { mountGrid } from "./alphabet-grid.js";
import { mountContext } from "./context-dist.js";
import { mountEmbedding } from "./embedding.js";

import { mountPseudocoda } from "./v2-pseudocoda.js";
import { mountTranslation } from "./v2-translation.js";
import { mountUnmask } from "./v2-unmask.js";

import { clock, TIMELINE, cursorToYearMonth } from "./v3-clock.js";
import { mountRasterplot } from "./v3-rasterplot.js";
import { mountLtsa } from "./v3-ltsa.js";
import { mountPpi } from "./v3-ppi.js";

import { mountGauges } from "./v4-gauges.js";
import { mountSonar } from "./v4-sonar.js";
import { mountAltimeter } from "./v4-altimeter.js";

const BASE = "../data/derived/";

async function loadJSON(name, optional = false) {
  const r = await fetch(BASE + name, { cache: "no-store" });
  if (!r.ok) {
    if (optional) return null;
    throw new Error(`Failed to fetch ${name}: ${r.status}`);
  }
  return r.json();
}

async function main() {
  const [codas, exchanges, clusters, timeline] = await Promise.all([
    loadJSON("codas.json"),
    loadJSON("exchanges.json"),
    loadJSON("clusters.json"),
    loadJSON("corpus_timeline.json", true),
  ]);

  const codaById = new Map(codas.map(c => [c.id, c]));

  // Header meta (tab-independent)
  document.getElementById("m-codas").textContent = clusters.n_codas.toLocaleString();
  document.getElementById("m-exchanges").textContent = String(clusters.n_exchanges);
  const speakers = new Set(codas.map(c => c.speaker));
  document.getElementById("m-speakers").textContent = String(speakers.size);
  document.getElementById("m-orn").textContent =
    (clusters.ornament_rate * 100).toFixed(2) + "%";

  const bus = new EventTarget();
  const ctx = { codas, exchanges, clusters, codaById, bus, timeline };

  // v1 modules
  mountExchange(ctx);
  mountGrid(ctx);
  mountContext(ctx);
  mountEmbedding(ctx);

  // v2 modules
  mountPseudocoda(ctx);
  mountTranslation(ctx);
  mountUnmask(ctx);

  // v3 modules — keep handles so we can attach/detach on tab switch.
  const v3Modules = [
    mountRasterplot(ctx),
    mountLtsa(ctx),
    mountPpi(ctx),
  ].filter(Boolean);

  // v4 modules — attach/detach mirror v3 pattern.
  const v4Modules = [
    mountGauges(ctx),
    mountSonar(ctx),
    mountAltimeter(ctx),
  ].filter(Boolean);

  // ---- v3 clock UI wiring -------------------------------------------------
  const playBtn = document.getElementById("v3-playpause");
  const speedBtns = document.querySelectorAll(".v3-speed button");
  const scrubber = document.getElementById("v3-scrubber");
  const readout = document.getElementById("v3-readout");

  if (playBtn && scrubber && readout) {
    playBtn.addEventListener("click", () => clock.toggle());
    speedBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const x = parseFloat(btn.dataset.speed);
        clock.setSpeed(x);
        speedBtns.forEach(b => b.classList.toggle("is-active", b === btn));
      });
    });
    scrubber.addEventListener("input", () => {
      clock.setCursor(parseFloat(scrubber.value) / 1000);
    });
    // Top-level subscriber to drive the chrome.
    clock.subscribe(state => {
      playBtn.textContent = state.playing ? "❚❚" : "▶";
      playBtn.classList.toggle("is-on", state.playing);
      // Avoid overwriting user-drag input — only update slider if it differs.
      const v = Math.round(state.cursor * 1000);
      if (parseInt(scrubber.value, 10) !== v) scrubber.value = String(v);
      readout.textContent = cursorToYearMonth(state.cursor);
    });
  }

  // Tab routing -------------------------------------------------------------
  const panes = {
    v1: document.querySelector('[data-pane="v1"]'),
    v2: document.querySelector('[data-pane="v2"]'),
    v3: document.querySelector('[data-pane="v3"]'),
    v4: document.querySelector('[data-pane="v4"]'),
  };
  const tocs = {
    v1: document.getElementById("toc-v1"),
    v2: document.getElementById("toc-v2"),
    v3: document.getElementById("toc-v3"),
    v4: document.getElementById("toc-v4"),
  };
  const tabs = {
    v1: document.getElementById("tab-v1"),
    v2: document.getElementById("tab-v2"),
    v3: document.getElementById("tab-v3"),
    v4: document.getElementById("tab-v4"),
  };
  const clockBar = document.getElementById("v3-clockbar");

  let activeTab = "v1";

  function setTab(tab, scrollTarget) {
    activeTab = tab;
    for (const k of Object.keys(panes)) {
      const isActive = k === tab;
      if (panes[k]) panes[k].hidden = !isActive;
      if (tocs[k]) tocs[k].hidden = !isActive;
      if (tabs[k]) {
        tabs[k].classList.toggle("is-active", isActive);
        tabs[k].setAttribute("aria-selected", String(isActive));
      }
    }
    // Clockbar is shared between v3 and v4.
    if (clockBar) clockBar.hidden = !(tab === "v3" || tab === "v4");
    // Subscription gates — only attach when the pane is visible.
    if (tab === "v3") {
      v3Modules.forEach(m => m.attach && m.attach());
      v4Modules.forEach(m => m.detach && m.detach());
    } else if (tab === "v4") {
      v4Modules.forEach(m => m.attach && m.attach());
      v3Modules.forEach(m => m.detach && m.detach());
    } else {
      v3Modules.forEach(m => m.detach && m.detach());
      v4Modules.forEach(m => m.detach && m.detach());
      // Auto-pause when leaving the clocked tabs — playback should not run invisibly.
      clock.pause();
    }
    if (scrollTarget) {
      const el = document.getElementById(scrollTarget);
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    }
    // Trigger a resize so canvas modules reflow to their (now visible) widths.
    window.dispatchEvent(new Event("resize"));
  }

  function applyHash() {
    const h = location.hash.replace(/^#/, "");
    let tab = "v1", target = null;
    if (h.startsWith("v4")) tab = "v4";
    else if (h.startsWith("v3")) tab = "v3";
    else if (h.startsWith("v2")) tab = "v2";
    if (h.includes("/")) target = h;
    setTab(tab, target);
  }

  tabs.v1.addEventListener("click", () => { location.hash = "v1"; });
  tabs.v2.addEventListener("click", () => { location.hash = "v2"; });
  if (tabs.v3) tabs.v3.addEventListener("click", () => { location.hash = "v3"; });
  if (tabs.v4) tabs.v4.addEventListener("click", () => { location.hash = "v4"; });
  window.addEventListener("hashchange", applyHash);

  applyHash();
}

main().catch(err => {
  console.error(err);
  document.querySelector("main").insertAdjacentHTML(
    "afterbegin",
    `<div style="padding:1rem;background:#3a1818;border:1px solid #6b2828;color:#f0b8b0;font-family:var(--mono)">
       Failed to load data: ${err.message}<br/>
       Make sure you serve from the repo root: <code>make serve</code> → http://localhost:8000/web/
     </div>`
  );
});
