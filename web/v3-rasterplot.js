// v3 — Section 1 — Click-train rasterplot, live playhead.
//
// One coda = one horizontal lane. Each click within the coda is a vertical tick
// on that lane, positioned at its cumulative ICI offset (in seconds) along the
// exchange's wall-clock x-axis. A vertical playhead, driven by the shared
// PlaybackClock, sweeps left-to-right across the exchange duration. When the
// playhead crosses a tick, the tick brightens for ~300 ms then fades.
//
// Optional Web Audio click train: opt-in via a button (browser autoplay policy).
// Off by default. Re-uses the 5 kHz exp-decay recipe from v2-pseudocoda.

import { clock, cursorToYearMonth } from "./v3-clock.js";

const PAPER_BLUE = "#3b82c4";
const PAPER_ORANGE = "#e08a3c";
const INK = "#e8e6dd";
const MUTED = "#8a8a93";
const AMBER = "#d9a766";
const TEAL = "#6ec5c0";
const BRIGHT_DECAY_MS = 300;

export function mountRasterplot(ctx) {
  const select = document.getElementById("rp-select");
  const audioBtn = document.getElementById("rp-audio");
  const summary = document.getElementById("rp-summary");
  const canvas = document.getElementById("rasterplot-canvas");
  const tooltip = document.getElementById("rp-tooltip");

  if (!select || !canvas) {
    console.warn("[v3-rasterplot] mount targets missing");
    return null;
  }

  // Populate exchange selector — biggest first, mirroring v1 exchange-plot.
  for (const ex of ctx.exchanges) {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = `${ex.id}  —  ${ex.n_codas} codas, ${ex.n_speakers} speakers`;
    select.appendChild(opt);
  }
  const defaultEx =
    ctx.exchanges.find(e => e.n_speakers === 2 && e.n_codas >= 20 && e.n_codas <= 40
                            && e.duration_total >= 60 && e.duration_total <= 300)
    ?? ctx.exchanges.find(e => e.n_speakers === 2)
    ?? ctx.exchanges[0];
  select.value = defaultEx.id;

  // Layout cache: built when exchange changes; consumed by every render frame.
  let cache = null;

  function rebuildCache() {
    const exId = select.value;
    const exch = ctx.exchanges.find(e => e.id === exId);
    if (!exch) return;
    const codas = exch.coda_ids
      .map(id => ctx.codaById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.t_start - b.t_start);
    const speakers = exch.speakers;
    const t0 = exch.t_start;
    const tEnd = exch.t_end;
    const span = Math.max(0.1, tEnd - t0);

    // For each coda, list of (tick_time, speaker) — tick_time relative to t0.
    const ticks = [];
    let ornCount = 0;
    for (let i = 0; i < codas.length; i++) {
      const c = codas[i];
      const tStart = c.t_start - t0;
      const colour = speakers.indexOf(c.speaker) === 0 ? PAPER_BLUE : PAPER_ORANGE;
      // Build click times = cumulative ICI offsets, including initial click at 0.
      const clickTimes = [0];
      let cum = 0;
      for (const ici of c.ici_seq) {
        cum += ici;
        clickTimes.push(cum);
      }
      const laneTicks = clickTimes.map(t => tStart + t);
      ticks.push({ lane: i, speaker: c.speaker, colour, times: laneTicks, ornament: !!c.has_ornament });
      if (c.has_ornament) ornCount += 1;
    }

    cache = {
      exId,
      span,
      n_codas: codas.length,
      speakers,
      ticks,
      ornCount,
    };
    summary.textContent =
      `${codas.length} codas · ${span.toFixed(1)}s span · ornament rate ${(ornCount / codas.length * 100).toFixed(1)}%`;
  }

  // Per-tick brightness state — keyed by `${lane}-${idx}`.
  // Stored as the wall-clock ms when it was last lit; render computes alpha from age.
  const lit = new Map();
  let lastCursor = -1;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = Math.max(280, Math.min(560, 22 * (cache?.n_codas || 16) + 80));
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    return { cssW, cssH, dpr };
  }

  function render(state) {
    if (!cache) return;
    const { cssW, cssH, dpr } = resizeCanvas();
    if (cssW < 80) return;  // canvas not yet laid out (hidden tab)
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    const padL = 80, padR = 24, padT = 28, padB = 40;
    const innerW = cssW - padL - padR;
    const innerH = cssH - padT - padB;
    const nLanes = cache.n_codas;
    const laneH = innerH / Math.max(1, nLanes);

    // Background lane stripes
    g.fillStyle = "#10101580";
    for (let i = 0; i < nLanes; i += 2) {
      const y = padT + i * laneH;
      g.fillRect(padL, y, innerW, laneH);
    }

    // Axis ticks (seconds along x)
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.fillStyle = MUTED;
    g.textAlign = "center";
    g.textBaseline = "top";
    const tStep = niceStep(cache.span / 6);
    for (let t = 0; t <= cache.span + 1e-3; t += tStep) {
      const x = padL + (t / cache.span) * innerW;
      g.strokeStyle = "#1a1a22";
      g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + innerH); g.stroke();
      g.fillStyle = MUTED;
      g.fillText(`${t.toFixed(tStep < 1 ? 1 : 0)}s`, x, padT + innerH + 6);
    }
    // Y axis labels — coda lane numbers
    g.textAlign = "right";
    g.textBaseline = "middle";
    g.fillStyle = MUTED;
    for (let i = 0; i < nLanes; i++) {
      if (nLanes <= 24 || i % Math.ceil(nLanes / 24) === 0) {
        g.fillText(`#${i + 1}`, padL - 8, padT + i * laneH + laneH / 2);
      }
    }

    // Cursor position in seconds within exchange
    const cursorT = state.cursor * cache.span;
    const cursorX = padL + state.cursor * innerW;

    // For every tick: detect crossing; render with decayed alpha.
    const now = performance.now();
    for (const lane of cache.ticks) {
      const yMid = padT + lane.lane * laneH + laneH / 2;
      const colour = lane.colour;
      for (let i = 0; i < lane.times.length; i++) {
        const t = lane.times[i];
        const x = padL + (t / cache.span) * innerW;
        const key = `${lane.lane}-${i}`;

        // Detect crossing: in the interval (lastCursor, cursorT], or while playing the cursor was within a small window of the tick.
        // Simpler: any tick within +/- (one frame of cursor advance / 2) is "just crossed".
        const crossed = lastCursor >= 0
          ? (lastCursor <= t && t <= cursorT) || (cursorT <= t && t <= lastCursor)
          : false;
        if (crossed) lit.set(key, now);

        let alpha;
        if (lit.has(key)) {
          const age = now - lit.get(key);
          if (age > BRIGHT_DECAY_MS) {
            lit.delete(key);
            alpha = 0.32;
          } else {
            const k = 1 - age / BRIGHT_DECAY_MS;
            alpha = 0.32 + 0.68 * k;
          }
        } else {
          // Past-cursor ticks at base alpha; ahead-of-cursor ticks dim further.
          alpha = t <= cursorT ? 0.32 : 0.18;
        }

        g.globalAlpha = alpha;
        g.strokeStyle = colour;
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(x, yMid - laneH * 0.42);
        g.lineTo(x, yMid + laneH * 0.42);
        g.stroke();

        // Ornament marker on terminal click of an ornamented coda
        if (lane.ornament && i === lane.times.length - 1) {
          g.globalAlpha = Math.max(0.4, alpha);
          g.strokeStyle = AMBER;
          g.lineWidth = 1;
          g.beginPath();
          g.arc(x, yMid, Math.max(2.5, laneH * 0.28), 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
    lastCursor = cursorT;

    // Playhead — teal vertical line + readout
    g.strokeStyle = TEAL;
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cursorX, padT - 4); g.lineTo(cursorX, padT + innerH + 4); g.stroke();
    g.fillStyle = TEAL;
    g.textAlign = "left";
    g.textBaseline = "bottom";
    g.font = "10px ui-monospace, SF Mono, monospace";
    g.fillText(`t=${cursorT.toFixed(1)}s`, cursorX + 4, padT - 4);

    // Axis labels
    g.fillStyle = INK;
    g.font = "11px Source Serif, Source Serif Pro, Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText("time within exchange  →", padL + innerW / 2, cssH - 6);
  }

  // ---- Web Audio click train (opt-in) ---------------------------------------

  let audioCtx = null;
  let audioOn = false;
  let scheduledTicks = [];  // { absTime, key } so we don't double-schedule

  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = AC ? new AC() : null;
    }
    return audioCtx;
  }

  function scheduleClick(when) {
    const ac = audioCtx;
    if (!ac) return;
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(5000, when);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.16, when + 0.0005);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.012);
    osc.connect(env).connect(ac.destination);
    osc.start(when);
    osc.stop(when + 0.015);
  }

  function audioTick(state) {
    if (!audioOn || !cache) return;
    const ac = audioCtx;
    if (!ac) return;
    // Schedule any tick that the cursor will cross within the next 200 ms.
    const lookahead = 0.2; // seconds
    const cursorT = state.cursor * cache.span;
    const cursorAhead = cursorT + state.speed * lookahead;
    for (const lane of cache.ticks) {
      for (let i = 0; i < lane.times.length; i++) {
        const t = lane.times[i];
        if (t < cursorT || t > cursorAhead) continue;
        const key = `${lane.lane}-${i}`;
        if (scheduledTicks.find(s => s.key === key && (s.absTime - ac.currentTime) > 0)) continue;
        const dt = (t - cursorT) / state.speed;
        const when = ac.currentTime + Math.max(0, dt);
        scheduleClick(when);
        scheduledTicks.push({ absTime: when, key });
      }
    }
    // Trim old scheduled entries
    if (scheduledTicks.length > 500) {
      scheduledTicks = scheduledTicks.filter(s => s.absTime > ac.currentTime - 0.5);
    }
  }

  function toggleAudio() {
    audioOn = !audioOn;
    audioBtn.classList.toggle("is-on", audioOn);
    audioBtn.textContent = audioOn ? "♪ audio on" : "♪ audio off";
    if (audioOn) {
      const ac = getAudio();
      if (!ac) {
        console.warn("[v3-rasterplot] Web Audio API unavailable");
        audioOn = false;
        audioBtn.classList.remove("is-on");
        audioBtn.textContent = "♪ audio off";
        return;
      }
      if (ac.state === "suspended") ac.resume();
    } else {
      scheduledTicks = [];
    }
  }

  // ---- Wiring ---------------------------------------------------------------

  rebuildCache();

  select.addEventListener("change", () => {
    rebuildCache();
    lit.clear();
    lastCursor = -1;
    scheduledTicks = [];
    render({ cursor: clock.cursor, playing: clock.playing, speed: clock.speed });
  });
  audioBtn.addEventListener("click", toggleAudio);
  window.addEventListener("resize", () => render({ cursor: clock.cursor, playing: clock.playing, speed: clock.speed }));

  let unsub = null;
  function attach() {
    if (unsub) return;
    unsub = clock.subscribe(state => {
      render(state);
      audioTick(state);
    });
  }
  function detach() {
    if (unsub) { unsub(); unsub = null; }
    scheduledTicks = [];
  }

  return { attach, detach, render: () => render({ cursor: clock.cursor, playing: clock.playing, speed: clock.speed }) };
}

function niceStep(raw) {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const m = raw / base;
  let nice;
  if (m < 1.5) nice = 1;
  else if (m < 3) nice = 2;
  else if (m < 7) nice = 5;
  else nice = 10;
  return nice * base;
}
