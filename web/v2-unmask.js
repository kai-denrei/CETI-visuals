// v2 — Section 3 — Token-stream / iterative unmask.
//
// Surrogate for WhAM Fig 2 (VampNet). Pick a coda, render its ICI sequence as
// a row of token tiles colour-binned by ICI value, mask ~40% at random, and
// reveal the most-confident masked positions on each "step".
//
// Confidence proxy: a 1-NN predictor over the natural-coda cloud, conditioned
// on currently-unmasked positions. For each masked position the predictor finds
// the natural coda whose unmasked positions are closest (Euclidean over the
// shared subset of ICI positions, length-aware), and reports
//   confidence = 1 - distance / dmax
// We commit the top-2 positions per step until none remain.
//
// This is a deliberate caricature: VampNet/WhAM operate on Descript Audio Codec
// tokens, not on raw ICIs. The pattern (mask → iterate confidence → commit)
// is faithful; the substrate is not.

const PAPER_BLUE = "#3b82c4";
const AMBER = "#d9a766";
const TEAL = "#6ec5c0";
const INK = "#e8e6dd";
const MUTED = "#8a8a93";

const TILE_W = 36;
const TILE_H = 30;
const TILE_GAP = 4;
const STRIP_H = 12;
const STRIP_GAP = 6;

// Quantise ICI (seconds) into colour bins. Range covers most natural codas:
// 20 ms — 300 ms.
const ICI_BINS = [
  { lo: 0.00, hi: 0.05, colour: "#3b82c4" },
  { lo: 0.05, hi: 0.08, colour: "#5b9dc9" },
  { lo: 0.08, hi: 0.12, colour: "#7faecd" },
  { lo: 0.12, hi: 0.18, colour: "#c9aa84" },
  { lo: 0.18, hi: 0.25, colour: "#d9a766" },
  { lo: 0.25, hi: 10.0, colour: "#e08a3c" },
];
function iciColour(v) {
  for (const b of ICI_BINS) if (v >= b.lo && v < b.hi) return b.colour;
  return INK;
}
function iciBinIdx(v) {
  for (let i = 0; i < ICI_BINS.length; i++) {
    if (v >= ICI_BINS[i].lo && v < ICI_BINS[i].hi) return i;
  }
  return ICI_BINS.length - 1;
}

export function mountUnmask(ctx) {
  const sel = document.getElementById("um-coda");
  const btnMask = document.getElementById("um-mask");
  const btnStep = document.getElementById("um-step");
  const btnReset = document.getElementById("um-reset");
  const canvas = document.getElementById("unmask-canvas");
  const tooltip = document.getElementById("um-tooltip");
  const summary = document.getElementById("um-summary");

  // Populate coda dropdown — sample 40 codas across a range of n_clicks so the
  // user gets some variety in length and rhythm/tempo. Sort by id for stable
  // display.
  const allCandidates = ctx.codas.filter(c => c.n_clicks >= 6 && c.n_clicks <= 16);
  const stride = Math.max(1, Math.floor(allCandidates.length / 40));
  const candidates = allCandidates
    .filter((_, i) => i % stride === 0)
    .slice(0, 40)
    .sort((a, b) => a.id - b.id);
  for (const c of candidates) {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = `coda #${c.id}  ·  ${c.n_clicks} clicks  ·  R${c.rhythm_cluster} T${c.tempo_cluster}`;
    sel.appendChild(opt);
  }
  if (candidates.length === 0) {
    // fallback
    const opt = document.createElement("option");
    opt.value = "0";
    opt.textContent = "coda #0";
    sel.appendChild(opt);
  }

  // ---- State ----------------------------------------------------------------
  // tokens: array of { ici, masked, revealed_step } in original order
  // revealed_step is the step number at which a masked position was filled in;
  // 0 = was never masked, -1 = masked and not yet revealed.

  let state = null;

  function loadCoda() {
    const id = parseInt(sel.value, 10);
    const c = ctx.codaById.get(id) || ctx.codas[0];
    state = {
      coda: c,
      tokens: c.ici_seq.map(v => ({ ici: v, masked: false, revealed_step: 0, certainty: null })),
      step: 0,
    };
    summary.textContent = `${state.tokens.length} tokens · no mask`;
  }

  function applyMask() {
    if (!state) return;
    const n = state.tokens.length;
    // Mask ~40% at random, but leave at least 2 unmasked positions
    const k = Math.max(1, Math.min(n - 2, Math.floor(n * 0.4)));
    // Random sample without replacement
    const idxs = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    const maskSet = new Set(idxs.slice(0, k));
    for (let i = 0; i < n; i++) {
      state.tokens[i].masked = maskSet.has(i);
      state.tokens[i].revealed_step = maskSet.has(i) ? -1 : 0;
      state.tokens[i].certainty = null;
    }
    state.step = 0;
    computeCertainties();
    summary.textContent = `${k} masked of ${n} · step 0`;
  }

  // Predictor: for each masked position, find the nearest natural coda whose
  // ICI sequence has the same length, computing distance over the currently-
  // visible positions; commit its ICI at the masked index as the prediction.
  // Confidence = 1 - normalised distance, clamped to [0, 1].
  function computeCertainties() {
    if (!state) return;
    const tgtN = state.tokens.length;

    let pool = ctx.codas.filter(c => c.ici_seq.length === tgtN && c.id !== state.coda.id);
    if (pool.length < 10) {
      pool = ctx.codas.filter(c => Math.abs(c.ici_seq.length - tgtN) <= 1 && c.id !== state.coda.id);
    }

    // Indices of positions currently visible (known or already-revealed)
    const visIdx = [];
    for (let i = 0; i < tgtN; i++) {
      const t = state.tokens[i];
      if (!t.masked || t.revealed_step > 0) visIdx.push(i);
    }

    for (let pos = 0; pos < tgtN; pos++) {
      const tok = state.tokens[pos];
      if (!tok.masked || tok.revealed_step > 0) continue;
      let bestD = Infinity, bestC = null;
      for (const c of pool) {
        let s = 0, ct = 0;
        for (const i of visIdx) {
          if (i >= c.ici_seq.length) continue;
          const dv = state.tokens[i].ici - c.ici_seq[i];
          s += dv * dv; ct += 1;
        }
        if (ct === 0) continue;
        const d = Math.sqrt(s / ct);
        if (d < bestD) { bestD = d; bestC = c; }
      }
      if (bestC) {
        const safePos = Math.min(pos, bestC.ici_seq.length - 1);
        tok._pred = bestC.ici_seq[safePos];
        tok.certainty = Math.max(0, Math.min(1, 1 - bestD / 0.15));
      } else {
        tok._pred = 0.1;
        tok.certainty = 0;
      }
    }
  }

  function step() {
    if (!state) return;
    const remaining = state.tokens.filter(t => t.masked && t.revealed_step < 0);
    if (remaining.length === 0) {
      summary.textContent = `${state.tokens.length} tokens · all revealed at step ${state.step}`;
      return;
    }
    state.step += 1;
    // Reveal up to top-2 by certainty in parallel
    remaining.sort((a, b) => (b.certainty || 0) - (a.certainty || 0));
    const k = Math.min(2, remaining.length);
    for (let i = 0; i < k; i++) {
      remaining[i].ici = remaining[i]._pred ?? remaining[i].ici;
      remaining[i].revealed_step = state.step;
    }
    computeCertainties();
    const stillMasked = state.tokens.filter(t => t.masked && t.revealed_step < 0).length;
    summary.textContent = `${state.tokens.length} tokens · step ${state.step} · ${stillMasked} still masked`;
  }

  // ---- Render ---------------------------------------------------------------
  let layout = [];

  function render() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = 320;
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    if (!state) return;

    const n = state.tokens.length;
    // Dynamic tile width so the row fits
    const maxRowW = cssW - 60;
    const tileW = Math.max(18, Math.min(TILE_W, (maxRowW - (n - 1) * TILE_GAP) / n));
    const totalW = n * tileW + (n - 1) * TILE_GAP;
    const startX = (cssW - totalW) / 2;
    const tileTop = 60;

    // Header: legend of ICI bins
    g.fillStyle = MUTED;
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.textAlign = "left"; g.textBaseline = "middle";
    let lx = 30;
    for (let i = 0; i < ICI_BINS.length; i++) {
      const b = ICI_BINS[i];
      g.fillStyle = b.colour;
      g.fillRect(lx, 18, 12, 8);
      g.fillStyle = INK;
      const lbl = i === ICI_BINS.length - 1
        ? `${(b.lo * 1000).toFixed(0)}+ ms`
        : `${(b.lo * 1000).toFixed(0)}–${(b.hi * 1000).toFixed(0)}`;
      g.fillText(lbl, lx + 16, 22);
      lx += 16 + lbl.length * 6 + 18;
    }

    layout = [];
    // Tiles
    for (let i = 0; i < n; i++) {
      const t = state.tokens[i];
      const x = startX + i * (tileW + TILE_GAP);
      const y = tileTop;
      const masked = t.masked && t.revealed_step < 0;
      if (masked) {
        g.fillStyle = "#2a2a32";
        g.strokeStyle = "#3a3a44";
        g.lineWidth = 1;
        g.fillRect(x, y, tileW, TILE_H);
        g.strokeRect(x + 0.5, y + 0.5, tileW - 1, TILE_H - 1);
        g.fillStyle = MUTED;
        g.font = "11px ui-monospace, SF Mono, monospace";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("?", x + tileW / 2, y + TILE_H / 2);
      } else {
        const c = iciColour(t.ici);
        g.fillStyle = c;
        g.fillRect(x, y, tileW, TILE_H);
        // Border colour denotes provenance: amber outline if revealed by unmask
        if (t.masked && t.revealed_step > 0) {
          g.strokeStyle = AMBER; g.lineWidth = 1.5;
          g.strokeRect(x + 0.75, y + 0.75, tileW - 1.5, TILE_H - 1.5);
        }
        // ICI numeric centred
        g.fillStyle = "rgba(8,8,11,0.7)";
        g.font = "10px ui-monospace, SF Mono, monospace";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(`${(t.ici * 1000).toFixed(0)}`, x + tileW / 2, y + TILE_H / 2);
      }
      // Position index above
      g.fillStyle = MUTED;
      g.font = "9px ui-monospace, SF Mono, monospace";
      g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.fillText(String(i + 1), x + tileW / 2, y - 6);

      layout.push({ x, y, w: tileW, h: TILE_H, tok: t, idx: i });
    }

    // Strip: certainty heat for masked positions
    const stripY = tileTop + TILE_H + STRIP_GAP + 18;
    g.fillStyle = MUTED;
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillText("certainty per masked position", 30, stripY - 4);
    for (let i = 0; i < n; i++) {
      const t = state.tokens[i];
      const x = startX + i * (tileW + TILE_GAP);
      if (t.masked && t.revealed_step < 0) {
        const c = t.certainty ?? 0;
        g.fillStyle = "#1e1e26";
        g.fillRect(x, stripY, tileW, STRIP_H);
        g.fillStyle = TEAL;
        g.globalAlpha = 0.4 + 0.6 * c;
        g.fillRect(x, stripY, tileW * c, STRIP_H);
        g.globalAlpha = 1;
      } else if (t.masked && t.revealed_step > 0) {
        // Already revealed: dim cell with step label
        g.fillStyle = "rgba(217,167,102,0.18)";
        g.fillRect(x, stripY, tileW, STRIP_H);
        g.fillStyle = AMBER;
        g.font = "9px ui-monospace, SF Mono, monospace";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(`s${t.revealed_step}`, x + tileW / 2, stripY + STRIP_H / 2);
      } else {
        // Always-known: thin tick
        g.fillStyle = "rgba(140,140,150,0.18)";
        g.fillRect(x, stripY + STRIP_H / 2 - 1, tileW, 2);
      }
    }

    // Footer staircase: same as v1 exchange visualisation, single coda — gives
    // a visual sense of the shape behind the tokens.
    const sfTop = stripY + STRIP_H + 26;
    const sfHeight = cssH - sfTop - 14;
    if (sfHeight > 30) {
      const padL = 60, padR = 40;
      const innerW = cssW - padL - padR;
      const cumICIs = [];
      let cum = 0;
      cumICIs.push(0);
      for (const t of state.tokens) {
        // For still-masked tokens we estimate cum with the prediction so the
        // staircase doesn't break — drawn in dim grey for those segments.
        const v = (t.masked && t.revealed_step < 0) ? (t._pred ?? 0.1) : t.ici;
        cum += v;
        cumICIs.push(cum);
      }
      const tMax = cumICIs[cumICIs.length - 1] || 1;
      const xOf = i => padL + (i / Math.max(1, cumICIs.length - 1)) * innerW;
      const yOf = t => sfTop + (t / tMax) * sfHeight;

      g.fillStyle = MUTED;
      g.font = "10px ui-monospace, SF Mono, monospace";
      g.textAlign = "right"; g.textBaseline = "middle";
      g.fillText(`${tMax.toFixed(2)}s`, padL - 8, yOf(tMax));
      g.fillText("0", padL - 8, yOf(0));

      g.strokeStyle = "#1c1c24"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(padL, sfTop); g.lineTo(cssW - padR, sfTop); g.stroke();

      // Segmented line: dim where source token is still masked
      for (let i = 0; i + 1 < cumICIs.length; i++) {
        const t = state.tokens[i];
        const masked = t.masked && t.revealed_step < 0;
        g.strokeStyle = masked ? "#3a3a44" : PAPER_BLUE;
        g.globalAlpha = masked ? 0.7 : 0.92;
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(xOf(i), yOf(cumICIs[i]));
        g.lineTo(xOf(i + 1), yOf(cumICIs[i + 1]));
        g.stroke();
      }
      g.globalAlpha = 1;
      // Dots
      for (let i = 0; i < cumICIs.length; i++) {
        const tIdx = Math.max(0, i - 1);
        const t = state.tokens[tIdx];
        const masked = t && t.masked && t.revealed_step < 0;
        g.fillStyle = masked ? "#3a3a44" : PAPER_BLUE;
        g.beginPath(); g.arc(xOf(i), yOf(cumICIs[i]), 2.4, 0, Math.PI * 2); g.fill();
      }
    }
  }

  // ---- Tooltip --------------------------------------------------------------
  canvas.addEventListener("mousemove", ev => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    let best = null;
    for (const h of layout) {
      if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
        best = h; break;
      }
    }
    if (best) {
      tooltip.style.opacity = "1";
      tooltip.style.left = (best.x + 12) + "px";
      tooltip.style.top = (best.y + 12) + "px";
      const t = best.tok;
      const status = (t.masked && t.revealed_step < 0)
        ? `masked (cert. ${(t.certainty ?? 0).toFixed(2)})`
        : (t.masked ? `revealed at step ${t.revealed_step}` : `known`);
      tooltip.textContent =
        `pos ${best.idx + 1}\n` +
        `ICI = ${(t.ici * 1000).toFixed(0)} ms\n` +
        `bin ${iciBinIdx(t.ici)}\n` +
        status;
    } else {
      tooltip.style.opacity = "0";
    }
  });
  canvas.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });

  sel.addEventListener("change", () => { loadCoda(); render(); });
  btnMask.addEventListener("click", () => { applyMask(); render(); });
  btnStep.addEventListener("click", () => { step(); render(); });
  btnReset.addEventListener("click", () => { loadCoda(); render(); });
  window.addEventListener("resize", () => requestAnimationFrame(render));

  loadCoda();
  render();
}
