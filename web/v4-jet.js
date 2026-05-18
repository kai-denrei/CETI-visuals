// v4 — Baked jet colourmap LUT.
//
// EXPLICIT AESTHETIC OVERRIDE for v4 only. The rest of CETI-visuals uses
// perceptually uniform OKLCH-baked ramps (HYDROACOUSTICS.md). v4's brief is to
// reconstruct the look-and-feel of Impact Subsea's seaView operator software,
// which uses the classic MATLAB-style jet colourmap on its sonar and echogram.
// We bake that here, in sRGB hex / RGB tuples, used by v4-sonar.js and
// v4-altimeter.js only. Do not import from anywhere else.
//
// The standard jet ramp: dark blue → blue → cyan → green → yellow → red →
// dark red. Closed-form piecewise-linear.

const N = 256;

function jetSample(t) {
  // t in [0, 1]. Returns [r, g, b] in [0, 255].
  t = Math.max(0, Math.min(1, t));
  // Standard MATLAB-style jet, closed-form.
  // Compute each channel from the piecewise linear template.
  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  const fourT = 4 * t;
  const r = clamp(Math.min(fourT - 1.5, -fourT + 4.5));
  const g = clamp(Math.min(fourT - 0.5, -fourT + 3.5));
  const b = clamp(Math.min(fourT + 0.5, -fourT + 2.5));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Bake the LUT once at module load.
const LUT_RGB = new Uint8ClampedArray(N * 3);
for (let i = 0; i < N; i++) {
  const t = i / (N - 1);
  const [r, g, b] = jetSample(t);
  LUT_RGB[i * 3 + 0] = r;
  LUT_RGB[i * 3 + 1] = g;
  LUT_RGB[i * 3 + 2] = b;
}

/**
 * Look up an [r,g,b] triple for amplitude t in [0,1]. Returns a 3-tuple.
 * Avoids allocation: writes into the provided `out` array if given.
 */
export function jetRGB(t, out) {
  let i = Math.round(t * (N - 1));
  if (i < 0) i = 0; else if (i >= N) i = N - 1;
  const o = out || [0, 0, 0];
  o[0] = LUT_RGB[i * 3 + 0];
  o[1] = LUT_RGB[i * 3 + 1];
  o[2] = LUT_RGB[i * 3 + 2];
  return o;
}

/** Look up as a CSS rgb() string. */
export function jetCSS(t) {
  const [r, g, b] = jetRGB(t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Return the underlying LUT bytes (length N*3) for ImageData writes. */
export function jetLUT() {
  return LUT_RGB;
}

export const JET_N = N;
