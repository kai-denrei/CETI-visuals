// v4 — Six top-strip gauges (ISD4000 sub-displays).
//
// Each gauge gets its own small canvas to keep transforms isolated. Layout is
// a flex row in the HTML; the canvases are square-ish (DPR-aware). Each frame
// reads the sim and redraws — cheap (< 1ms total even at DPR=2 on a M-series).
//
// Reference: Screenshot 2026-05-18 at 19.37.32.png, top instrument strip.
//
// Gauges, left to right:
//   1. Depth          — large metres numeric + bar readout
//   2. Temperature    — °C numeric
//   3. Heading        — circular compass dial (dial rotates; needle fixed up)
//   4. Pitch          — half-circle attitude indicator
//   5. Roll           — full-circle attitude indicator
//   6. Turns counter  — red 7-segment-style numeric
//
// Colour palette deliberately reproduces the source: black bezel, white tick
// marks, sky-blue / earth-brown attitude fills, red for the turns counter.

import { sim } from "./v4-sim.js";

const PANEL_BG = "#0e0f12";
const BEZEL = "#1f2128";
const FACE = "#0a0b0e";
const TICK = "#cfd2d8";
const TICK_DIM = "#5a5e66";
const TEXT = "#e8e6dd";
const TEXT_DIM = "#9aa0aa";
const ATTITUDE_SKY = "#1e3548";     // dark slate-blue
const ATTITUDE_EARTH = "#5a3e22";   // dark amber-brown
const ATTITUDE_RULE = "#cfd2d8";    // horizon line
const RED_SEG = "#e84a3a";
const RED_SEG_DIM = "#3a1414";
const COLD = "#6ec5c0";
const WARM = "#d9a766";

const DEG = 180 / Math.PI;

function sizeFor(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);
  return { g, w: cssW, h: cssH };
}

// ---------------------------------------------------------------------------
// 1. Depth
// ---------------------------------------------------------------------------

function drawDepth(canvas, sim) {
  const { g, w, h } = sizeFor(canvas);
  if (w < 20) return;
  g.fillStyle = PANEL_BG;
  g.fillRect(0, 0, w, h);

  const depthStr = sim.depth.toFixed(3) + " m";
  const barStr = sim.pressureBar().toFixed(3) + " Bar";

  // Main numeric — large
  g.fillStyle = TEXT;
  g.font = `400 ${Math.floor(h * 0.36)}px "JetBrains Mono", ui-monospace, SF Mono, monospace`;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText(depthStr, 16, h * 0.40);

  // Secondary readout
  g.fillStyle = TEXT_DIM;
  g.font = `400 ${Math.floor(h * 0.18)}px "JetBrains Mono", ui-monospace, monospace`;
  g.fillText(barStr, 16, h * 0.72);

  // Horizontal mini bar — pressure indicator, normalised 0..3 bar
  const barY = h - 12;
  const barX = 16;
  const barW = w - 32;
  const barH = 4;
  g.fillStyle = "#262830";
  g.fillRect(barX, barY, barW, barH);
  const fillW = Math.max(0, Math.min(barW, (sim.pressureBar() / 3) * barW));
  g.fillStyle = COLD;
  g.fillRect(barX, barY, fillW, barH);
}

// ---------------------------------------------------------------------------
// 2. Temperature
// ---------------------------------------------------------------------------

function drawTemp(canvas, sim) {
  const { g, w, h } = sizeFor(canvas);
  if (w < 20) return;
  g.fillStyle = PANEL_BG;
  g.fillRect(0, 0, w, h);

  const t = sim.temperature;
  const tNorm = Math.max(0, Math.min(1, (t - 5) / 25));  // 5°C cold → 30°C warm
  // Subtle tint: cooler temps lean cyan, warmer lean amber.
  const tintR = Math.round(COLD ? 110 + (217 - 110) * tNorm : 200);
  const tintG = Math.round(197 + (167 - 197) * tNorm);
  const tintB = Math.round(192 + (102 - 192) * tNorm);
  const tint = `rgb(${tintR}, ${tintG}, ${tintB})`;

  // Numeric
  g.fillStyle = TEXT;
  g.font = `400 ${Math.floor(h * 0.34)}px "JetBrains Mono", ui-monospace, monospace`;
  g.textAlign = "left";
  g.textBaseline = "middle";
  const label = t.toFixed(2);
  g.fillText(label, 16, h * 0.45);
  // °C in tint
  g.fillStyle = tint;
  const labelW = g.measureText(label).width;
  g.font = `400 ${Math.floor(h * 0.22)}px "JetBrains Mono", ui-monospace, monospace`;
  g.fillText(" °C", 16 + labelW + 4, h * 0.45);

  // Tiny gauge bar at bottom
  const barY = h - 12;
  const barX = 16;
  const barW = w - 32;
  const barH = 4;
  g.fillStyle = "#262830";
  g.fillRect(barX, barY, barW, barH);
  g.fillStyle = tint;
  g.fillRect(barX, barY, tNorm * barW, barH);
}

// ---------------------------------------------------------------------------
// 3. Heading compass
// ---------------------------------------------------------------------------

function drawHeading(canvas, sim) {
  const { g, w, h } = sizeFor(canvas);
  if (w < 20) return;
  g.fillStyle = PANEL_BG;
  g.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + 4;
  const R = Math.min(w, h) / 2 - 8;

  // Outer bezel
  g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI);
  g.fillStyle = FACE; g.fill();
  g.lineWidth = 1; g.strokeStyle = BEZEL; g.stroke();

  // The dial rotates by -heading so that the current heading reads at top.
  g.save();
  g.translate(cx, cy);
  g.rotate(-sim.heading / DEG);

  // Tick marks every 30°
  for (let deg = 0; deg < 360; deg += 5) {
    const a = (deg - 90) / DEG;  // 0° at top
    const r0 = R * (deg % 30 === 0 ? 0.78 : 0.88);
    const r1 = R * 0.96;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.lineWidth = deg % 30 === 0 ? 1.4 : 0.6;
    g.strokeStyle = deg % 30 === 0 ? TICK : TICK_DIM;
    g.stroke();
  }
  // Cardinal letters
  g.fillStyle = TEXT;
  g.font = `600 ${Math.max(9, R * 0.18)}px "JetBrains Mono", ui-monospace, monospace`;
  g.textAlign = "center"; g.textBaseline = "middle";
  const cards = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];
  for (const [letter, deg] of cards) {
    const a = (deg - 90) / DEG;
    g.save();
    g.translate(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6);
    g.rotate(sim.heading / DEG);  // un-rotate so letters stay upright
    g.fillStyle = letter === "N" ? WARM : TEXT;
    g.fillText(letter, 0, 0);
    g.restore();
  }
  g.restore();

  // Fixed up-needle on top of dial
  g.beginPath();
  g.moveTo(cx, cy - R + 2);
  g.lineTo(cx - 4, cy - R + 12);
  g.lineTo(cx + 4, cy - R + 12);
  g.closePath();
  g.fillStyle = WARM; g.fill();

  // Numeric heading centre
  g.fillStyle = TEXT;
  g.font = `400 ${Math.max(11, R * 0.34)}px "JetBrains Mono", ui-monospace, monospace`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(sim.heading.toFixed(1) + "°", cx, cy);
}

// ---------------------------------------------------------------------------
// 4. Pitch — half-circle attitude indicator
// ---------------------------------------------------------------------------

function drawPitch(canvas, sim) {
  const { g, w, h } = sizeFor(canvas);
  if (w < 20) return;
  g.fillStyle = PANEL_BG;
  g.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + 4;
  const R = Math.min(w, h) / 2 - 8;

  // Sky / earth split — at zero pitch the horizon line is centred. Positive
  // pitch (nose up) raises the earth on the screen.
  // We render a clipped circle, with the horizon at y = cy - (pitch/90)*R.
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.clip();

  const horizonY = cy - (sim.pitch / 90) * R;
  // Sky above
  g.fillStyle = ATTITUDE_SKY;
  g.fillRect(cx - R, cy - R, R * 2, horizonY - (cy - R));
  // Earth below
  g.fillStyle = ATTITUDE_EARTH;
  g.fillRect(cx - R, horizonY, R * 2, (cy + R) - horizonY);
  // Horizon line
  g.strokeStyle = ATTITUDE_RULE; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx - R, horizonY); g.lineTo(cx + R, horizonY); g.stroke();
  // Pitch ladder — small ticks every 15° above and below
  g.strokeStyle = ATTITUDE_RULE; g.lineWidth = 0.8;
  g.fillStyle = ATTITUDE_RULE;
  g.font = `400 8px "JetBrains Mono", ui-monospace, monospace`;
  g.textAlign = "right"; g.textBaseline = "middle";
  for (let p = -60; p <= 60; p += 15) {
    if (p === 0) continue;
    const y = cy - ((sim.pitch - p) / 90) * R;
    const len = (Math.abs(p) % 30 === 0) ? R * 0.36 : R * 0.20;
    g.beginPath();
    g.moveTo(cx - len, y); g.lineTo(cx + len, y);
    g.stroke();
    if (Math.abs(p) % 30 === 0) {
      g.fillText(String(p), cx - len - 2, y);
    }
  }
  g.restore();

  // Bezel
  g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI);
  g.lineWidth = 1; g.strokeStyle = BEZEL; g.stroke();

  // Centre crosshair / aircraft symbol
  g.strokeStyle = WARM; g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - R * 0.22, cy); g.lineTo(cx - R * 0.05, cy);
  g.moveTo(cx + R * 0.05, cy); g.lineTo(cx + R * 0.22, cy);
  g.moveTo(cx, cy - 1); g.lineTo(cx, cy + 5);
  g.stroke();

  // Numeric
  g.fillStyle = TEXT;
  g.font = `400 ${Math.max(10, R * 0.30)}px "JetBrains Mono", ui-monospace, monospace`;
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.fillText(sim.pitch.toFixed(1) + "°", cx, cy + R + 0);
}

// ---------------------------------------------------------------------------
// 5. Roll — full-circle attitude indicator
// ---------------------------------------------------------------------------

function drawRoll(canvas, sim) {
  const { g, w, h } = sizeFor(canvas);
  if (w < 20) return;
  g.fillStyle = PANEL_BG;
  g.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + 4;
  const R = Math.min(w, h) / 2 - 8;

  // Roll rotates the horizon line about the centre.
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.clip();

  // Fill sky everywhere, then rotate and overpaint earth.
  g.fillStyle = ATTITUDE_SKY;
  g.fillRect(cx - R, cy - R, R * 2, R * 2);

  g.save();
  g.translate(cx, cy);
  g.rotate(sim.roll / DEG);
  g.fillStyle = ATTITUDE_EARTH;
  g.fillRect(-R - 4, 0, (R + 4) * 2, R + 4);
  g.strokeStyle = ATTITUDE_RULE; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(-R - 4, 0); g.lineTo(R + 4, 0); g.stroke();
  // Bank ticks
  g.strokeStyle = ATTITUDE_RULE; g.lineWidth = 0.8;
  for (let b = -60; b <= 60; b += 15) {
    if (b === 0) continue;
    const x = (b / 90) * R;
    g.beginPath(); g.moveTo(x, -3); g.lineTo(x, 3); g.stroke();
  }
  g.restore();
  g.restore();

  // Outer bank index arc — fixed marks at the top showing 0, ±30, ±60
  g.strokeStyle = TICK; g.lineWidth = 1;
  for (const b of [-60, -30, 0, 30, 60]) {
    const a = (b - 90) / DEG;
    const r0 = R * 1.0, r1 = R * 0.86;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.stroke();
  }
  // Top reference triangle (fixed)
  g.beginPath();
  g.moveTo(cx, cy - R + 2);
  g.lineTo(cx - 4, cy - R + 12);
  g.lineTo(cx + 4, cy - R + 12);
  g.closePath();
  g.fillStyle = WARM; g.fill();

  // Bezel
  g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI);
  g.lineWidth = 1; g.strokeStyle = BEZEL; g.stroke();

  // Centre aircraft symbol
  g.strokeStyle = WARM; g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - R * 0.22, cy); g.lineTo(cx - R * 0.05, cy);
  g.moveTo(cx + R * 0.05, cy); g.lineTo(cx + R * 0.22, cy);
  g.stroke();
  g.beginPath(); g.arc(cx, cy, 2, 0, 2 * Math.PI); g.fillStyle = WARM; g.fill();

  // Numeric
  g.fillStyle = TEXT;
  g.font = `400 ${Math.max(10, R * 0.30)}px "JetBrains Mono", ui-monospace, monospace`;
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.fillText(sim.roll.toFixed(1) + "°", cx, cy + R + 0);
}

// ---------------------------------------------------------------------------
// 6. Turns counter — 7-segment-ish red numeric
// ---------------------------------------------------------------------------

function drawTurns(canvas, sim) {
  const { g, w, h } = sizeFor(canvas);
  if (w < 20) return;
  g.fillStyle = PANEL_BG;
  g.fillRect(0, 0, w, h);

  // Inner LCD-style frame
  g.fillStyle = "#1a0a0a";
  g.fillRect(10, h * 0.18, w - 20, h * 0.55);
  g.strokeStyle = "#2a1010"; g.lineWidth = 1;
  g.strokeRect(10.5, h * 0.18 + 0.5, w - 21, h * 0.55 - 1);

  const turns = sim.turns;
  const sign = turns < 0 ? "−" : (turns > 0 ? "+" : " ");
  const abs = Math.abs(turns).toFixed(1);
  const txt = `${sign}${abs}`;

  // "Glow" ghost char behind, dim red
  g.fillStyle = RED_SEG_DIM;
  g.font = `700 ${Math.floor(h * 0.42)}px "JetBrains Mono", "Courier New", ui-monospace, monospace`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("+8.8", w / 2, h * 0.46);

  // Foreground red value
  g.fillStyle = RED_SEG;
  g.fillText(txt, w / 2, h * 0.46);

  // Caption
  g.fillStyle = TEXT_DIM;
  g.font = `400 ${Math.floor(h * 0.13)}px "JetBrains Mono", ui-monospace, monospace`;
  g.textBaseline = "alphabetic";
  g.fillText("turns", w / 2, h - 8);
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const RENDERERS = {
  depth: drawDepth,
  temp: drawTemp,
  heading: drawHeading,
  pitch: drawPitch,
  roll: drawRoll,
  turns: drawTurns,
};

export function mountGauges(ctx) {
  const ids = ["depth", "temp", "heading", "pitch", "roll", "turns"];
  const canvases = {};
  for (const id of ids) {
    const el = document.getElementById(`v4-g-${id}`);
    if (!el) {
      console.warn(`[v4-gauges] missing canvas v4-g-${id}`);
      return null;
    }
    canvases[id] = el;
  }

  function renderAll() {
    for (const id of ids) RENDERERS[id](canvases[id], sim);
  }

  let unsub = null;
  function attach() {
    if (unsub) return;
    unsub = sim.subscribe(renderAll);
  }
  function detach() {
    if (unsub) { unsub(); unsub = null; }
  }

  window.addEventListener("resize", renderAll);
  return { attach, detach, render: renderAll };
}
