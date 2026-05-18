"""Matplotlib re-renders of paper Figs 1B/C, 2A-D, and 3.

Bar: concept legible from the data, not pixel match. Style is dark editorial.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import gaussian_kde

from pipeline import colour
from pipeline.features import (
    ICI_COLS_D2,
    attach_rubato_drift,
    coda_click_times,
    coda_ici_sequence,
    exchanges_table,
)
from pipeline.load import (
    REPO,
    load_dataset2,
    load_rhythm_centroids,
)

FIG = REPO / "figures"


# Dark-editorial mpl rc -------------------------------------------------------

mpl.rcParams.update({
    "figure.facecolor": "#0c0c10",
    "axes.facecolor": "#0c0c10",
    "axes.edgecolor": "#7a7a85",
    "axes.labelcolor": "#d4d4dc",
    "axes.titlecolor": "#e8e8ec",
    "xtick.color": "#9a9aa3",
    "ytick.color": "#9a9aa3",
    "text.color": "#d4d4dc",
    "grid.color": "#22222a",
    "grid.linewidth": 0.5,
    "axes.grid": False,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "font.family": "serif",
    "font.size": 9,
    "axes.titlesize": 11,
    "axes.labelsize": 9,
    "axes.titleweight": "regular",
    "savefig.facecolor": "#0c0c10",
    "savefig.edgecolor": "none",
    "savefig.dpi": 144,
})


def _save(fig: plt.Figure, stem: str) -> None:
    FIG.mkdir(parents=True, exist_ok=True)
    for ext in ("png", "svg"):
        fig.savefig(FIG / f"{stem}.{ext}", bbox_inches="tight", pad_inches=0.18)
    plt.close(fig)
    print(f"  wrote figures/{stem}.png and .svg")


# ---------------------------------------------------------------------------
# Fig 1B/C — exchange plot
# ---------------------------------------------------------------------------

def fig_exchange(df: pd.DataFrame, exchange_id: str, span: float | None = None,
                 stem: str | None = None) -> None:
    """Render a single exchange as a music-score-style scatter of clicks.

    Y-axis = absolute time within exchange.
    X-axis = within-coda click time (so all codas align at click 1 on x=0).
    Lines connect successive clicks of the same coda; colour by speaker.
    """
    sub = df[df["exchange_id"] == exchange_id].sort_values("TsTo").reset_index(drop=True)
    if len(sub) == 0:
        print(f"  exchange {exchange_id} not found, skipping")
        return

    t0 = sub["TsTo"].min()
    if span is None:
        span = float(sub["TsTo"].max() - t0 + sub["Duration"].iloc[-1])

    fig, ax = plt.subplots(figsize=(9.5, 6.5))

    speakers = sorted(sub["Whale"].unique().tolist())
    speaker_idx = {s: i for i, s in enumerate(speakers)}

    for _, r in sub.iterrows():
        t_init = float(r["TsTo"]) - t0
        if t_init > span:
            continue
        click_t = coda_click_times(r, ICI_COLS_D2)
        s = int(r["Whale"])
        col = (
            colour.CALLER_COLOURS.get(s)
            or colour.CALLER_EXTENDED[speaker_idx[s] % len(colour.CALLER_EXTENDED)]
        )
        ys = [t_init + tt for tt in click_t]
        xs = list(range(1, len(click_t) + 1))
        ax.plot(xs, ys, "-", color=col, lw=0.9, alpha=0.85)
        ax.scatter(xs, ys, s=10, color=col, zorder=3,
                   edgecolor="#0c0c10", linewidths=0.4)
        # Annotate ornaments
        if int(r["has_ornament"]) == 1 and len(xs) > 0:
            ax.scatter(xs[-1], ys[-1], s=44, facecolor="none",
                       edgecolor="#f0c674", lw=1.0, zorder=4)

    ax.set_xlabel("click index within coda")
    ax.set_ylabel("time within exchange (s)")
    ax.set_title(f"Exchange {exchange_id}  —  {len(sub)} codas, "
                 f"speakers {speakers}")
    ax.invert_yaxis()
    ax.set_xlim(0, max(8, sub["nClicks"].max() + 1))

    # Legend
    legend_handles = []
    for s in speakers:
        col = (
            colour.CALLER_COLOURS.get(s)
            or colour.CALLER_EXTENDED[speaker_idx[s] % len(colour.CALLER_EXTENDED)]
        )
        legend_handles.append(plt.Line2D([0], [0], color=col, lw=2,
                                         label=f"caller {s}"))
    legend_handles.append(plt.Line2D([0], [0], marker="o", color="none",
                                     markerfacecolor="none",
                                     markeredgecolor="#f0c674",
                                     markersize=8, label="ornament"))
    ax.legend(handles=legend_handles, frameon=False, fontsize=8,
              loc="upper right")

    _save(fig, stem or f"fig1_exchange_{exchange_id}")


# ---------------------------------------------------------------------------
# Fig 2A — tempo KDE
# ---------------------------------------------------------------------------

def fig_tempo_kde(df: pd.DataFrame) -> None:
    durs = df["Duration"].to_numpy()
    durs = durs[(durs > 0.1) & (durs < 1.75)]

    kde = gaussian_kde(durs, bw_method=0.08)
    x = np.linspace(0.1, 1.75, 600)
    y = kde(x)

    # Local maxima
    peaks = []
    for i in range(1, len(y) - 1):
        if y[i] > y[i - 1] and y[i] > y[i + 1]:
            peaks.append((x[i], y[i]))

    fig, ax = plt.subplots(figsize=(9.5, 4.5))
    ax.fill_between(x, y, color="#3b82c4", alpha=0.25)
    ax.plot(x, y, color="#9bc3e6", lw=1.4)
    for px, py in peaks:
        ax.axvline(px, color="#f0c674", lw=0.6, ls="--", alpha=0.7)
        ax.annotate(f"{px:.2f}s", (px, py), xytext=(0, 6),
                    textcoords="offset points", ha="center", fontsize=8,
                    color="#f0c674", family="monospace")
    ax.set_xlabel("coda duration (s)")
    ax.set_ylabel("density")
    ax.set_title("Fig 2A — tempo modes (KDE of coda durations)")
    _save(fig, "fig2a_tempo_kde")


# ---------------------------------------------------------------------------
# Fig 2B — rhythm centroids small-multiples
# ---------------------------------------------------------------------------

def fig_rhythm_centroids(df: pd.DataFrame) -> None:
    centroids = load_rhythm_centroids()
    counts = df["rhythm_cluster"].value_counts().sort_index()
    palette = colour.rhythm_palette()

    fig, axes = plt.subplots(3, 6, figsize=(11, 5.5), sharex=True, sharey=True)
    for i, c in enumerate(centroids):
        ax = axes[i // 6, i % 6]
        col = palette[i]
        n = len(c)
        ax.plot(range(1, n + 1), c, marker="o", color=col, lw=1.2, ms=4,
                markeredgecolor="#0c0c10", markeredgewidth=0.4)
        ax.set_title(f"R{i}  n={counts.get(i, 0)}", fontsize=8, color=col)
        ax.set_ylim(-0.05, 1.05)
        ax.set_xlim(0.5, n + 0.5)
        ax.tick_params(labelsize=7)
        for sp in ("top", "right"):
            ax.spines[sp].set_visible(False)
    fig.suptitle("Fig 2B — 18 rhythm centroids "
                 "(normalised cumulative ICI)", color="#e8e8ec")
    fig.tight_layout()
    _save(fig, "fig2b_rhythm_centroids")


# ---------------------------------------------------------------------------
# Fig 2C — rubato drift histogram
# ---------------------------------------------------------------------------

def fig_rubato_hist(df: pd.DataFrame) -> None:
    drifts = df["rubato_drift_prev"].dropna().to_numpy()
    drifts = drifts[(drifts > -0.8) & (drifts < 0.8)]

    fig, ax = plt.subplots(figsize=(9.5, 4.5))
    bins = np.arange(-0.8, 0.8 + 0.01, 0.02)
    ax.hist(drifts, bins=bins, color="#3b82c4", alpha=0.85, edgecolor="#0c0c10",
            linewidth=0.4)
    ax.axvline(0, color="#7a7a85", lw=0.6)
    ax.set_xlabel("rubato drift  (Δ duration, s)  —  curr − prev same-speaker coda")
    ax.set_ylabel("count")
    ax.set_title(f"Fig 2C — rubato drift distribution "
                 f"(n={len(drifts)}, mean|Δ|={np.mean(np.abs(drifts)):.3f}s)")
    _save(fig, "fig2c_rubato_hist")


# ---------------------------------------------------------------------------
# Fig 2D — ornament effect on last ICI
# ---------------------------------------------------------------------------

def fig_ornament_density(df: pd.DataFrame) -> None:
    last_icis_orn = []
    last_icis_plain = []
    for _, r in df.iterrows():
        seq = coda_ici_sequence(r, ICI_COLS_D2)
        if not seq:
            continue
        last = seq[-1]
        # Express as a ratio of last ICI to median preceding ICI (>=2 ICIs)
        if len(seq) >= 2:
            ratio = last / np.median(seq[:-1])
        else:
            ratio = np.nan
        if np.isnan(ratio):
            continue
        if int(r["has_ornament"]) == 1:
            last_icis_orn.append(ratio)
        else:
            last_icis_plain.append(ratio)

    fig, ax = plt.subplots(figsize=(9.5, 4.5))
    bins = np.linspace(0.0, 3.5, 100)
    ax.hist(last_icis_plain, bins=bins, color="#3b82c4", alpha=0.6,
            label=f"plain  (n={len(last_icis_plain)})", density=True,
            edgecolor="#0c0c10", linewidth=0.3)
    ax.hist(last_icis_orn, bins=bins, color="#f0c674", alpha=0.75,
            label=f"ornamented  (n={len(last_icis_orn)})", density=True,
            edgecolor="#0c0c10", linewidth=0.3)
    ax.set_xlabel("last ICI / median preceding ICI")
    ax.set_ylabel("density")
    ax.set_title("Fig 2D — ornament codas have a clearly longer final ICI")
    ax.legend(frameon=False, fontsize=8)
    _save(fig, "fig2d_ornament_density")


# ---------------------------------------------------------------------------
# Fig 3 — phonetic alphabet grid (18 rhythm × 5 tempo)
# ---------------------------------------------------------------------------

def fig_alphabet_grid(df: pd.DataFrame) -> None:
    """18 (rhythm) × 5 (tempo) grid. Each cell: log-count shading + rubato/orn pies."""
    n_r, n_t = 18, 5
    counts = np.zeros((n_r, n_t), dtype=int)
    rubato_drift_mean = np.full((n_r, n_t), np.nan)
    orn_rate = np.zeros((n_r, n_t))
    for r in range(n_r):
        for t in range(n_t):
            mask = (df["rhythm_cluster"] == r) & (df["tempo_cluster"] == t)
            n = int(mask.sum())
            counts[r, t] = n
            if n:
                rd = df.loc[mask, "rubato_drift_prev"].dropna()
                if len(rd):
                    rubato_drift_mean[r, t] = float(rd.abs().mean())
                orn_rate[r, t] = float(df.loc[mask, "has_ornament"].mean())

    fig, ax = plt.subplots(figsize=(8, 12))

    # Shading: log(count + 1) normalised
    lc = np.log1p(counts)
    ax.imshow(lc, aspect="auto", origin="upper", cmap="Blues",
              extent=(-0.5, n_t - 0.5, n_r - 0.5, -0.5), alpha=0.55)

    # Cell text and pies
    for r in range(n_r):
        for t in range(n_t):
            n = counts[r, t]
            ax.text(t, r - 0.25, f"n={n}", ha="center", va="center",
                    fontsize=6.5, color="#e8e8ec", family="monospace")
            if n:
                ax.text(t, r + 0.18, f"orn {orn_rate[r, t] * 100:.0f}%",
                        ha="center", va="center", fontsize=6,
                        color="#f0c674", family="monospace")

    # Axis ticks
    ax.set_xticks(range(n_t))
    tempo_means = [0.33, 0.51, 0.80, 1.02, 1.26]
    ax.set_xticklabels([f"T{i}\n{m:.2f}s" for i, m in enumerate(tempo_means)],
                        fontsize=8)
    ax.set_yticks(range(n_r))
    ax.set_yticklabels([f"R{i}" for i in range(n_r)], fontsize=7)

    # Coloured rhythm strip on the left
    palette = colour.rhythm_palette()
    for r in range(n_r):
        ax.add_patch(plt.Rectangle((-0.65, r - 0.45), 0.1, 0.9,
                                    color=palette[r], clip_on=False))

    ax.set_xlim(-0.7, n_t - 0.5)
    ax.set_ylim(n_r - 0.5, -0.5)
    ax.set_title(f"Fig 3 — phonetic alphabet grid  "
                 f"(rhythm × tempo, {(counts > 0).sum()} non-empty cells)")
    ax.set_xlabel("tempo cluster (mean duration)")
    ax.set_ylabel("rhythm cluster")
    for s in ("top", "right", "left", "bottom"):
        ax.spines[s].set_visible(False)
    ax.tick_params(length=0)
    _save(fig, "fig3_alphabet_grid")


# ---------------------------------------------------------------------------

def main() -> None:
    print("Loading data...")
    df = load_dataset2()
    df = attach_rubato_drift(df)

    # Pick a representative two-minute-ish exchange with two speakers
    ex = exchanges_table(df)
    ex2 = ex[ex["speakers"].apply(lambda s: len(s) >= 2)]
    # Sort by something resembling "rich and contained"
    pick = ex2.iloc[(ex2["n_codas"] - 30).abs().argsort()].iloc[0]
    print(f"Representative exchange: {pick['exchange_id']} "
          f"({pick['n_codas']} codas, speakers {pick['speakers']})")

    fig_exchange(df, pick["exchange_id"], span=180.0, stem="fig1_exchange")
    fig_tempo_kde(df)
    fig_rhythm_centroids(df)
    fig_rubato_hist(df)
    fig_ornament_density(df)
    fig_alphabet_grid(df)
    print("All figures written.")


if __name__ == "__main__":
    main()
