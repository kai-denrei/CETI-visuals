// Section 4 — 2D coda embedding via PCA on [rhythm one-hot, log-duration, ornament].
// Canvas 2D scatter. Colour by tempo (default), rhythm, ornament, or speaker.

const PAPER_BLUE = "#3b82c4";
const PAPER_ORANGE = "#e08a3c";
const AMBER = "#d9a766";
const MUTED = "#8a8a93";
const INK = "#e8e6dd";

export function mountEmbedding(ctx) {
  const canvas = document.getElementById("embedding-canvas");
  const tooltip = document.getElementById("emb-tooltip");
  const colourBy = document.getElementById("emb-colour-by");

  // Build feature matrix: 18 (rhythm one-hot) + 1 (log duration) + 1 (ornament) = 20 dims
  const N = ctx.codas.length;
  const D = 20;
  const X = new Float64Array(N * D);
  for (let i = 0; i < N; i++) {
    const c = ctx.codas[i];
    X[i * D + c.rhythm_cluster] = 1;
    X[i * D + 18] = Math.log(Math.max(1e-3, c.duration));
    X[i * D + 19] = c.has_ornament;
  }

  // Mean-centre
  const mean = new Float64Array(D);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < D; j++)
      mean[j] += X[i * D + j];
  for (let j = 0; j < D; j++) mean[j] /= N;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < D; j++)
      X[i * D + j] -= mean[j];

  // Unit-scale each dimension (so log-duration doesn't drown out one-hots)
  const sd = new Float64Array(D);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < D; j++) {
      const v = X[i * D + j];
      sd[j] += v * v;
    }
  for (let j = 0; j < D; j++) sd[j] = Math.sqrt(sd[j] / Math.max(1, N - 1));
  for (let i = 0; i < N; i++)
    for (let j = 0; j < D; j++)
      if (sd[j] > 1e-9) X[i * D + j] /= sd[j];

  // Power iteration to recover top 2 eigenvectors of X^T X (covariance)
  // X^T X is D x D; small (20x20), trivially exact.
  const C = new Float64Array(D * D);
  for (let a = 0; a < D; a++) {
    for (let b = 0; b < D; b++) {
      let s = 0;
      for (let i = 0; i < N; i++) s += X[i * D + a] * X[i * D + b];
      C[a * D + b] = s / Math.max(1, N - 1);
    }
  }

  const pc1 = powerIter(C, D, null);
  const pc2 = powerIter(C, D, pc1);

  // Project
  const xs = new Float32Array(N);
  const ys = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let a = 0, b = 0;
    for (let j = 0; j < D; j++) {
      const v = X[i * D + j];
      a += v * pc1[j];
      b += v * pc2[j];
    }
    xs[i] = a;
    ys[i] = b;
  }

  // Bounds
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < N; i++) {
    if (xs[i] < xmin) xmin = xs[i];
    if (xs[i] > xmax) xmax = xs[i];
    if (ys[i] < ymin) ymin = ys[i];
    if (ys[i] > ymax) ymax = ys[i];
  }
  // Pad by 5%
  const pad = 0.05;
  xmin -= (xmax - xmin) * pad; xmax += (xmax - xmin) * pad / (1 + 2 * pad);
  ymin -= (ymax - ymin) * pad; ymax += (ymax - ymin) * pad / (1 + 2 * pad);

  const tempoColours = ctx.clusters.tempos.map(t => t.colour);
  const rhythmColours = ctx.clusters.rhythms.map(r => r.colour);

  function colourFor(c) {
    const mode = colourBy.value;
    if (mode === "tempo") return tempoColours[c.tempo_cluster];
    if (mode === "rhythm") return rhythmColours[c.rhythm_cluster];
    if (mode === "ornament") return c.has_ornament ? AMBER : "#3b6f9b";
    if (mode === "speaker") {
      const palette = ["#3b82c4", "#e08a3c", "#7eb47e", "#b27dc2", "#d96f6f",
                       "#6ec5c0", "#d9a766", "#9aa8b2", "#b58b78", "#8889c2", "#c28898"];
      return palette[(c.speaker - 1) % palette.length];
    }
    return INK;
  }

  let layout = null;

  function render() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = 560;
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    const padL = 50, padR = 18, padT = 24, padB = 40;
    const innerW = cssW - padL - padR;
    const innerH = cssH - padT - padB;
    const xOf = v => padL + ((v - xmin) / (xmax - xmin)) * innerW;
    const yOf = v => padT + innerH - ((v - ymin) / (ymax - ymin)) * innerH;

    // Frame
    g.strokeStyle = "#2a2a32";
    g.lineWidth = 1;
    g.strokeRect(padL, padT, innerW, innerH);

    // Axis labels
    g.fillStyle = MUTED;
    g.font = "11px Source Serif, Source Serif Pro, Georgia, serif";
    g.textAlign = "center";
    g.fillText("PC1  →", padL + innerW / 2, cssH - 12);
    g.save();
    g.translate(16, padT + innerH / 2);
    g.rotate(-Math.PI / 2);
    g.textAlign = "center";
    g.fillText("PC2  →", 0, 0);
    g.restore();

    // Points
    layout = [];
    for (let i = 0; i < N; i++) {
      const px = xOf(xs[i]);
      const py = yOf(ys[i]);
      const c = ctx.codas[i];
      g.fillStyle = colourFor(c);
      g.globalAlpha = 0.6;
      g.beginPath();
      g.arc(px, py, 1.8, 0, Math.PI * 2);
      g.fill();
      layout.push({ x: px, y: py, coda: c });
    }
    g.globalAlpha = 1;

    // Legend
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.textAlign = "left";
    g.textBaseline = "middle";
    let lx = padL + 10, ly = padT + 14;
    const mode = colourBy.value;
    let items = [];
    if (mode === "tempo") items = ctx.clusters.tempos.map(t => ({
      label: `T${t.id} ${t.mean_duration.toFixed(2)}s`, colour: t.colour,
    }));
    else if (mode === "rhythm") items = ctx.clusters.rhythms.map(r => ({
      label: `R${r.id}`, colour: r.colour,
    }));
    else if (mode === "ornament") items = [
      { label: "plain", colour: "#3b6f9b" },
      { label: "ornament", colour: AMBER },
    ];
    else if (mode === "speaker") {
      const palette = ["#3b82c4", "#e08a3c", "#7eb47e", "#b27dc2", "#d96f6f",
                       "#6ec5c0", "#d9a766", "#9aa8b2", "#b58b78", "#8889c2", "#c28898"];
      const speakers = Array.from(new Set(ctx.codas.map(c => c.speaker))).sort((a, b) => a - b);
      items = speakers.map(s => ({ label: `whale ${s}`, colour: palette[(s - 1) % palette.length] }));
    }
    for (const it of items) {
      g.fillStyle = it.colour;
      g.beginPath(); g.arc(lx + 4, ly, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = INK;
      g.fillText(it.label, lx + 12, ly);
      lx += it.label.length * 6 + 22;
      if (lx > cssW - padR - 80) { lx = padL + 10; ly += 14; }
    }
  }

  canvas.addEventListener("mousemove", (ev) => {
    if (!layout) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    let best = null, bestD = 36;
    // Sample subset to keep this cheap; 3840 points is fine on modern hw
    for (const h of layout) {
      const dx = h.x - mx, dy = h.y - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = h; }
    }
    if (best) {
      tooltip.style.opacity = "1";
      tooltip.style.left = (best.x + 12) + "px";
      tooltip.style.top = (best.y + 12) + "px";
      const c = best.coda;
      tooltip.textContent =
        `coda #${c.id}\n` +
        `R${c.rhythm_cluster}  T${c.tempo_cluster}\n` +
        `${c.duration.toFixed(3)}s · ${c.n_clicks} clicks\n` +
        `caller ${c.speaker}` +
        (c.has_ornament ? "  · ornament" : "");
    } else {
      tooltip.style.opacity = "0";
    }
  });
  canvas.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
  colourBy.addEventListener("change", render);
  window.addEventListener("resize", () => requestAnimationFrame(render));

  render();
}

// --- power iteration with deflation -----------------------------------------

function powerIter(M, n, deflate) {
  // Start vector
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
