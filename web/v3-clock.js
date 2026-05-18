// v3 — Shared PlaybackClock singleton.
//
// A single RAF-driven cursor in [0, 1] that walks the deployment timeline
// (2005-01 .. 2017-12 = 156 months for the LTSA, but the cursor is unit-normalised
// so any consumer can map it to its own time axis). Sections subscribe and the
// clock notifies them every frame while playing.
//
// State machine:
//   playing   bool    — is the clock advancing?
//   speed     number  — multiplier (0.5, 1, 2, 4); 1x = full sweep in BASE_DURATION_S
//   cursor    number  — current position in [0, 1]
//
// Pause stops all renders. Hidden tab unsubscribes (handled by app.js on tab
// switch) so a backgrounded v3 doesn't burn cycles.
//
// Reuses the existing colour/typography conventions from styles.css.

const BASE_DURATION_S = 60;  // one full sweep at 1x speed = 60s of wall time.

class PlaybackClock {
  constructor() {
    this.playing = false;
    this.speed = 1;
    this.cursor = 0;
    this._subs = new Set();
    this._raf = null;
    this._lastT = 0;
  }

  subscribe(fn) {
    this._subs.add(fn);
    // Push current state once so the new subscriber renders immediately.
    try { fn({ cursor: this.cursor, playing: this.playing, speed: this.speed }); } catch (e) { console.error(e); }
    return () => this._subs.delete(fn);
  }

  unsubscribe(fn) {
    this._subs.delete(fn);
  }

  _notify() {
    const state = { cursor: this.cursor, playing: this.playing, speed: this.speed };
    for (const fn of this._subs) {
      try { fn(state); } catch (e) { console.error("[v3-clock] subscriber threw:", e); }
    }
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this._lastT = performance.now();
    this._tick();
    this._notify();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._notify();
  }

  toggle() {
    if (this.playing) this.pause(); else this.play();
  }

  setSpeed(x) {
    const allowed = [0.5, 1, 2, 4];
    if (!allowed.includes(x)) return;
    this.speed = x;
    this._notify();
  }

  setCursor(t) {
    this.cursor = Math.max(0, Math.min(1, t));
    this._notify();
  }

  _tick() {
    if (!this.playing) return;
    const now = performance.now();
    const dt = (now - this._lastT) / 1000;
    this._lastT = now;
    this.cursor += (this.speed * dt) / BASE_DURATION_S;
    if (this.cursor >= 1) this.cursor = 0;  // loop
    this._notify();
    this._raf = requestAnimationFrame(() => this._tick());
  }
}

export const clock = new PlaybackClock();
export const TIMELINE = {
  // Deployment-wide year range, hardcoded to match corpus_timeline.json's bounds.
  // (Set by app.js once the bundle is loaded.)
  year_start: 2005,
  year_end: 2017,
  n_months: 156,
};

/**
 * Map cursor [0,1] to a month-index in [0, n_months).
 */
export function cursorToMonthIndex(cursor) {
  const idx = Math.floor(cursor * TIMELINE.n_months);
  return Math.max(0, Math.min(TIMELINE.n_months - 1, idx));
}

/**
 * Format cursor as YYYY-MM string.
 */
export function cursorToYearMonth(cursor) {
  const idx = cursorToMonthIndex(cursor);
  const year = TIMELINE.year_start + Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}
