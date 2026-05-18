// v2 — Section 2 — Translation lattice.
//
// Surrogate for WhAM Fig 3. Background = natural-coda PCA cloud (same 20-D
// feature space as v1 embedding, PC1×PC2 projection). Foreground = 5 synthetic
// prompts with hand-crafted ICI shapes living far outside the natural cloud.
// "Translate" snaps each prompt to its nearest natural-coda neighbour over
// 600ms; the line connects before→after, the diamond marks the destination.
//
// Distance metric is selectable (euclidean | cosine). Dotted reference line =
// median pairwise distance among a random subsample of natural codas.

const PAPER_BLUE = "#3b82c4";
const PAPER_ORANGE = "#e08a3c";
const AMBER = "#d9a766";
const TEAL = "#6ec5c0";
const INK = "#e8e6dd";
const MUTED = "#8a8a93";

const D = 20;  // 18 rhythm one-hot + log-duration + ornament — same as v1

export function mountTranslation(ctx) {
  const cb = document.getElementById("tx-translate");
  const metricSel = document.getElementById("tx-metric");
  const canvas = document.getElementById("translation-canvas");
  const tooltip = document.getElementById("tx-tooltip");
  const summary = document.getElementById("tx-summary");

  // ---- Build natural-coda feature matrix + PCA (same recipe as v1) ----------
  const N = ctx.codas.length;
  const X = new Float64Array(N * D);
  for (let i = 0; i < N; i++) {
    const c = ctx.codas[i];
    X[i * D + c.rhythm_cluster] = 1;
    X[i * D + 18] = Math.log(Math.max(1e-3, c.duration));
    X[i * D + 19] = c.has_ornament;
  }
  const mean = new Float64Array(D);
  for (let i = 0; i < N; i++) for (let j = 0; j < D; j++) mean[j] += X[i * D + j];
  for (let j = 0; j < D; j++) mean[j] /= N;
  for (let i = 0; i < N; i++) for (let j = 0; j < D; j++) X[i * D + j] -= mean[j];
  const sd = new Float64Array(D);
  for (let i = 0; i < N; i++) for (let j = 0; j < D; j++) {
    const v = X[i * D + j]; sd[j] += v * v;
  }
  for (let j = 0; j < D; j++) sd[j] = Math.sqrt(sd[j] / Math.max(1, N - 1));
  for (let i = 0; i < N; i++) for (let j = 0; j < D; j++)
    if (sd[j] > 1e-9) X[i * D + j] /= sd[j];

  const C = new Float64Array(D * D);
  for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) {
    let s = 0; for (let i = 0; i < N; i++) s += X[i * D + a] * X[i * D + b];
    C[a * D + b] = s / Math.max(1, N - 1);
  }
  const pc1 = powerIter(C, D, null);
  const pc2 = powerIter(C, D, pc1);

  // Project natural codas to (xs, ys)
  const xs = new Float32Array(N), ys = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let a = 0, b = 0;
    for (let j = 0; j < D; j++) { a += X[i * D + j] * pc1[j]; b += X[i * D + j] * pc2[j]; }
    xs[i] = a; ys[i] = b;
  }
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < N; i++) {
    if (xs[i] < xmin) xmin = xs[i]; if (xs[i] > xmax) xmax = xs[i];
    if (ys[i] < ymin) ymin = ys[i]; if (ys[i] > ymax) ymax = ys[i];
  }

  // ---- Median pairwise distance baseline (subsample) ------------------------
  // The "FAD-indistinguishable" threshold in the paper is 0.21. Here we report
  // the analogous threshold in this 20-D feature space: the median pairwise
  // distance over a random 200-coda subsample. We compute this once for both
  // metrics. Distance lines are rendered in raw 20-D distance units.
  const SUB = Math.min(200, N);
  const subIdx = [];
  for (let i = 0; i < SUB; i++) subIdx.push(Math.floor((i / SUB) * N));
  function pairwiseMedian(metric) {
    const dists = [];
    for (let i = 0; i < SUB; i++) {
      for (let j = i + 1; j < SUB; j++) {
        const a = subIdx[i], b = subIdx[j];
        dists.push(metric === "cosine" ? cosDist(X, a, b) : euclidDist(X, a, b));
      }
    }
    dists.sort((p, q) => p - q);
    return dists[Math.floor(dists.length / 2)];
  }
  const medianEuclid = pairwiseMedian("euclid");
  const medianCosine = pairwiseMedian("cosine");

  // ---- Construct synthetic prompt feature vectors --------------------------
  // Each prompt is a 20-D feature vector pre-standardisation. We standardise
  // it using the same mean/sd as the natural cloud, then project with pc1/pc2.
  // The prompts are tuned to land *outside* the natural cloud; "translate"
  // pulls them to their nearest natural neighbour.

  function buildPrompts() {
    // Raw feature builder: rhythm hot at idx, log-duration, ornament flag
    const make = (rhythmIdx, durSec, orn) => {
      const v = new Float64Array(D);
      if (rhythmIdx >= 0 && rhythmIdx < 18) v[rhythmIdx] = 1;
      v[18] = Math.log(Math.max(1e-3, durSec));
      v[19] = orn;
      return v;
    };

    // "metronome": no rhythm hot (looks like a uniform sequence) + medium dur
    // "scrambled": random rhythm hot + odd duration
    // "beeps": tiny duration + no rhythm hot
    // "noise": random rhythm hot + huge duration, no ornament
    // "real": exact match of a tempo=2 / rhythm=2 mode (sits inside cloud)
    return [
      { label: "metronome",      raw: make(-1, 0.6,  0), colour: TEAL },
      { label: "scrambled coda", raw: make(7,  3.0,  1), colour: AMBER },
      { label: "beeps",          raw: make(-1, 0.02, 0), colour: "#c28898" },
      { label: "white-noise",    raw: make(11, 4.0,  1), colour: "#b58b78" },
      { label: "real coda",      raw: make(2,  0.78, 0), colour: PAPER_BLUE },
    ];
  }

  const prompts = buildPrompts();
  // Standardise prompts then project to 2D
  for (const p of prompts) {
    const std = new Float64Array(D);
    for (let j = 0; j < D; j++) {
      std[j] = (p.raw[j] - mean[j]) / (sd[j] > 1e-9 ? sd[j] : 1);
    }
    p.std = std;
    p.px = 0; for (let j = 0; j < D; j++) p.px += std[j] * pc1[j];
    p.py = 0; for (let j = 0; j < D; j++) p.py += std[j] * pc2[j];
  }

  // ---- Nearest-neighbour search ---------------------------------------------
  function nearestIdx(stdVec, metric) {
    let bestI = -1, bestD = Infinity;
    for (let i = 0; i < N; i++) {
      const d = metric === "cosine" ? cosVec(stdVec, X, i) : euclVec(stdVec, X, i);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return { idx: bestI, dist: bestD };
  }

  // ---- Animation state ------------------------------------------------------
  let animStart = null;
  const ANIM_MS = 600;
  let translated = false;
  let nearestCache = null;

  function computeTargets(metric) {
    nearestCache = prompts.map(p => {
      const nn = nearestIdx(p.std, metric);
      return { tx: xs[nn.idx], ty: ys[nn.idx], idx: nn.idx, dist: nn.dist };
    });
  }

  // Hover hit-test
  let layout = null;

  function render() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = 520;
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    const padL = 50, padR = 24, padT = 28, padB = 44;
    const innerW = cssW - padL - padR;
    const innerH = cssH - padT - padB;

    // Plot bounds need to encompass both the cloud AND the prompts.
    let bx0 = xmin, bx1 = xmax, by0 = ymin, by1 = ymax;
    for (const p of prompts) {
      if (p.px < bx0) bx0 = p.px; if (p.px > bx1) bx1 = p.px;
      if (p.py < by0) by0 = p.py; if (p.py > by1) by1 = p.py;
    }
    const pad = 0.06;
    const xr = bx1 - bx0, yr = by1 - by0;
    bx0 -= xr * pad; bx1 += xr * pad; by0 -= yr * pad; by1 += yr * pad;
    const xOf = v => padL + ((v - bx0) / (bx1 - bx0)) * innerW;
    const yOf = v => padT + innerH - ((v - by0) / (by1 - by0)) * innerH;

    // Frame
    g.strokeStyle = "#2a2a32"; g.lineWidth = 1;
    g.strokeRect(padL, padT, innerW, innerH);

    g.fillStyle = MUTED;
    g.font = "11px Source Serif, Source Serif Pro, Georgia, serif";
    g.textAlign = "center";
    g.fillText("PC1  →", padL + innerW / 2, cssH - 16);
    g.save(); g.translate(16, padT + innerH / 2); g.rotate(-Math.PI / 2);
    g.textAlign = "center"; g.fillText("PC2  →", 0, 0); g.restore();

    // Dim natural cloud
    g.fillStyle = "rgba(140,140,150,0.32)";
    for (let i = 0; i < N; i++) {
      g.beginPath(); g.arc(xOf(xs[i]), yOf(ys[i]), 1.6, 0, Math.PI * 2); g.fill();
    }

    // Animation progress
    const now = performance.now();
    let t = 0;
    if (translated && animStart !== null) {
      t = Math.min(1, (now - animStart) / ANIM_MS);
    } else if (translated) {
      t = 1;
    } else if (!translated && animStart !== null) {
      // Reverse animation back to origin
      t = 1 - Math.min(1, (now - animStart) / ANIM_MS);
    }
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);

    layout = [];
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      const tgt = nearestCache ? nearestCache[i] : { tx: p.px, ty: p.py, dist: 0 };
      const cx = p.px + (tgt.tx - p.px) * eased;
      const cy = p.py + (tgt.ty - p.py) * eased;

      // Path line (before → after) drawn when partially or fully translated
      if (eased > 0.02) {
        g.strokeStyle = p.colour; g.globalAlpha = 0.35; g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(xOf(p.px), yOf(p.py));
        g.lineTo(xOf(cx), yOf(cy));
        g.stroke();
        g.globalAlpha = 1;
      }

      // Origin marker (circle) always shown — dimmed when translated
      g.fillStyle = p.colour;
      g.globalAlpha = eased > 0.5 ? 0.4 : 1;
      g.beginPath(); g.arc(xOf(p.px), yOf(p.py), 5, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;

      // Destination marker (diamond) at interpolated point
      if (eased > 0.02) {
        const px = xOf(cx), py = yOf(cy);
        g.fillStyle = p.colour;
        g.globalAlpha = 0.95;
        g.beginPath();
        g.moveTo(px, py - 6); g.lineTo(px + 5, py);
        g.lineTo(px, py + 6); g.lineTo(px - 5, py); g.closePath();
        g.fill();
        g.globalAlpha = 1;
      }

      // Label
      g.fillStyle = INK; g.globalAlpha = 0.85;
      g.font = "10px ui-monospace, SF Mono, monospace";
      g.textAlign = "left"; g.textBaseline = "middle";
      g.fillText(p.label, xOf(p.px) + 9, yOf(p.py));
      g.globalAlpha = 1;

      // Hit test entry for hover (origin)
      layout.push({
        x: xOf(p.px), y: yOf(p.py), kind: "origin", prompt: p,
        target: tgt,
      });
      if (eased > 0.5) {
        layout.push({
          x: xOf(cx), y: yOf(cy), kind: "target", prompt: p, target: tgt,
        });
      }
    }

    // FAD-indistinguishable baseline as a textual annotation top-left
    const metric = metricSel.value;
    const baseline = metric === "cosine" ? medianCosine : medianEuclid;
    g.fillStyle = MUTED;
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillText(`median pairwise ${metric === "cosine" ? "cosine" : "euclid"} (200 codas) = ${baseline.toFixed(3)}`,
               padL + 8, padT + 8);
    g.fillText(`translate: ${translated ? "ON" : "off"}`, padL + 8, padT + 22);

    // Summary line
    if (nearestCache) {
      const avgDist = nearestCache.reduce((s, d) => s + d.dist, 0) / nearestCache.length;
      summary.textContent = `mean nearest-neighbour ${metric} distance = ${avgDist.toFixed(3)} · baseline ${baseline.toFixed(3)}`;
    } else {
      summary.textContent = "";
    }

    // Continue animating?
    if ((translated && t < 1) || (!translated && t > 0 && animStart !== null)) {
      requestAnimationFrame(render);
    } else if (!translated && t <= 0) {
      animStart = null;  // stop the reverse animation cleanly
    }
  }

  // ---- Event wiring ---------------------------------------------------------
  cb.addEventListener("change", () => {
    translated = cb.checked;
    if (translated) computeTargets(metricSel.value);
    animStart = performance.now();
    requestAnimationFrame(render);
  });
  metricSel.addEventListener("change", () => {
    if (translated) {
      computeTargets(metricSel.value);
      animStart = performance.now();
      requestAnimationFrame(render);
    } else {
      render();
    }
  });

  canvas.addEventListener("mousemove", ev => {
    if (!layout) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    let best = null, bestD = 64;
    for (const h of layout) {
      const dx = h.x - mx, dy = h.y - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = h; }
    }
    if (best) {
      tooltip.style.opacity = "1";
      tooltip.style.left = (best.x + 12) + "px";
      tooltip.style.top = (best.y + 12) + "px";
      const p = best.prompt;
      const lines = [
        `${p.label}  (${best.kind})`,
      ];
      if (best.target) {
        lines.push(`nearest-neighbour distance = ${best.target.dist.toFixed(3)}`);
        const nn = ctx.codas[best.target.idx];
        if (nn) lines.push(`→ coda #${nn.id}  R${nn.rhythm_cluster} T${nn.tempo_cluster}`);
      }
      tooltip.textContent = lines.join("\n");
    } else {
      tooltip.style.opacity = "0";
    }
  });
  canvas.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
  window.addEventListener("resize", () => requestAnimationFrame(render));

  // Initial: precompute targets for the default metric so the summary line is
  // meaningful immediately, even without translate=on.
  computeTargets(metricSel.value);
  render();
}

// --- distance helpers -------------------------------------------------------

function euclidDist(X, a, b) {
  let s = 0;
  for (let j = 0; j < D; j++) {
    const dv = X[a * D + j] - X[b * D + j];
    s += dv * dv;
  }
  return Math.sqrt(s);
}

function cosDist(X, a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let j = 0; j < D; j++) {
    const va = X[a * D + j], vb = X[b * D + j];
    dot += va * vb; na += va * va; nb += vb * vb;
  }
  const denom = Math.sqrt(Math.max(1e-12, na * nb));
  return 1 - dot / denom;
}

function euclVec(v, X, b) {
  let s = 0;
  for (let j = 0; j < D; j++) {
    const dv = v[j] - X[b * D + j];
    s += dv * dv;
  }
  return Math.sqrt(s);
}

function cosVec(v, X, b) {
  let dot = 0, na = 0, nb = 0;
  for (let j = 0; j < D; j++) {
    const va = v[j], vb = X[b * D + j];
    dot += va * vb; na += va * va; nb += vb * vb;
  }
  const denom = Math.sqrt(Math.max(1e-12, na * nb));
  return 1 - dot / denom;
}

// --- power iteration with deflation ----------------------------------------

function powerIter(M, n, deflate) {
  let v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.sin(i + 1) + 0.13;
  normalise(v);
  if (deflate) orth(v, deflate);
  for (let iter = 0; iter < 100; iter++) {
    const w = new Float64Array(n);
    for (let a = 0; a < n; a++) {
      let s = 0;
      for (let b = 0; b < n; b++) s += M[a * n + b] * v[b];
      w[a] = s;
    }
    if (deflate) orth(w, deflate);
    normalise(w);
    v = w;
  }
  return v;
}
function normalise(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= s;
}
function orth(v, u) {
  let dot = 0;
  for (let i = 0; i < v.length; i++) dot += v[i] * u[i];
  for (let i = 0; i < v.length; i++) v[i] -= dot * u[i];
}
