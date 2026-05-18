// v4 — Shared underwater-telemetry simulation.
//
// Single source of truth for every v4 module: gauges, sonar, altimeter. The sim
// subscribes to the v3 PlaybackClock so pause/play/speed propagate through the
// whole tab. The sim itself is a small phase accumulator driven by wall-clock
// dt (multiplied by clock.speed when playing), so values look like real
// telemetry — slow drift on depth/temp, oscillating attitude, a heading that
// turns at roughly the rate an ROV operator would expect.
//
// What this sim is NOT: it is not a hydrodynamic model. There is no fluid, no
// vehicle, no real seabed. The numbers are crafted to *look like* the source
// software's idle state with light operator pose changes. Reconstruction, not
// physics.
//
// Bearing convention: 0° = north (screen-top in the sonar), clockwise. Pitch
// +90° = nose up; roll +90° = right wing down (aircraft convention, inherited
// by ROV pilots).

import { clock } from "./v3-clock.js";

const TWO_PI = Math.PI * 2;
const DEG = 180 / Math.PI;

// Sim tuning ----------------------------------------------------------------

const HEADING_DEG_PER_SEC = 1.0;           // 1°/s = full turn in 6 min
const PITCH_AMP = 5, PITCH_PERIOD_S = 20;  // gentle ±5° sway
const ROLL_AMP = 10, ROLL_PERIOD_S = 30;   // ±10° sway, slower

const DEPTH_BASE = 11.4, DEPTH_AMP = 0.2, DEPTH_PERIOD_S = 28; // m
const DEPTH_NOISE_AMP = 0.01;

const TEMP_BASE = 16.25, TEMP_AMP = 0.18, TEMP_PERIOD_S = 180; // °C, very slow drift

// Altimeter geometry --------------------------------------------------------
// Synthetic seabed-distance profile under the vehicle. The vehicle is treated
// as stationary in (x, y) but the seabed isn't flat — picture an ROV hovering
// near a sloping wall with a pipe lying nearby. We parameterise distance as
// a slow random-walk shaped by the heading: as the vehicle yaws, the patch
// of seabed under it changes, so distance changes too. ~1.0-2.5 m range.

const DIST_BASE = 1.5;
const ECHOGRAM_RING = 256;   // columns held for the strip chart
const ECHOGRAM_BINS = 64;    // distance bins per column

// Sonar geometry ------------------------------------------------------------

const SONAR_ANG = 360;
const SONAR_R   = 200;
const SONAR_MAX_RANGE_M = 2.0;
const SONAR_DEADZONE_M = 0.3;
const SONAR_RPM = 15;        // 4 s/rev at 1×
export const SONAR = {
  N_ANG: SONAR_ANG,
  N_R: SONAR_R,
  MAX_RANGE: SONAR_MAX_RANGE_M,
  DEADZONE: SONAR_DEADZONE_M,
};

// World-fixed targets (positions are in metres, polar from the vehicle origin
// before yaw is applied — they re-project per frame as heading rotates).
const WORLD_TARGETS = [
  // Pipe target — a short line segment at ~1.5 m bearing 0° (true north).
  { type: "line", x1: -0.18, y1: 1.4, x2: 0.18, y2: 1.6, amp: 0.95 },
  // Pool wall — a wide arc at ~r=1.9 across bearings 110..210 (true).
  { type: "arc", r: 1.9, a0: 110, a1: 250, thick: 0.05, amp: 0.85 },
  // A small secondary scatterer at bearing 70° / 1.2 m.
  { type: "blob", x: Math.sin(70 / DEG) * 1.2, y: Math.cos(70 / DEG) * 1.2, sigma: 0.12, amp: 0.7 },
];

// ---------------------------------------------------------------------------

class TelemetrySim {
  constructor() {
    this.t = 0;                  // sim seconds elapsed (advances only while playing)
    this.depth = DEPTH_BASE;
    this.temperature = TEMP_BASE;
    this.heading = 118.8;        // start near the screenshot pose
    this.pitch = -1.5;
    this.roll = 9.2;
    this.turns = 1.1;
    this.distance = 1.495;       // initial altimeter reading
    this.echogram = new Float32Array(ECHOGRAM_RING * ECHOGRAM_BINS);
    this.echogramHead = 0;       // next column index to write
    this.echogramFilled = 0;     // how many cols are valid (caps at RING)
    this.sonar = new Float32Array(SONAR_ANG * SONAR_R);
    this.sonarSweepRad = 0;      // current sweep angle (radians, 0=north)
    this.sonarLastSweep = 0;     // last sweep angle (for slice fill)

    this._subs = new Set();
    this._raf = null;
    this._lastT = performance.now() / 1000;

    // Subscribe to the v3 clock so play/pause/speed propagate.
    clock.subscribe(state => {
      // The clock fires on every cursor change too — but our sim runs on its own
      // RAF since it's not directly driven by clock.cursor. We just listen to
      // playing/speed.
      this._playing = state.playing;
      this._speed = state.speed;
    });
    this._playing = clock.playing;
    this._speed = clock.speed;

    // Always-on RAF — even when paused, downstream consumers expect a render
    // tick to keep the canvas pixel buffer in sync after a resize. The sim
    // values themselves only advance when playing.
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  subscribe(fn) {
    this._subs.add(fn);
    try { fn(this._snapshot()); } catch (e) { console.error(e); }
    return () => this._subs.delete(fn);
  }

  _snapshot() {
    return this;  // consumers read fields directly; cheaper than a copy
  }

  _notify() {
    const snap = this._snapshot();
    for (const fn of this._subs) {
      try { fn(snap); } catch (e) { console.error("[v4-sim] subscriber threw:", e); }
    }
  }

  _tick() {
    const now = performance.now() / 1000;
    const wall_dt = Math.min(0.1, now - this._lastT);  // clamp huge frames
    this._lastT = now;
    const dt = this._playing ? wall_dt * this._speed : 0;
    if (dt > 0) {
      this.t += dt;
      this._advance(dt);
    }
    this._notify();
    this._raf = requestAnimationFrame(this._tick);
  }

  _advance(dt) {
    const t = this.t;

    // Depth — slow sinusoid + small noise.
    const depthDrift = DEPTH_AMP * Math.sin((TWO_PI * t) / DEPTH_PERIOD_S);
    const depthNoise = (Math.random() - 0.5) * 2 * DEPTH_NOISE_AMP;
    this.depth = DEPTH_BASE + depthDrift + depthNoise;

    // Temperature — very slow sinusoid.
    this.temperature = TEMP_BASE + TEMP_AMP * Math.sin((TWO_PI * t) / TEMP_PERIOD_S);

    // Heading — constant slow yaw. Wrap to [0, 360).
    const prevHeading = this.heading;
    this.heading = (this.heading + HEADING_DEG_PER_SEC * dt) % 360;
    // Cumulative turns counter — accumulate signed full-revolution count.
    const headingDelta = ((this.heading - prevHeading + 540) % 360) - 180;  // signed shortest delta
    this.turns += headingDelta / 360;

    // Pitch / Roll oscillate.
    this.pitch = PITCH_AMP * Math.sin((TWO_PI * t) / PITCH_PERIOD_S);
    this.roll = ROLL_AMP * Math.sin((TWO_PI * t) / ROLL_PERIOD_S + 0.7);

    // Altimeter — distance modulated by heading; gentle wobble adds life.
    // A simple "seabed under heading" model: project a saw of bumps onto the
    // bearing the vehicle is currently pointing, then read off the height.
    const h = this.heading;
    const base = DIST_BASE + 0.4 * Math.sin(h / DEG) + 0.3 * Math.cos((h * 2.7) / DEG);
    const wobble = 0.05 * Math.sin((TWO_PI * t) / 3.1);
    this.distance = Math.max(0.2, Math.min(2.8, base + wobble));

    // Echogram — append a column. The column is an intensity profile over
    // distance bins; the peak sits at the current `distance`, with a soft
    // skirt and some return amplitude on either side. Background noise
    // sprinkled below.
    this._appendEchogramColumn();

    // Sonar — advance the sweep, and re-fill the slice that the sweep has
    // just passed over with fresh return amplitudes.
    this._advanceSonar(dt);
  }

  _appendEchogramColumn() {
    const col = this.echogramHead;
    const peakBin = Math.floor((this.distance / 3.0) * ECHOGRAM_BINS);
    for (let b = 0; b < ECHOGRAM_BINS; b++) {
      const r = (b / ECHOGRAM_BINS) * 3.0;  // metres
      // Gaussian skirt around the peak.
      const d = (b - peakBin) / 3.0;
      const peak = Math.exp(-d * d * 4) * 0.95;
      // Light background noise floor.
      const noise = Math.random() * 0.06;
      // Slight surface return at very-near range (0..0.15 m).
      const near = r < 0.15 ? 0.25 + Math.random() * 0.05 : 0;
      this.echogram[col * ECHOGRAM_BINS + b] = Math.min(1, peak + noise + near);
    }
    this.echogramHead = (this.echogramHead + 1) % ECHOGRAM_RING;
    this.echogramFilled = Math.min(ECHOGRAM_RING, this.echogramFilled + 1);
  }

  _advanceSonar(dt) {
    // Sonar sweep advances at SONAR_RPM × speed (speed is already baked into
    // dt here, since _advance is called with dt = wall_dt × speed).
    const rad_per_sec = (SONAR_RPM / 60) * TWO_PI;
    const prev = this.sonarSweepRad;
    let next = prev + rad_per_sec * dt;
    // Normalize next to [0, TWO_PI) for the slice loop below.
    next = ((next % TWO_PI) + TWO_PI) % TWO_PI;
    this.sonarLastSweep = prev;
    this.sonarSweepRad = next;

    // Sample fresh returns for every angle index the sweep has crossed since
    // last frame. Handle wrap.
    const prev_norm = ((prev % TWO_PI) + TWO_PI) % TWO_PI;
    const from = Math.floor((prev_norm / TWO_PI) * SONAR_ANG);
    const to = Math.floor((next / TWO_PI) * SONAR_ANG);
    if (to === from) {
      this._fillSonarAngle(from);
    } else if (to > from) {
      for (let a = from; a <= to; a++) this._fillSonarAngle(a % SONAR_ANG);
    } else {
      for (let a = from; a < SONAR_ANG; a++) this._fillSonarAngle(a);
      for (let a = 0; a <= to; a++) this._fillSonarAngle(a);
    }
  }

  _fillSonarAngle(a) {
    // a is the sonar bin index (0..SONAR_ANG-1). The sonar's local bearing for
    // bin a is bearing_local = a / SONAR_ANG × 360, measured clockwise from
    // the sonar's "up" axis. In the world, that bearing rotates with the
    // vehicle heading. So:
    //   true_bearing = (heading + bearing_local) mod 360
    const bearing_local_deg = (a / SONAR_ANG) * 360;
    const true_bearing_deg = (this.heading + bearing_local_deg) % 360;
    const ang_rad = true_bearing_deg / DEG;
    const cosA = Math.sin(ang_rad);   // x = r * sin(bearing_from_north)
    const sinA = Math.cos(ang_rad);   // y = r * cos(bearing_from_north)

    for (let ri = 0; ri < SONAR_R; ri++) {
      const r = (ri / SONAR_R) * SONAR_MAX_RANGE_M;
      let amp = 0;
      if (r < SONAR_DEADZONE_M) {
        amp = 0;
      } else {
        // Background speckle.
        amp = Math.random() * 0.12;
        const wx = r * cosA;
        const wy = r * sinA;
        // Iterate world targets.
        for (const tgt of WORLD_TARGETS) {
          let contrib = 0;
          if (tgt.type === "arc") {
            const tr = Math.hypot(wx, wy);
            let tb = (Math.atan2(wx, wy) * DEG + 360) % 360;
            const da = Math.abs(tr - tgt.r);
            // Wrap-aware bearing window
            let inWin = false;
            if (tgt.a0 <= tgt.a1) inWin = tb >= tgt.a0 && tb <= tgt.a1;
            else inWin = tb >= tgt.a0 || tb <= tgt.a1;
            if (inWin && da < tgt.thick * 3) {
              contrib = tgt.amp * Math.exp(-(da * da) / (tgt.thick * tgt.thick));
            }
          } else if (tgt.type === "line") {
            // Distance from point (wx,wy) to segment.
            const dx = tgt.x2 - tgt.x1, dy = tgt.y2 - tgt.y1;
            const len2 = dx * dx + dy * dy;
            const tParam = Math.max(0, Math.min(1, ((wx - tgt.x1) * dx + (wy - tgt.y1) * dy) / len2));
            const px = tgt.x1 + tParam * dx;
            const py = tgt.y1 + tParam * dy;
            const d = Math.hypot(wx - px, wy - py);
            const sigma = 0.04;
            contrib = tgt.amp * Math.exp(-(d * d) / (sigma * sigma));
          } else if (tgt.type === "blob") {
            const d = Math.hypot(wx - tgt.x, wy - tgt.y);
            contrib = tgt.amp * Math.exp(-(d * d) / (tgt.sigma * tgt.sigma));
          }
          if (contrib > amp) amp = contrib;
        }
        // Bright leading-edge boost: amp scales near the current sweep angle
        // — fresher pings read brighter. Compute angular delta of this bin
        // from the current local sweep angle.
        const sweep_local_deg = ((this.sonarSweepRad * DEG) - this.heading + 720) % 360;
        // Note: sweep angle is stored in world frame; convert back to local.
        let delta = Math.abs(bearing_local_deg - sweep_local_deg);
        if (delta > 180) delta = 360 - delta;
        if (delta < 8) amp = Math.min(1, amp + 0.2);
      }
      this.sonar[a * SONAR_R + ri] = Math.min(1, amp);
    }
  }

  // ---- Read accessors -----------------------------------------------------

  pressureBar() {
    // Sea water: 1 m depth ≈ 0.1003 bar gauge. The screenshot shows 11.406 m →
    // 1.151 bar, which gives a sensible 0.101 bar/m calibration including
    // atmospheric offset of 0.005 bar (sensor reads gauge above local atm).
    return 0.005 + this.depth * 0.1005;
  }

  // Read echogram column at logical "ago" index where 0 = oldest visible,
  // ECHOGRAM_RING-1 = most recent. Returns a Float32Array view of length
  // ECHOGRAM_BINS.
  echogramColumn(ago) {
    const idx = (this.echogramHead - 1 - (this.echogramFilled - 1 - ago) + ECHOGRAM_RING * 2) % ECHOGRAM_RING;
    const out = new Float32Array(ECHOGRAM_BINS);
    for (let b = 0; b < ECHOGRAM_BINS; b++) {
      out[b] = this.echogram[idx * ECHOGRAM_BINS + b];
    }
    return out;
  }

  echogramSize() {
    return { width: ECHOGRAM_RING, height: ECHOGRAM_BINS, filled: this.echogramFilled, head: this.echogramHead };
  }
}

export const sim = new TelemetrySim();
export const SIM_CONST = {
  SONAR_MAX_RANGE: SONAR_MAX_RANGE_M,
  SONAR_DEADZONE: SONAR_DEADZONE_M,
  ECHOGRAM_RING,
  ECHOGRAM_BINS,
  ECHOGRAM_MAX_M: 3.0,
};
