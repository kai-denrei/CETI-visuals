// v4 — ISS360 polar imaging sonar.
//
// Canvas 2D. Black background. Jet-coloured return field sampled per-pixel
// from the sim's 360×200 polar grid. Sweep line indicates the current bearing
// being pinged; immediately behind it is the freshest slice, fading by alpha
// decay through the previous ~70% of a revolution.
//
// Range rings at 0.5 / 1.0 / 1.5 / 2.0 m with monospaced labels along the
// right side, crosshairs through centre, a dark deadzone disc inside 0.3 m.
//
// EXPLICIT AESTHETIC OVERRIDE: jet colourmap (not perceptually uniform).
// See v4-jet.js header.

import { sim, SIM_CONST, SONAR } from "./v4-sim.js";
import { jetLUT, JET_N } from "./v4-jet.js";

const INK = "#e8e6dd";
const TICK = "#cfd2d8";
const MUTED = "#8a8a93";
const SWEEP_RED = "#ff3a2a";
const TEAL = "#6ec5c0";

// Pre-allocate an offscreen canvas used to draw the polar field as an
// ImageData buffer, then composited to the main canvas. We rebuild this on
// resize.
let offscreen = null;
let offscreenW = 0;
let offscreenH = 0;
let imageData = null;

export function mountSonar(ctx) {
  const canvas = document.getElementById("v4-sonar-canvas");
  const summary = document.getElementById("v4-sonar-summary");
  if (!canvas) {
    console.warn("[v4-sonar] mount target missing");
    return null;
  }

  function ensureOffscreen(w, h) {
    if (offscreen && offscreenW === w && offscreenH === h) return;
    offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    offscreenW = w;
    offscreenH = h;
    const og = offscreen.getContext("2d");
    imageData = og.createImageData(w, h);
  }

  function render() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW < 60 || cssH < 60) return;
    if (canvas.width !== Math.round(cssW * dpr)) canvas.width = Math.round(cssW * dpr);
    if (canvas.height !== Math.round(cssH * dpr)) canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#000";
    g.fillRect(0, 0, cssW, cssH);

    const cx = cssW / 2;
    const cy = cssH / 2;
    const R = Math.min(cssW, cssH) / 2 - 8;

    // Build polar-to-cartesian return field via offscreen ImageData.
    const fieldW = Math.floor(cssW);
    const fieldH = Math.floor(cssH);
    ensureOffscreen(fieldW, fieldH);
    const lut = jetLUT();
    const data = imageData.data;
    const sonarField = sim.sonar;
    const N_ANG = SONAR.N_ANG;
    const N_R = SONAR.N_R;
    const MAX_R = SONAR.MAX_RANGE;
    const DEADZONE = SONAR.DEADZONE;
    const sweep = sim.sonarSweepRad;  // world frame
    const headingRad = sim.heading * Math.PI / 180;

    // Trail span 70% of a revolution.
    const TRAIL = Math.PI * 2 * 0.7;

    // Per-pixel raster
    for (let py = 0; py < fieldH; py++) {
      const dy = py - cy;
      for (let px = 0; px < fieldW; px++) {
        const dx = px - cx;
        const rPx = Math.hypot(dx, dy);
        const idx4 = (py * fieldW + px) * 4;
        if (rPx > R) {
          data[idx4] = 0; data[idx4 + 1] = 0; data[idx4 + 2] = 0; data[idx4 + 3] = 0;
          continue;
        }
        // World-frame bearing of this pixel from sonar centre.
        // Canvas y is down, so flip dy. atan2(dx, -dy) gives bearing clockwise from up.
        let bearing_world = Math.atan2(dx, -dy);   // -π..π, 0=up
        if (bearing_world < 0) bearing_world += Math.PI * 2;
        // Convert to bin index in local frame (sonar bins are indexed in local
        // frame: local_bearing = world_bearing - heading).
        let local_bearing = bearing_world - headingRad;
        local_bearing = ((local_bearing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const a = Math.floor((local_bearing / (Math.PI * 2)) * N_ANG) % N_ANG;
        // Range bin
        const rMeters = (rPx / R) * MAX_R;
        if (rMeters < DEADZONE) {
          // Deadzone — solid very dark.
          data[idx4] = 20; data[idx4 + 1] = 20; data[idx4 + 2] = 20; data[idx4 + 3] = 255;
          continue;
        }
        const ri = Math.min(N_R - 1, Math.floor((rMeters / MAX_R) * N_R));
        const amp = sonarField[a * N_R + ri];

        // Trail alpha: how recently was this bearing painted by the sweep?
        // Compute angular distance from current sweep, *behind* sweep direction.
        let behind = (sweep - bearing_world + Math.PI * 4) % (Math.PI * 2);
        let alpha;
        if (behind < 0.06) {
          alpha = 1.0;   // leading edge — full bright
        } else if (behind < TRAIL) {
          alpha = 1.0 - (behind / TRAIL) * 0.85;  // fade to 0.15
        } else {
          alpha = 0.12;  // pre-sweep stale
        }
        const lutIdx = Math.min(JET_N - 1, Math.max(0, Math.round(amp * (JET_N - 1))));
        const lr = lut[lutIdx * 3 + 0];
        const lg = lut[lutIdx * 3 + 1];
        const lb = lut[lutIdx * 3 + 2];
        // Multiply by alpha for a fade-with-background effect (background is black).
        data[idx4] = Math.round(lr * alpha);
        data[idx4 + 1] = Math.round(lg * alpha);
        data[idx4 + 2] = Math.round(lb * alpha);
        data[idx4 + 3] = 255;
      }
    }

    const og = offscreen.getContext("2d");
    og.putImageData(imageData, 0, 0);
    g.drawImage(offscreen, 0, 0, cssW, cssH);

    // Range rings ---------------------------------------------------------
    g.strokeStyle = "rgba(220, 220, 230, 0.32)";
    g.lineWidth = 1;
    const ringRanges = [0.5, 1.0, 1.5, 2.0].filter(r => r <= MAX_R + 1e-6);
    for (const r of ringRanges) {
      g.beginPath();
      g.arc(cx, cy, (r / MAX_R) * R, 0, Math.PI * 2);
      g.stroke();
    }
    // Range labels along the right side
    g.fillStyle = TICK;
    g.font = "10px 'JetBrains Mono', ui-monospace, monospace";
    g.textAlign = "left";
    g.textBaseline = "middle";
    for (const r of ringRanges) {
      g.fillText(`${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)}m`, cx + (r / MAX_R) * R + 4, cy);
    }

    // Crosshairs ----------------------------------------------------------
    g.strokeStyle = "rgba(220, 220, 230, 0.28)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx - R, cy); g.lineTo(cx + R, cy);
    g.moveTo(cx, cy - R); g.lineTo(cx, cy + R);
    g.stroke();

    // Deadzone overlay — solid dark fill inside r=0.3 m
    g.beginPath();
    g.arc(cx, cy, (DEADZONE / MAX_R) * R, 0, Math.PI * 2);
    g.fillStyle = "rgba(8, 10, 14, 0.92)";
    g.fill();
    g.strokeStyle = "rgba(220, 220, 230, 0.35)";
    g.lineWidth = 1;
    g.stroke();

    // Sweep line in WORLD frame minus the heading? No — the sonar UI shows
    // local frame (the vehicle's "up" is screen-up). So sweep angle = local.
    // Local sweep = world sweep - heading.
    let sweepLocal = sweep - headingRad;
    sweepLocal = ((sweepLocal % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const sweepX = cx + Math.sin(sweepLocal) * R;
    const sweepY = cy - Math.cos(sweepLocal) * R;
    g.strokeStyle = SWEEP_RED;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(sweepX, sweepY);
    g.stroke();

    // Centre dot
    g.fillStyle = TEAL;
    g.beginPath(); g.arc(cx, cy, 2.5, 0, Math.PI * 2); g.fill();

    if (summary) {
      summary.textContent = `bearing ${(((sim.heading + (sweepLocal * 180 / Math.PI)) % 360 + 360) % 360).toFixed(0)}°  ·  range ${MAX_R.toFixed(2)} m  ·  ${Math.round(15 * sim._speed)} rpm`;
    }
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
