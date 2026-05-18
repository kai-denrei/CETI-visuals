// CETI-visuals — entry point.
// Loads the three JSON bundles, mounts each section module, wires the v1/v2
// tab bar. Tab + section state lives in location.hash, e.g. #v2/pseudocoda.

import { mountExchange } from "./exchange-plot.js";
import { mountGrid } from "./alphabet-grid.js";
import { mountContext } from "./context-dist.js";
import { mountEmbedding } from "./embedding.js";

import { mountPseudocoda } from "./v2-pseudocoda.js";
import { mountTranslation } from "./v2-translation.js";
import { mountUnmask } from "./v2-unmask.js";

const BASE = "../data/derived/";

async function loadJSON(name) {
  const r = await fetch(BASE + name, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to fetch ${name}: ${r.status}`);
  return r.json();
}

async function main() {
  const [codas, exchanges, clusters] = await Promise.all([
    loadJSON("codas.json"),
    loadJSON("exchanges.json"),
    loadJSON("clusters.json"),
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
  const ctx = { codas, exchanges, clusters, codaById, bus };

  // v1 modules
  mountExchange(ctx);
  mountGrid(ctx);
  mountContext(ctx);
  mountEmbedding(ctx);

  // v2 modules
  mountPseudocoda(ctx);
  mountTranslation(ctx);
  mountUnmask(ctx);

  // Tab routing -------------------------------------------------------------
  const v1Pane = document.querySelector('[data-pane="v1"]');
  const v2Pane = document.querySelector('[data-pane="v2"]');
  const tocV1 = document.getElementById("toc-v1");
  const tocV2 = document.getElementById("toc-v2");
  const tabV1 = document.getElementById("tab-v1");
  const tabV2 = document.getElementById("tab-v2");

  function setTab(tab, scrollTarget) {
    const isV2 = tab === "v2";
    v1Pane.hidden = isV2;
    v2Pane.hidden = !isV2;
    tocV1.hidden = isV2;
    tocV2.hidden = !isV2;
    tabV1.classList.toggle("is-active", !isV2);
    tabV2.classList.toggle("is-active", isV2);
    tabV1.setAttribute("aria-selected", String(!isV2));
    tabV2.setAttribute("aria-selected", String(isV2));
    if (scrollTarget) {
      const el = document.getElementById(scrollTarget);
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    }
    // Trigger a resize so canvas modules reflow to their (now visible) widths
    window.dispatchEvent(new Event("resize"));
  }

  function applyHash() {
    const h = location.hash.replace(/^#/, "");
    // Forms: "v1", "v2", "v1/exchange", "v2/pseudocoda" (no slash = tab only)
    let tab = "v1", target = null;
    if (h.startsWith("v2")) tab = "v2";
    if (h.includes("/")) target = h;  // e.g. "v2/pseudocoda" is the section id
    setTab(tab, target);
  }

  tabV1.addEventListener("click", () => {
    location.hash = "v1";
  });
  tabV2.addEventListener("click", () => {
    location.hash = "v2";
  });
  window.addEventListener("hashchange", applyHash);

  // Set initial tab from hash; if none, default to v1.
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
