// v4 — ISA500 altimeter / echosounder display.
//
// Two stacked panels:
//   1. Distance tile — big monospaced metres readout + horizontal
//      traffic-light bar (green→yellow→red) with a vertical slider marker
//      at the current distance.
//   2. Echogram strip chart — canvas, x=time (right = now, scrolls left),
//      y=distance bin 0..3 m (0 at bottom), jet-coloured intensity. A thin
//      cyan polyline overlays the current distance trace.
//
// EXPLICIT AESTHETIC OVERRIDE: jet colourmap, dashboard layout.

import { sim, SIM_CONST } from "./v4-sim.js";
import { jetLUT, JET_N } from "./v4-jet.js";

const TEXT = "#e8e6dd";
const TEXT_DIM = "#9aa0aa";
const MUTED = "#8a8a93";
const PANEL_BG = "#0e0f12";
const RULE = "#22232a";

const ECHO_LINE = "#7fdcd6";  // traced distance line

const MAX_RANGE_M = 3.0;

export function mountAltimeter(ctx) {
  const distCanvas = document.getElementById("v4-alt-dist-canvas");
  const echoCanvas = document.getElementById("v4-alt-echo-canvas");
  const summary = document.getElementById("v4-alt-summary");
  if (!distCanvas || !echoCanvas) {
    console.warn("[v4-altimeter] mount targets missing");
    return null;
  }

  function sizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW < 20 || cssH < 20) return null;
    if (canvas.width !== Math.round(cssW * dpr)) canvas.width = Math.round(cssW * dpr);
    if (canvas.height !== Math.round(cssH * dpr)) canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w: cssW, h: cssH };
  }

  function drawDist() {
    const ctx2 = sizeCanvas(distCanvas);
    if (!ctx2) return;
    const { g, w, h } = ctx2;
    g.fillStyle = PANEL_BG;
    g.fillRect(0, 0, w, h);

    const d = sim.distance;
    const dStr = d.toFixed(3) + " m";

    // Title bar
    g.fillStyle = TEXT_DIM;
    g.font = `400 11px "JetBrains Mono", ui-monospace, monospace`;
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillText("Distance", 16, 10);

    // Big numeric
    g.fillStyle = TEXT;
    g.font = `400 ${Math.floor(h * 0.42)}px "JetBrains Mono", ui-monospace, monospace`;
    g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(dStr, 16, h * 0.50);

    // Traffic-light bar
    const barX = 16, barY = h - 22;
    const barW = w - 32;
    const barH = 8;
    // green 0..33%, yellow 33..66%, red 66..100%
    const segs = [
      { c: "#3aa256", lo: 0, hi: 0.33 },
      { c: "#d3b14a", lo: 0.33, hi: 0.66 },
      { c: "#c84a35", lo: 0.66, hi: 1.0 },
    ];
    for (const s of segs) {
      g.fillStyle = s.c;
      g.fillRect(barX + s.lo * barW, barY, (s.hi - s.lo) * barW, barH);
    }
    // Cursor mark — current distance as fraction of MAX_RANGE
    const frac = Math.max(0, Math.min(1, d / MAX_RANGE_M));
    const mx = barX + frac * barW;
    g.strokeStyle = TEXT; g.lineWidth = 2;
    g.beginPath(); g.moveTo(mx, barY - 4); g.lineTo(mx, barY + barH + 4); g.stroke();
    g.fillStyle = TEXT;
    g.beginPath();
    g.moveTo(mx, barY - 6);
    g.lineTo(mx - 3, barY - 10);
    g.lineTo(mx + 3, barY - 10);
    g.closePath(); g.fill();

    // Axis labels under bar
    g.fillStyle = TEXT_DIM;
    g.font = `400 9px "JetBrains Mono", ui-monospace, monospace`;
    g.textBaseline = "top";
    g.textAlign = "left";
    g.fillText("0", barX, barY + barH + 2);
    g.textAlign = "right";
    g.fillText(`${MAX_RANGE_M.toFixed(0)} m`, barX + barW, barY + barH + 2);
  }

  function drawEcho() {
    const ctx2 = sizeCanvas(echoCanvas);
    if (!ctx2) return;
    const { g, w, h } = ctx2;
    g.fillStyle = PANEL_BG;
    g.fillRect(0, 0, w, h);

    const padL = 30, padR = 8, padT = 16, padB = 22;
    const innerX = padL, innerY = padT;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    if (innerW < 10 || innerH < 10) return;

    // Title
    g.fillStyle = TEXT_DIM;
    g.font = `400 11px "JetBrains Mono", ui-monospace, monospace`;
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillText("Echogram", innerX, 2);

    // Plot field background
    g.fillStyle = "#050608";
    g.fillRect(innerX, innerY, innerW, innerH);

    // Build the column field. Each column index in the echogram ring contains
    // ECHOGRAM_BINS distance bins. We map ring "ago" → x and "bin" → y.
    const size = sim.echogramSize();
    const { width: NCOL, height: NBIN, filled } = size;
    if (filled < 2) return;

    const lut = jetLUT();
    // Use ImageData for efficient pixel fill
    const tmp = g.createImageData(innerW, innerH);
    const tdata = tmp.data;
    // Sample the echogram across NCOL → innerW, and NBIN → innerH (0 m at bottom)
    for (let px = 0; px < innerW; px++) {
      const colT = px / innerW;            // 0 = oldest visible, 1 = newest
      const colIdx = Math.min(filled - 1, Math.floor(colT * filled));
      const ago = colIdx;
      // Compute ring position
      const ringIdx = (sim.echogramHead - 1 - (filled - 1 - ago) + NCOL * 2) % NCOL;
      for (let py = 0; py < innerH; py++) {
        // y=0 top → distance MAX_RANGE; y=innerH-1 bottom → 0 m.
        const distFrac = 1 - py / innerH;
        const bin = Math.min(NBIN - 1, Math.floor(distFrac * NBIN));
        const amp = sim.echogram[ringIdx * NBIN + bin];
        const lutIdx = Math.min(JET_N - 1, Math.max(0, Math.round(amp * (JET_N - 1))));
        const lr = lut[lutIdx * 3 + 0];
        const lg = lut[lutIdx * 3 + 1];
        const lb = lut[lutIdx * 3 + 2];
        const di = (py * innerW + px) * 4;
        tdata[di] = lr;
        tdata[di + 1] = lg;
        tdata[di + 2] = lb;
        tdata[di + 3] = 255;
      }
    }
    g.putImageData(tmp, innerX, innerY);

    // Overlay distance line trace — extracts the peak bin per column.
    g.strokeStyle = ECHO_LINE;
    g.lineWidth = 1.4;
    g.beginPath();
    for (let px = 0; px < innerW; px += 2) {
      const colT = px / innerW;
      const colIdx = Math.min(filled - 1, Math.floor(colT * filled));
      const ringIdx = (sim.echogramHead - 1 - (filled - 1 - colIdx) + NCOL * 2) % NCOL;
      // Find argmax bin
      let maxAmp = 0, maxBin = 0;
      for (let b = 0; b < NBIN; b++) {
        const a = sim.echogram[ringIdx * NBIN + b];
        if (a > maxAmp) { maxAmp = a; maxBin = b; }
      }
      const distM = (maxBin / NBIN) * MAX_RANGE_M;
      const y = innerY + innerH - (distM / MAX_RANGE_M) * innerH;
      if (px === 0) g.moveTo(innerX + px, y);
      else g.lineTo(innerX + px, y);
    }
    g.stroke();

    // Y axis labels (m)
    g.fillStyle = TEXT_DIM;
    g.font = `400 9px "JetBrains Mono", ui-monospace, monospace`;
    g.textAlign = "right"; g.textBaseline = "middle";
    for (let m = 0; m <= 3; m++) {
      const y = innerY + innerH - (m / MAX_RANGE_M) * innerH;
      g.fillText(`${m}`, innerX - 4, y);
      g.strokeStyle = "rgba(255,255,255,0.10)";
      g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(innerX, y); g.lineTo(innerX + innerW, y); g.stroke();
    }
    g.fillStyle = TEXT_DIM;
    g.font = `400 9px "JetBrains Mono", ui-monospace, monospace`;
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillText("m", innerX - 18, innerY + innerH / 2 - 10);

    // X axis hint (time)
    g.fillStyle = TEXT_DIM;
    g.font = `400 9px "JetBrains Mono", ui-monospace, monospace`;
    g.textAlign = "right"; g.textBaseline = "alphabetic";
    g.fillText("now →", innerX + innerW, innerY + innerH + 14);
    g.textAlign = "left";
    g.fillText("← past", innerX, innerY + innerH + 14);

    if (summary) {
      summary.textContent =
        `${sim.distance.toFixed(3)} m  ·  echo column ${size.filled}/${NCOL}`;
    }
  }

  function render() {
    drawDist();
    drawEcho();
  }

  let unsub = null;
  function attach() {
    if (unsub) return;
    unsub = sim.subscribe(render);
  }
  function detach() {
    if (unsub) { unsub(); unsub = null; }
  }

  window.addEventListener("resize", render);
  return { attach, detach, render };
}
