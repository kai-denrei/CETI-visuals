// Section 1 — the exchange plot, canvas 2D.
//
// One coda renders as a staircase: x = click index (1..n), y = time within
// exchange. The staircase is anchored at the coda's t_start; consecutive
// clicks step right and down by ICI seconds.

const PAPER_BLUE = "#3b82c4";
const PAPER_ORANGE = "#e08a3c";
const INK = "#e8e6dd";
const MUTED = "#8a8a93";
const AMBER = "#d9a766";
const TEAL = "#6ec5c0";

export function mountExchange(ctx) {
  const select = document.getElementById("ex-select");
  const cb_rubato = document.getElementById("ex-rubato");
  const cb_orn = document.getElementById("ex-ornament");
  const canvas = document.getElementById("exchange-canvas");
  const tooltip = document.getElementById("ex-tooltip");
  const summary = document.getElementById("ex-summary");
  const legend = document.getElementById("ex-legend");

  // Populate dropdown — exchanges sorted by n_codas descending
  for (const ex of ctx.exchanges) {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = `${ex.id}  —  ${ex.n_codas} codas, ${ex.n_speakers} speakers`;
    select.appendChild(opt);
  }
  // Pick a sensible default: a tight, two-speaker exchange where rubato is visible
  // (20-40 codas, 60-300s total). Falls back to the first 2-speaker, then to first.
  const defaultEx =
    ctx.exchanges.find(e => e.n_speakers === 2 && e.n_codas >= 20 && e.n_codas <= 40
                            && e.duration_total >= 60 && e.duration_total <= 300)
    ?? ctx.exchanges.find(e => e.n_speakers === 2)
    ?? ctx.exchanges[0];
  select.value = defaultEx.id;

  // Resize canvas to device pixels for crisp rendering
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = 640;
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    return { cssW, cssH, dpr };
  }

  // State
  let layout = null;  // hit-test data for tooltip
  let highlightCellKey = null;  // from grid linked highlight

  function getSpeakerColour(speaker, allSpeakers) {
    if (speaker === allSpeakers[0]) return PAPER_BLUE;
    if (speaker === allSpeakers[1]) return PAPER_ORANGE;
    // Fallback for rare 3+ speaker exchanges: extended palette
    const ext = ctx.clusters.caller_colours_extended || [PAPER_BLUE, PAPER_ORANGE];
    return ext[allSpeakers.indexOf(speaker) % ext.length];
  }

  function render() {
    const exId = select.value;
    const exch = ctx.exchanges.find(e => e.id === exId);
    if (!exch) return;
    const codasInEx = exch.coda_ids
      .map(id => ctx.codaById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.t_start - b.t_start);

    summary.textContent = `${codasInEx.length} codas · ${exch.duration_total.toFixed(1)}s span · ornament rate ${
      (codasInEx.filter(c => c.has_ornament).length / codasInEx.length * 100).toFixed(1)
    }%`;

    const { cssW, cssH, dpr } = resizeCanvas();
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    const speakers = exch.speakers;

    // Build legend
    legend.innerHTML = "";
    for (const s of speakers) {
      const colour = getSpeakerColour(s, speakers);
      const span = document.createElement("span");
      span.innerHTML = `<span class="swatch" style="background:${colour}"></span>caller&nbsp;${s}`;
      legend.appendChild(span);
    }
    {
      const span = document.createElement("span");
      span.innerHTML = `<span class="swatch" style="background:transparent;border:1px solid ${AMBER}"></span>ornament`;
      legend.appendChild(span);
    }
    if (cb_rubato.checked) {
      const span = document.createElement("span");
      span.innerHTML = `<span class="swatch" style="background:${TEAL}"></span>rubato connector`;
      legend.appendChild(span);
    }

    // Layout
    const padL = 72, padR = 28, padT = 36, padB = 36;
    const innerW = cssW - padL - padR;
    const innerH = cssH - padT - padB;

    const maxClicks = Math.max(8, ...codasInEx.map(c => c.n_clicks));
    const tMin = 0;
    const tMax = exch.duration_total;
    const xOfClick = i => padL + (i / (maxClicks + 1)) * innerW;
    const yOfTime = t => padT + ((t - tMin) / (tMax - tMin || 1)) * innerH;

    // Background grid: thin time ticks every 10s if range is large, else every 2s.
    const totalSec = tMax - tMin;
    const tickEvery = totalSec > 60 ? 30 : totalSec > 20 ? 10 : 2;
    g.strokeStyle = "#1c1c24";
    g.lineWidth = 1;
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.fillStyle = MUTED;
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (let t = 0; t <= totalSec; t += tickEvery) {
      const y = yOfTime(t);
      g.beginPath(); g.moveTo(padL, y); g.lineTo(cssW - padR, y); g.stroke();
      g.fillText(`${t.toFixed(0)}s`, padL - 8, y);
    }
    // Click-index ticks across the top
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = MUTED;
    for (let i = 1; i <= maxClicks; i += 1) {
      g.fillText(String(i), xOfClick(i), padT - 8);
    }

    // Axis labels
    g.save();
    g.translate(18, padT + innerH / 2);
    g.rotate(-Math.PI / 2);
    g.fillStyle = INK;
    g.font = "11px Source Serif, Source Serif Pro, Georgia, serif";
    g.textAlign = "center";
    g.fillText("time within exchange  →", 0, 0);
    g.restore();
    g.fillStyle = INK;
    g.textAlign = "center";
    g.fillText("click index within coda  →", padL + innerW / 2, cssH - 8);

    // Compute hit-test layout for hover
    layout = [];

    // Optional rubato connectors: faint teal lines connecting last click of
    // each coda to first click of the next-same-speaker coda.
    if (cb_rubato.checked) {
      // Group by speaker
      const bySpeaker = new Map();
      for (const c of codasInEx) {
        if (!bySpeaker.has(c.speaker)) bySpeaker.set(c.speaker, []);
        bySpeaker.get(c.speaker).push(c);
      }
      g.strokeStyle = TEAL;
      g.globalAlpha = 0.35;
      g.lineWidth = 1;
      for (const arr of bySpeaker.values()) {
        for (let i = 0; i + 1 < arr.length; i++) {
          const a = arr[i], b = arr[i + 1];
          if (b.t_start - (a.t_start + a.duration) > 8) continue;
          const ax = xOfClick(a.n_clicks);
          const ay = yOfTime(a.t_start - exch.t_start + a.duration);
          const bx = xOfClick(1);
          const by = yOfTime(b.t_start - exch.t_start);
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }

    // Draw the staircases
    for (const c of codasInEx) {
      const colour = getSpeakerColour(c.speaker, speakers);
      const t0 = c.t_start - exch.t_start;
      const xs = [];
      const ys = [];
      // click 1 is the anchor at t0; subsequent clicks add cumulative ICI
      let cum = 0;
      xs.push(xOfClick(1));
      ys.push(yOfTime(t0));
      for (let i = 0; i < c.ici_seq.length; i++) {
        cum += c.ici_seq[i];
        xs.push(xOfClick(i + 2));
        ys.push(yOfTime(t0 + cum));
      }
      // Soft alpha when highlighted-cell filter is active and this coda isn't in it
      let dim = false;
      if (highlightCellKey) {
        const [hr, ht] = highlightCellKey.split("-").map(Number);
        if (c.rhythm_cluster !== hr || c.tempo_cluster !== ht) dim = true;
      }
      g.globalAlpha = dim ? 0.18 : 0.92;
      g.strokeStyle = colour;
      g.lineWidth = dim ? 0.6 : 1.0;
      g.beginPath();
      for (let i = 0; i < xs.length; i++) {
        if (i === 0) g.moveTo(xs[i], ys[i]);
        else g.lineTo(xs[i], ys[i]);
      }
      g.stroke();

      g.fillStyle = colour;
      for (let i = 0; i < xs.length; i++) {
        g.beginPath();
        g.arc(xs[i], ys[i], dim ? 1.4 : 2.4, 0, Math.PI * 2);
        g.fill();
        const ici_prev = i === 0 ? null : c.ici_seq[i - 1];
        layout.push({
          x: xs[i], y: ys[i], r: 6,
          coda: c, click_idx: i + 1, ici_prev,
          t_abs: c.t_start + (i === 0 ? 0 : c.ici_seq.slice(0, i).reduce((a, b) => a + b, 0)),
        });
      }

      // Ornament marker: circle around final click
      if (cb_orn.checked && c.has_ornament && xs.length > 0) {
        g.globalAlpha = dim ? 0.3 : 1;
        g.strokeStyle = AMBER;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(xs[xs.length - 1], ys[ys.length - 1], 5.5, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  function onMove(ev) {
    if (!layout) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    // Find nearest hit within radius
    let best = null;
    let bestD = 64;  // px^2
    for (const h of layout) {
      const dx = h.x - mx, dy = h.y - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = h; }
    }
    if (best) {
      tooltip.style.opacity = "1";
      tooltip.style.left = (best.x + 12) + "px";
      tooltip.style.top = (best.y + 12) + "px";
      const ici = best.ici_prev !== null
        ? `ICI →  ${(best.ici_prev * 1000).toFixed(0)} ms`
        : `ICI →  —`;
      tooltip.textContent =
        `coda #${best.coda.id}   click ${best.click_idx}/${best.coda.n_clicks}\n` +
        `caller ${best.coda.speaker}   t=${best.t_abs.toFixed(2)}s\n` +
        `${ici}\n` +
        `R${best.coda.rhythm_cluster}  T${best.coda.tempo_cluster}` +
        (best.coda.has_ornament ? "  · ornament" : "");
    } else {
      tooltip.style.opacity = "0";
    }
  }

  function onLeave() { tooltip.style.opacity = "0"; }

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
  select.addEventListener("change", render);
  cb_rubato.addEventListener("change", render);
  cb_orn.addEventListener("change", render);
  window.addEventListener("resize", () => requestAnimationFrame(render));

  // Cross-section linked highlighting from the grid
  ctx.bus.addEventListener("grid-cell-hover", (e) => {
    highlightCellKey = e.detail || null;
    render();
  });

  render();
}
