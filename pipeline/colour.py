"""OKLCH-to-sRGB helpers. Used once at bundle time to bake cluster palettes."""

from __future__ import annotations

import math


def oklch_to_srgb_hex(l: float, c: float, h_deg: float) -> str:
    """OKLCH -> sRGB hex. l in [0,1], c absolute, h in degrees.

    Implementation follows the Bjorn Ottosson OKLab spec
    (https://bottosson.github.io/posts/oklab/), with the standard
    OKLab -> linear-sRGB -> sRGB pipeline.
    """
    h = math.radians(h_deg)
    a = c * math.cos(h)
    b = c * math.sin(h)

    # OKLab -> LMS
    l_ = l + 0.3963377774 * a + 0.2158037573 * b
    m_ = l - 0.1055613458 * a - 0.0638541728 * b
    s_ = l - 0.0894841775 * a - 1.2914855480 * b

    L = l_ ** 3
    M = m_ ** 3
    S = s_ ** 3

    r_lin = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S
    g_lin = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S
    b_lin = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S

    def to_srgb(x: float) -> float:
        x = max(0.0, min(1.0, x))
        return 12.92 * x if x <= 0.0031308 else 1.055 * (x ** (1.0 / 2.4)) - 0.055

    r = to_srgb(r_lin)
    g = to_srgb(g_lin)
    bl = to_srgb(b_lin)

    return "#{:02x}{:02x}{:02x}".format(
        max(0, min(255, round(r * 255))),
        max(0, min(255, round(g * 255))),
        max(0, min(255, round(bl * 255))),
    )


def rhythm_palette(n: int = 18) -> list[str]:
    """18 perceptually-distinct hues, constant L and C, walking the hue circle.

    Dark editorial: chroma moderate, lightness above mid so they sit forward
    on a near-black background.
    """
    return [oklch_to_srgb_hex(0.72, 0.13, (i * 360.0 / n) % 360.0) for i in range(n)]


def tempo_palette(n: int = 5) -> list[str]:
    """5 tempo-cluster hues spanning cool->warm, slight L lift on extremes."""
    # walking blue -> green -> amber -> orange -> red
    hues = [240, 180, 130, 70, 30]
    return [oklch_to_srgb_hex(0.74, 0.13, hues[i % len(hues)]) for i in range(n)]


# Paper caller colours. Exact paper figure greys differ slightly; these are
# legible on near-black and remain recognisable as "blue" / "orange".
CALLER_COLOURS = {
    1: "#3b82c4",   # paper blue (caller A)
    2: "#e08a3c",   # paper orange (caller B)
}
# Extended set for exchanges with 3+ speakers (rare). Borrow from rhythm palette.
CALLER_EXTENDED = ["#3b82c4", "#e08a3c"] + rhythm_palette(11)[2:]


if __name__ == "__main__":
    print("rhythm palette (18):")
    for h in rhythm_palette():
        print(" ", h)
    print("tempo palette (5):")
    for h in tempo_palette():
        print(" ", h)
