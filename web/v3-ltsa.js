// v3 — Section 2 — LTSA-style corpus heat-clock.
//
// SVG heatmap. X = year×month (156 columns across 2005-2017), Y = day-of-week.
// Cell shading = log(coda count + 1) against a perceptually uniform OKLCH-baked
// magma ramp.
//
// An auto-advancing column cursor — driven by the shared PlaybackClock — sweeps
// across the deployment timeline, highlighting the current month and showing
// monospaced year/month plus that month's coda count. Click any cell to jump
// the global cursor to that month.

import { clock, cursorToMonthIndex, TIMELINE } from "./v3-clock.js";

const INK = "#e8e6dd";
const MUTED = "#8a8a93";
const RULE = "#2a2a32";
const AMBER = "#d9a766";
const TEAL = "#6ec5c0";

const SVG_NS = "http://www.w3.org/2000/svg";

export function mountLtsa(ctx) {
  const root = document.getElementById("ltsa-svg");
  const summary = document.getElementById("ltsa-summary");
  if (!root) {
    console.warn("[v3-ltsa] mount targets missing");
    return null;
  }
  if (!ctx.timeline) {
    root.innerHTML = `<text x="40" y="40" fill="${MUTED}" font-family="ui-monospace, monospace" font-size="12">corpus_timeline.json missing — run \`make bundle\`</text>`;
    return null;
  }

  const tl = ctx.timeline;

  // Update the global TIMELINE so other modules read it consistently.
  TIMELINE.year_start = tl.x_axis.labels[0].year;
  TIMELINE.year_end = tl.x_axis.labels[tl.x_axis.labels.length - 1].year;
  TIMELINE.n_months = tl.x_axis.n_cols;

  const W = 1100, H = 320;
  const padL = 56, padR = 18, padT = 30, padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const nCols = tl.x_axis.n_cols;
  const nRows = tl.y_axis.n_rows;
  const cellW = innerW / nCols;
  const cellH = innerH / nRows;

  root.setAttribute("viewBox", `0 0 ${W} ${H}`);
  root.innerHTML = "";

  // Precompute log-shaded fills for each cell once.
  const ramp = tl.ramp;
  const maxLog = Math.log(tl.max_count + 1);
  function colourFor(count) {
    if (count <= 0) return "#0c0c10";
    const v = Math.log(count + 1) / maxLog;
    const idx = Math.max(0, Math.min(ramp.length - 1, Math.round(v * (ramp.length - 1))));
    return ramp[idx];
  }

  // Cells
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const count = tl.grid[r][c];
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(padL + c * cellW));
      rect.setAttribute("y", String(padT + r * cellH));
      rect.setAttribute("width", String(Math.max(0.5, cellW - 0.4)));
      rect.setAttribute("height", String(Math.max(0.5, cellH - 0.4)));
      rect.setAttribute("fill", colourFor(count));
      rect.setAttribute("data-col", String(c));
      rect.setAttribute("data-row", String(r));
      rect.style.cursor = "pointer";
      rect.addEventListener("click", () => {
        const t = (c + 0.5) / nCols;
        clock.setCursor(t);
      });
      root.appendChild(rect);
    }
  }

  // X axis: year labels only (every Jan)
  const yearLabelGroup = document.createElementNS(SVG_NS, "g");
  for (let i = 0; i < nCols; i++) {
    const lbl = tl.x_axis.labels[i];
    if (lbl.month !== 1) continue;
    const x = padL + (i + 0.5) * cellW;
    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(padT + innerH + 16));
    t.setAttribute("fill", MUTED);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
    t.setAttribute("font-size", "10");
    t.textContent = String(lbl.year);
    yearLabelGroup.appendChild(t);
  }
  root.appendChild(yearLabelGroup);

  // X axis: tick rule between years
  for (let i = 0; i < nCols; i++) {
    const lbl = tl.x_axis.labels[i];
    if (lbl.month !== 1) continue;
    const x = padL + i * cellW;
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(x));
    line.setAttribute("x2", String(x));
    line.setAttribute("y1", String(padT));
    line.setAttribute("y2", String(padT + innerH + 4));
    line.setAttribute("stroke", RULE);
    line.setAttribute("stroke-width", "0.6");
    root.appendChild(line);
  }

  // Y axis: day-of-week labels
  for (let r = 0; r < nRows; r++) {
    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", String(padL - 8));
    t.setAttribute("y", String(padT + (r + 0.5) * cellH + 3.5));
    t.setAttribute("fill", MUTED);
    t.setAttribute("text-anchor", "end");
    t.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
    t.setAttribute("font-size", "10");
    t.textContent = tl.y_axis.labels[r];
    root.appendChild(t);
  }

  // Cursor overlay group (above cells)
  const cursorGroup = document.createElementNS(SVG_NS, "g");
  cursorGroup.setAttribute("pointer-events", "none");
  root.appendChild(cursorGroup);

  const cursorRect = document.createElementNS(SVG_NS, "rect");
  cursorRect.setAttribute("y", String(padT - 2));
  cursorRect.setAttribute("height", String(innerH + 4));
  cursorRect.setAttribute("fill", "none");
  cursorRect.setAttribute("stroke", TEAL);
  cursorRect.setAttribute("stroke-width", "1.4");
  cursorGroup.appendChild(cursorRect);

  const cursorLabel = document.createElementNS(SVG_NS, "text");
  cursorLabel.setAttribute("y", String(padT - 10));
  cursorLabel.setAttribute("fill", TEAL);
  cursorLabel.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
  cursorLabel.setAttribute("font-size", "10");
  cursorLabel.setAttribute("text-anchor", "middle");
  cursorGroup.appendChild(cursorLabel);

  // Colour ramp legend (small swatch row at bottom right)
  const legendY = padT + innerH + 28;
  const legendW = 140;
  const legendX = W - padR - legendW;
  const swatchW = legendW / ramp.length;
  for (let i = 0; i < ramp.length; i++) {
    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("x", String(legendX + i * swatchW));
    r.setAttribute("y", String(legendY));
    r.setAttribute("width", String(swatchW + 0.5));
    r.setAttribute("height", "6");
    r.setAttribute("fill", ramp[i]);
    root.appendChild(r);
  }
  const legendLo = document.createElementNS(SVG_NS, "text");
  legendLo.setAttribute("x", String(legendX));
  legendLo.setAttribute("y", String(legendY + 18));
  legendLo.setAttribute("fill", MUTED);
  legendLo.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
  legendLo.setAttribute("font-size", "9");
  legendLo.textContent = "log(0)";
  root.appendChild(legendLo);
  const legendHi = document.createElementNS(SVG_NS, "text");
  legendHi.setAttribute("x", String(legendX + legendW));
  legendHi.setAttribute("y", String(legendY + 18));
  legendHi.setAttribute("fill", MUTED);
  legendHi.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
  legendHi.setAttribute("font-size", "9");
  legendHi.setAttribute("text-anchor", "end");
  legendHi.textContent = `log(${tl.max_count})`;
  root.appendChild(legendHi);

  if (summary) {
    summary.textContent = `${tl.n_codas_used.toLocaleString()} codas · ${nCols} months · max ${tl.max_count}/cell`;
  }

  function render(state) {
    const c = cursorToMonthIndex(state.cursor);
    const x = padL + c * cellW;
    cursorRect.setAttribute("x", String(x - 0.5));
    cursorRect.setAttribute("width", String(Math.max(2, cellW + 1)));
    cursorLabel.setAttribute("x", String(x + cellW / 2));
    const lbl = tl.x_axis.labels[c];
    const monthName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][lbl.month - 1];
    const monthCount = tl.monthly_totals[c];
    cursorLabel.textContent = `${lbl.year} ${monthName}  ·  ${monthCount} codas`;
  }

  let unsub = null;
  function attach() {
    if (unsub) return;
    unsub = clock.subscribe(render);
  }
  function detach() {
    if (unsub) { unsub(); unsub = null; }
  }
  return { attach, detach, render: () => render({ cursor: clock.cursor }) };
}
