// v3 — Section 3 — PPI rotating sonar sweep.
//
// Canvas 2D circular sweep. 18 spokes, one per rhythm cluster, distributed
// uniformly around the bearing circle. Spoke intensity = count of codas in
// that rhythm cluster whose t_start falls inside a sliding window centred on
// the global clock cursor (mapped to the Dataset 2 deployment time axis).
//
// Caveat (in the caption): the bearings are *not* real bearings — sperm whales
// don't broadcast direction in this dataset. Rhythm-cluster → bearing is purely
// a rendering choice that lets us put 18 categorical channels on a single
// rotating display. Educational ornament, not analysis.
//
// Sweep speed: 6 rpm at 1x = one full revolution per 10s. Multiplied by the
// global clock speed so 4x = 24 rpm.

import { clock } from "./v3-clock.js";

const INK = "#e8e6dd";
const MUTED = "#8a8a93";
const AMBER = "#d9a766";
const TEAL = "#6ec5c0";

const N_SPOKES = 18;
const BASE_RPM = 6;
const TRAIL_DEG = 110;  // alpha-decay trail behind the sweep leading edge

export function mountPpi(ctx) {
  const canvas = document.getElementById("ppi-canvas");
  const summary = document.getElementById("ppi-summary");
  if (!canvas) {
    console.warn("[v3-ppi] mount targets missing");
    return null;
  }

  // Group codas by rhythm cluster, sorted by t_start within each cluster.
  // We use t_start (which lives in the Dataset 2 time axis, seconds within a
  // recording) re-projected to a *deployment-wide* normalised position. Since
  // Dataset 2 spans 48 separate recordings, we can't reconstruct a single
  // continuous timeline; instead we map each coda's index-position within its
  // own (sorted) exchange to [0, 1] and project the clock cursor onto that.
  //
  // This is a stylised reading — what the sweep shows is "which rhythm clusters
  // dominate the active fraction of the corpus as the clock walks through".
  const rhythmBuckets = [];
  for (let r = 0; r < N_SPOKES; r++) rhythmBuckets.push([]);
  // Compute global ordering of all codas by t_start across the union of exchanges.
  const allCodas = ctx.codas.slice().sort((a, b) => {
    if (a.exchange_id !== b.exchange_id) return a.exchange_id < b.exchange_id ? -1 : 1;
    return a.t_start - b.t_start;
  });
  // Assign a normalised position in [0, 1] based on global index.
  for (let i = 0; i < allCodas.length; i++) {
    const c = allCodas[i];
    const pos = i / Math.max(1, allCodas.length - 1);
    const r = c.rhythm_cluster;
    if (r >= 0 && r < N_SPOKES) rhythmBuckets[r].push(pos);
  }
  // For each bucket, sort once.
  for (const b of rhythmBuckets) b.sort((a, b) => a - b);

  // Spoke palette from clusters.json
  const spokeColours = ctx.clusters.rhythms.map(r => r.colour);

  function countInWindow(arr, lo, hi) {
    // Binary-search both endpoints.
    let a = 0, b = arr.length;
    while (a < b) { const m = (a + b) >> 1; if (arr[m] < lo) a = m + 1; else b = m; }
    let lo_i = a;
    a = 0; b = arr.length;
    while (a < b) { const m = (a + b) >> 1; if (arr[m] <= hi) a = m + 1; else b = m; }
    let hi_i = a;
    return hi_i - lo_i;
  }

  let lastFrame = performance.now();
  let sweepAngle = 0;  // radians; bearing 0 = top, clockwise

  function render(state) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = 380;
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    const cx = cssW / 2;
    const cy = cssH / 2;
    const R = Math.max(20, Math.min(cssW, cssH) / 2 - 18);
    if (cssW < 80 || cssH < 80) return;  // canvas not yet laid out

    // Advance sweep angle by elapsed wall time scaled by clock speed.
    const now = performance.now();
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (state.playing) {
      const rpm = BASE_RPM * state.speed;
      sweepAngle += (rpm / 60) * dt * Math.PI * 2;
      sweepAngle = sweepAngle % (Math.PI * 2);
    }

    // Window in normalised-deployment-position
    const winHalf = 0.04;
    const lo = Math.max(0, state.cursor - winHalf);
    const hi = Math.min(1, state.cursor + winHalf);

    // Per-spoke recent counts, normalised
    const counts = rhythmBuckets.map(b => countInWindow(b, lo, hi));
    const maxCount = Math.max(1, ...counts);

    // Backdrop range rings
    g.strokeStyle = "#1a1a22";
    g.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      g.beginPath(); g.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2); g.stroke();
    }
    // Cross-hairs
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy);
    g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();

    // Trail wedge: from (sweepAngle - TRAIL_DEG) to sweepAngle, alpha falls off.
    const trailRad = TRAIL_DEG * Math.PI / 180;
    g.save();
    g.translate(cx, cy);
    // Rotate so 0 bearing is at top (screen north).
    g.rotate(-Math.PI / 2);
    const steps = 28;
    for (let s = 0; s < steps; s++) {
      const a0 = sweepAngle - trailRad * (1 - s / steps);
      const a1 = sweepAngle - trailRad * (1 - (s + 1) / steps);
      const alpha = (s / steps) * 0.18;
      g.fillStyle = `rgba(110, 197, 192, ${alpha})`;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, R, a0, a1);
      g.closePath();
      g.fill();
    }
    g.restore();

    // Spokes — one per rhythm cluster. Bearing = (i / 18) * 360 from north, clockwise.
    for (let i = 0; i < N_SPOKES; i++) {
      const bearing = (i / N_SPOKES) * 2 * Math.PI;  // 0 = north, clockwise
      const ang = bearing - Math.PI / 2;  // canvas: 0 = east, so subtract 90deg
      const intensity = counts[i] / maxCount;
      const reach = R * (0.16 + 0.8 * intensity);

      // Alpha boost if the sweep is currently passing this bearing.
      const delta = ((bearing - sweepAngle) + Math.PI * 2) % (Math.PI * 2);
      const onLeadingEdge = delta < (10 * Math.PI / 180);
      const swept = delta > 0 && delta < trailRad;
      let alpha = 0.32;
      if (onLeadingEdge) alpha = 1;
      else if (swept) alpha = 0.32 + 0.5 * (1 - delta / trailRad);

      const x1 = cx + Math.cos(ang) * 8;
      const y1 = cy + Math.sin(ang) * 8;
      const x2 = cx + Math.cos(ang) * reach;
      const y2 = cy + Math.sin(ang) * reach;

      g.globalAlpha = alpha;
      g.strokeStyle = spokeColours[i] || INK;
      g.lineWidth = 2.4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();

      // Cluster label at the tip if intensity high
      if (intensity > 0.15) {
        g.globalAlpha = Math.min(1, alpha + 0.2);
        g.fillStyle = spokeColours[i] || INK;
        g.font = "9px ui-monospace, SF Mono, monospace";
        g.textAlign = "center";
        g.textBaseline = "middle";
        const lx = cx + Math.cos(ang) * (reach + 10);
        const ly = cy + Math.sin(ang) * (reach + 10);
        g.fillText(`R${i}`, lx, ly);
      }
    }

    // Sweep leading edge (clean line)
    const leadAng = sweepAngle - Math.PI / 2;
    g.globalAlpha = 0.9;
    g.strokeStyle = TEAL;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(leadAng) * R, cy + Math.sin(leadAng) * R);
    g.stroke();

    // Centre dot
    g.globalAlpha = 1;
    g.fillStyle = TEAL;
    g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();

    // Readout
    g.fillStyle = MUTED;
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.textAlign = "left";
    g.textBaseline = "top";
    const activeRhythm = counts.indexOf(Math.max(...counts));
    g.fillText(`peak rhythm = R${activeRhythm.toString().padStart(2, "0")}`, 16, 16);
    g.fillText(`window = ${(winHalf * 2 * 100).toFixed(1)}% of corpus`, 16, 30);
    g.fillText(`${BASE_RPM * state.speed} rpm`, 16, 44);

    if (summary) {
      summary.textContent = `peak R${activeRhythm} · ${counts.reduce((s, x) => s + x, 0)} codas in window`;
    }
  }

  let unsub = null;
  function attach() {
    if (unsub) return;
    lastFrame = performance.now();
    unsub = clock.subscribe(render);
  }
  function detach() {
    if (unsub) { unsub(); unsub = null; }
  }
  window.addEventListener("resize", () => render({ cursor: clock.cursor, playing: clock.playing, speed: clock.speed }));

  return { attach, detach, render: () => render({ cursor: clock.cursor, playing: clock.playing, speed: clock.speed }) };
}
