// Section 2 — phonetic alphabet grid, SVG.
//
// 18 rhythm rows × 5 tempo columns. Cell shading = log(count + 1).
// Each cell carries a small pie: orange arc = ornament %, teal arc = rubato
// magnitude proxy (normalised mean |drift|). Hovering a cell emits an event
// for the exchange plot to dim non-member codas.

const AMBER = "#d9a766";
const TEAL = "#6ec5c0";
const INK = "#e8e6dd";
const MUTED = "#8a8a93";
const MUTED_SOFT = "#5a5a63";

export function mountGrid(ctx) {
  const svg = document.getElementById("grid-svg");
  const tooltip = document.getElementById("grid-tooltip");
  const NS = "http://www.w3.org/2000/svg";

  const N_R = 18, N_T = 5;

  // Aggregate
  const cells = {};  // key "r-t" -> { count, orn_rate, rubato_abs_mean, coda_ids }
  for (let r = 0; r < N_R; r++)
    for (let t = 0; t < N_T; t++)
      cells[`${r}-${t}`] = { count: 0, orn: 0, rubato_sum: 0, rubato_n: 0, codas: [] };
  for (const c of ctx.codas) {
    const k = `${c.rhythm_cluster}-${c.tempo_cluster}`;
    const cell = cells[k];
    if (!cell) continue;
    cell.count += 1;
    cell.orn += c.has_ornament;
    cell.codas.push(c.id);
    if (c.rubato_drift_prev != null) {
      cell.rubato_sum += Math.abs(c.rubato_drift_prev);
      cell.rubato_n += 1;
    }
  }
  let maxCount = 0;
  let maxRubato = 0;
  for (const k in cells) {
    const c = cells[k];
    c.orn_rate = c.count ? c.orn / c.count : 0;
    c.rubato_mean = c.rubato_n ? c.rubato_sum / c.rubato_n : 0;
    if (c.count > maxCount) maxCount = c.count;
    if (c.rubato_mean > maxRubato) maxRubato = c.rubato_mean;
  }
  const logMax = Math.log1p(maxCount);

  // Geometry
  const padL = 70, padR = 24, padT = 50, padB = 30;
  const W = 760, H = 720;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const cellW = innerW / N_T;
  const cellH = innerH / N_R;

  // Tempo labels
  const tempoMeans = ctx.clusters.tempos.map(t => t.mean_duration);
  const rhythmColours = ctx.clusters.rhythms.map(r => r.colour);

  // Header row
  {
    const labels = ["T0", "T1", "T2", "T3", "T4"];
    for (let t = 0; t < N_T; t++) {
      const cx = padL + cellW * (t + 0.5);
      const tx = document.createElementNS(NS, "text");
      tx.setAttribute("x", cx);
      tx.setAttribute("y", padT - 26);
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("fill", INK);
      tx.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
      tx.setAttribute("font-size", "11");
      tx.textContent = labels[t];
      svg.appendChild(tx);

      const txm = document.createElementNS(NS, "text");
      txm.setAttribute("x", cx);
      txm.setAttribute("y", padT - 12);
      txm.setAttribute("text-anchor", "middle");
      txm.setAttribute("fill", MUTED);
      txm.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
      txm.setAttribute("font-size", "9");
      txm.textContent = (tempoMeans[t] || 0).toFixed(2) + "s";
      svg.appendChild(txm);
    }
  }

  // Rhythm row labels and colour swatches
  for (let r = 0; r < N_R; r++) {
    const cy = padT + cellH * (r + 0.5);

    const sw = document.createElementNS(NS, "rect");
    sw.setAttribute("x", padL - 16);
    sw.setAttribute("y", cy - 4);
    sw.setAttribute("width", 6);
    sw.setAttribute("height", 8);
    sw.setAttribute("fill", rhythmColours[r]);
    svg.appendChild(sw);

    const tx = document.createElementNS(NS, "text");
    tx.setAttribute("x", padL - 24);
    tx.setAttribute("y", cy + 3);
    tx.setAttribute("text-anchor", "end");
    tx.setAttribute("fill", INK);
    tx.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
    tx.setAttribute("font-size", "10");
    tx.textContent = `R${r}`;
    svg.appendChild(tx);
  }

  // Cells
  let selected = null;
  for (let r = 0; r < N_R; r++) {
    for (let t = 0; t < N_T; t++) {
      const cell = cells[`${r}-${t}`];
      const x = padL + t * cellW;
      const y = padT + r * cellH;

      const grp = document.createElementNS(NS, "g");
      grp.setAttribute("class", "alphabet-cell");
      grp.setAttribute("data-key", `${r}-${t}`);
      grp.setAttribute("transform", `translate(${x},${y})`);

      const fillAlpha = cell.count > 0 ? 0.15 + 0.55 * (Math.log1p(cell.count) / logMax) : 0.04;
      const bg = document.createElementNS(NS, "rect");
      bg.setAttribute("x", 1);
      bg.setAttribute("y", 1);
      bg.setAttribute("width", cellW - 2);
      bg.setAttribute("height", cellH - 2);
      bg.setAttribute("class", "bg");
      bg.setAttribute("fill", `rgba(59, 130, 196, ${fillAlpha})`);
      bg.setAttribute("stroke", "#22222a");
      bg.setAttribute("stroke-width", "1");
      grp.appendChild(bg);

      // Count text
      const ct = document.createElementNS(NS, "text");
      ct.setAttribute("x", 6);
      ct.setAttribute("y", 12);
      ct.setAttribute("fill", cell.count ? INK : MUTED_SOFT);
      ct.setAttribute("font-family", "ui-monospace, SF Mono, monospace");
      ct.setAttribute("font-size", "10");
      ct.textContent = cell.count ? `${cell.count}` : "·";
      grp.appendChild(ct);

      if (cell.count > 0) {
        // Pie inset: orn rate as amber arc; rubato_mean (normalised) as teal arc on a separate ring
        const cx_p = cellW - 18;
        const cy_p = cellH - 16;
        const rad = 10;

        // Track
        const track = document.createElementNS(NS, "circle");
        track.setAttribute("cx", cx_p);
        track.setAttribute("cy", cy_p);
        track.setAttribute("r", rad);
        track.setAttribute("fill", "rgba(255,255,255,0.04)");
        track.setAttribute("stroke", "#1c1c24");
        track.setAttribute("stroke-width", "1");
        grp.appendChild(track);

        // Amber wedge for ornament %
        if (cell.orn_rate > 0) {
          const wedge = arcPath(cx_p, cy_p, rad, 0, cell.orn_rate);
          const p = document.createElementNS(NS, "path");
          p.setAttribute("d", wedge);
          p.setAttribute("fill", AMBER);
          p.setAttribute("opacity", "0.85");
          grp.appendChild(p);
        }

        // Teal outer arc for rubato magnitude
        const ru_frac = maxRubato > 0 ? Math.min(1, cell.rubato_mean / maxRubato) : 0;
        if (ru_frac > 0) {
          const p = ringPath(cx_p, cy_p, rad + 3, rad + 5, 0, ru_frac);
          const el = document.createElementNS(NS, "path");
          el.setAttribute("d", p);
          el.setAttribute("fill", TEAL);
          el.setAttribute("opacity", "0.85");
          grp.appendChild(el);
        }
      }

      grp.addEventListener("mouseenter", (ev) => {
        if (cell.count === 0) return;
        if (selected && selected !== grp) selected.classList.remove("selected");
        grp.classList.add("selected");
        selected = grp;
        tooltip.style.opacity = "1";
        const r2 = svg.getBoundingClientRect();
        tooltip.style.left = (ev.clientX - r2.left + 14) + "px";
        tooltip.style.top = (ev.clientY - r2.top + 14) + "px";
        tooltip.textContent =
          `R${r}  ·  T${t}\n` +
          `n=${cell.count}\n` +
          `orn  ${(cell.orn_rate * 100).toFixed(1)}%\n` +
          `|Δ rubato|  ${cell.rubato_mean.toFixed(3)}s`;
        ctx.bus.dispatchEvent(new CustomEvent("grid-cell-hover", { detail: `${r}-${t}` }));
      });
      grp.addEventListener("mousemove", (ev) => {
        const r2 = svg.getBoundingClientRect();
        tooltip.style.left = (ev.clientX - r2.left + 14) + "px";
        tooltip.style.top = (ev.clientY - r2.top + 14) + "px";
      });
      grp.addEventListener("mouseleave", () => {
        grp.classList.remove("selected");
        selected = null;
        tooltip.style.opacity = "0";
        ctx.bus.dispatchEvent(new CustomEvent("grid-cell-hover", { detail: null }));
      });

      svg.appendChild(grp);
    }
  }

  // Axis labels
  const xlabel = document.createElementNS(NS, "text");
  xlabel.setAttribute("x", padL + innerW / 2);
  xlabel.setAttribute("y", H - 6);
  xlabel.setAttribute("text-anchor", "middle");
  xlabel.setAttribute("fill", MUTED);
  xlabel.setAttribute("font-family", "Source Serif, Source Serif Pro, Georgia, serif");
  xlabel.setAttribute("font-size", "11");
  xlabel.textContent = "tempo cluster  →";
  svg.appendChild(xlabel);

  const ylabel = document.createElementNS(NS, "text");
  ylabel.setAttribute("text-anchor", "middle");
  ylabel.setAttribute("fill", MUTED);
  ylabel.setAttribute("font-family", "Source Serif, Source Serif Pro, Georgia, serif");
  ylabel.setAttribute("font-size", "11");
  ylabel.setAttribute("transform", `translate(18, ${padT + innerH / 2}) rotate(-90)`);
  ylabel.textContent = "rhythm cluster  →";
  svg.appendChild(ylabel);
}

// Helpers — SVG arc path generators.
// fraction in [0, 1]; angle 0 = top (12 o'clock), running clockwise.
function polar(cx, cy, r, angle) {
  return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
}

function arcPath(cx, cy, r, fStart, fEnd) {
  const a0 = fStart * Math.PI * 2;
  const a1 = fEnd * Math.PI * 2;
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function ringPath(cx, cy, rInner, rOuter, fStart, fEnd) {
  const a0 = fStart * Math.PI * 2;
  const a1 = fEnd * Math.PI * 2;
  const [x0o, y0o] = polar(cx, cy, rOuter, a0);
  const [x1o, y1o] = polar(cx, cy, rOuter, a1);
  const [x0i, y0i] = polar(cx, cy, rInner, a0);
  const [x1i, y1i] = polar(cx, cy, rInner, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0o} ${y0o} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${large} 0 ${x0i} ${y0i} Z`;
}
