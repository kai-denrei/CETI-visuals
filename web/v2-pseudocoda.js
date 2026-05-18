// v2 — Section 1 — Pseudocoda playground.
//
// Compose an ICI sequence from the four Sharma et al. axes:
//   rhythm cluster (normalised cumulative ICI centroid) → scale by tempo →
//   shift each repeat by rubato → optional final-ICI duplicate (ornament).
// Render staircases (one per repeat) on canvas; synth click train on Web Audio.
//
// The "model" here is purely additive at the feature level — it is NOT WhAM,
// it is what the user can do with WhAM's controls if the four axes were knobs.

const PAPER_BLUE = "#3b82c4";
const PAPER_ORANGE = "#e08a3c";
const INK = "#e8e6dd";
const MUTED = "#8a8a93";
const AMBER = "#d9a766";
const TEAL = "#6ec5c0";

export function mountPseudocoda(ctx) {
  const elRhythm = document.getElementById("ps-rhythm");
  const elTempo = document.getElementById("ps-tempo");
  const elRubato = document.getElementById("ps-rubato");
  const elRubatoVal = document.getElementById("ps-rubato-val");
  const elOrnament = document.getElementById("ps-ornament");
  const elRepeats = document.getElementById("ps-repeats");
  const elRepeatsVal = document.getElementById("ps-repeats-val");
  const elPlay = document.getElementById("ps-play");
  const canvas = document.getElementById("pseudocoda-canvas");
  const tooltip = document.getElementById("ps-tooltip");

  // Populate rhythm dropdown — sort by descending count so the largest clusters
  // (the legible ones) sit at the top, but keep the id in the label.
  const rhythms = ctx.clusters.rhythms;
  const tempos = ctx.clusters.tempos;
  const rhythmsSorted = rhythms.slice().sort((a, b) => b.count - a.count);
  for (const r of rhythmsSorted) {
    const opt = document.createElement("option");
    opt.value = String(r.id);
    opt.textContent = `R${r.id.toString().padStart(2, "0")} · ${r.centroid.length} clicks · n=${r.count}`;
    elRhythm.appendChild(opt);
  }
  // Default to R2 (the largest cluster, 5 clicks — a familiar 5-regular)
  elRhythm.value = "2";

  for (const t of tempos) {
    const opt = document.createElement("option");
    opt.value = String(t.id);
    opt.textContent = `T${t.id} · ${t.mean_duration.toFixed(2)} s · n=${t.count}`;
    elTempo.appendChild(opt);
  }
  elTempo.value = "2";

  function fmtSec(v) {
    const s = v >= 0 ? "+" : "−";
    return `${s}${Math.abs(v).toFixed(2)} s`;
  }

  // Synthesise the full set of repeated codas as a flat list of staircases.
  function synthesise() {
    const rid = parseInt(elRhythm.value, 10);
    const tid = parseInt(elTempo.value, 10);
    const rubato = parseFloat(elRubato.value);
    const orn = elOrnament.checked;
    const repeats = parseInt(elRepeats.value, 10);

    const rhythm = rhythms[rid];
    const tempo = tempos[tid];
    const centroid = rhythm.centroid;
    if (!tempo || tempo.mean_duration <= 0) return { codas: [], rid, tid, rubato, orn };

    // Centroid is normalised cumulative ICI: starts at 0, ends at 1.
    // Convert to ICI sequence in seconds at the base tempo, then for each repeat
    // scale tempo by (1 + k * rubato / base) to drift smoothly.
    const baseDur = tempo.mean_duration;
    const baseICIs = [];
    for (let i = 1; i < centroid.length; i++) {
      baseICIs.push((centroid[i] - centroid[i - 1]) * baseDur);
    }

    const codas = [];
    for (let k = 0; k < repeats; k++) {
      // Tempo scale: cumulative drift in seconds. Centre on k=0.
      const driftFactor = 1 + (k * rubato) / Math.max(0.05, baseDur);
      const scale = Math.max(0.1, driftFactor);
      const icis = baseICIs.map(v => v * scale);
      if (orn) icis.push(icis[icis.length - 1] || 0.1);
      codas.push({ icis, duration: icis.reduce((s, x) => s + x, 0) });
    }
    return { codas, rid, tid, rubato, orn };
  }

  // Hit-test layout for tooltip
  let layout = [];

  function render() {
    elRubatoVal.textContent = fmtSec(parseFloat(elRubato.value));
    elRepeatsVal.textContent = elRepeats.value;

    const { codas, rid, tid } = synthesise();

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = 420;
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    const padL = 72, padR = 28, padT = 36, padB = 38;
    const innerW = cssW - padL - padR;
    const innerH = cssH - padT - padB;

    const maxClicks = Math.max(...codas.map(c => c.icis.length + 1), 4);
    // Total time spans the concatenated repeats; layout each in its own column? No —
    // the staircases all start at click=1 and step down. Stack vertically by repeat
    // so the rubato drift is visible as a fan of slopes from a common top-left.
    const maxDuration = Math.max(...codas.map(c => c.duration), 0.5);
    // Add a small vertical gap between repeats (visual breathing room)
    const gapY = 0.15 * maxDuration;
    const totalY = codas.length * maxDuration + (codas.length - 1) * gapY;

    const xOfClick = i => padL + (i / (maxClicks + 0.5)) * innerW;
    const yOf = t => padT + (t / Math.max(0.01, totalY)) * innerH;

    // Grid: time ticks per repeat
    g.strokeStyle = "#1c1c24";
    g.lineWidth = 1;
    g.fillStyle = MUTED;
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (let k = 0; k < codas.length; k++) {
      const y0 = k * (maxDuration + gapY);
      const y1 = y0 + codas[k].duration;
      const yy = yOf(y0);
      g.beginPath(); g.moveTo(padL, yy); g.lineTo(cssW - padR, yy); g.stroke();
      g.fillText(`#${k + 1}`, padL - 10, yy + 6);
      g.fillText(`${codas[k].duration.toFixed(2)}s`, padL - 10, yOf(y1) - 6);
    }
    // click index header
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = MUTED;
    for (let i = 1; i <= maxClicks; i++) {
      g.fillText(String(i), xOfClick(i), padT - 8);
    }

    // Axis labels
    g.save();
    g.translate(18, padT + innerH / 2);
    g.rotate(-Math.PI / 2);
    g.fillStyle = INK;
    g.font = "11px Source Serif, Source Serif Pro, Georgia, serif";
    g.textAlign = "center";
    g.fillText("repeat #  ·  time within coda  →", 0, 0);
    g.restore();
    g.fillStyle = INK;
    g.textAlign = "center";
    g.fillText("click index within coda  →", padL + innerW / 2, cssH - 10);

    // Title (top-right)
    g.textAlign = "right";
    g.fillStyle = AMBER;
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.fillText(`R${rid}  ·  T${tid}  ·  ${rhythms[rid].centroid.length} clicks  ·  base ${tempos[tid].mean_duration.toFixed(2)}s`,
               cssW - padR, padT - 18);

    layout = [];
    for (let k = 0; k < codas.length; k++) {
      const coda = codas[k];
      const t0 = k * (maxDuration + gapY);
      const colour = k % 2 === 0 ? PAPER_BLUE : PAPER_ORANGE;

      const xs = [], ys = [];
      let cum = 0;
      xs.push(xOfClick(1));
      ys.push(yOf(t0));
      for (let i = 0; i < coda.icis.length; i++) {
        cum += coda.icis[i];
        xs.push(xOfClick(i + 2));
        ys.push(yOf(t0 + cum));
      }

      g.strokeStyle = colour;
      g.globalAlpha = 0.92;
      g.lineWidth = 1.1;
      g.beginPath();
      for (let i = 0; i < xs.length; i++) {
        if (i === 0) g.moveTo(xs[i], ys[i]); else g.lineTo(xs[i], ys[i]);
      }
      g.stroke();
      g.fillStyle = colour;
      for (let i = 0; i < xs.length; i++) {
        g.beginPath(); g.arc(xs[i], ys[i], 2.6, 0, Math.PI * 2); g.fill();
        const ici_prev = i === 0 ? null : coda.icis[i - 1];
        layout.push({ x: xs[i], y: ys[i], k, click: i + 1, ici_prev });
      }
      // Ornament marker on last click
      if (elOrnament.checked) {
        g.strokeStyle = AMBER;
        g.lineWidth = 1.2;
        g.beginPath(); g.arc(xs[xs.length - 1], ys[ys.length - 1], 5.5, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  // ---- Audio ----------------------------------------------------------------
  // Web Audio API: a short exponentially-decaying sine burst per click,
  // played at cumulative ICI timestamps across the sequence of repeats.

  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = AC ? new AC() : null;
    }
    return audioCtx;
  }

  function playClickTrain() {
    const ac = getAudio();
    if (!ac) {
      console.warn("[v2-pseudocoda] Web Audio API unavailable");
      return;
    }
    if (ac.state === "suspended") ac.resume();

    const { codas } = synthesise();
    const now = ac.currentTime + 0.08;
    let cursor = 0;
    const gapBetween = 0.20;  // seconds of silence between repeats
    for (const coda of codas) {
      // First click at t=cursor
      scheduleClick(ac, now + cursor);
      let local = 0;
      for (let i = 0; i < coda.icis.length; i++) {
        local += coda.icis[i];
        scheduleClick(ac, now + cursor + local);
      }
      cursor += coda.duration + gapBetween;
    }
  }

  function scheduleClick(ac, when) {
    // 1ms exponentially-decaying sine burst at 5 kHz, modest amplitude.
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(5000, when);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.22, when + 0.0005);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.012);
    osc.connect(env).connect(ac.destination);
    osc.start(when);
    osc.stop(when + 0.015);
  }

  // ---- Tooltip --------------------------------------------------------------
  canvas.addEventListener("mousemove", ev => {
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
      tooltip.textContent =
        `repeat #${best.k + 1}   click ${best.click}\n` +
        (best.ici_prev !== null ? `ICI →  ${(best.ici_prev * 1000).toFixed(0)} ms` : `ICI →  —`);
    } else {
      tooltip.style.opacity = "0";
    }
  });
  canvas.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });

  elRhythm.addEventListener("change", render);
  elTempo.addEventListener("change", render);
  elRubato.addEventListener("input", render);
  elOrnament.addEventListener("change", render);
  elRepeats.addEventListener("input", render);
  elPlay.addEventListener("click", playClickTrain);
  window.addEventListener("resize", () => requestAnimationFrame(render));

  render();
}
