"""Emit the JSON bundles consumed by the web layer.

  - codas.json             one row per Dataset-2 coda (v1/v2)
  - exchanges.json         one row per exchange (v1/v2)
  - clusters.json          rhythm centroids (18), tempo centroids (5), colour palettes
  - corpus_timeline.json   v3 LTSA-style heat-clock derived from Dataset 1 (Date column)
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline import colour
from pipeline.features import (
    ICI_COLS_D2,
    attach_rubato_drift,
    coda_ici_sequence,
    exchanges_table,
)
from pipeline.load import (
    REPO,
    load_dataset1,
    load_dataset2,
    load_rhythm_centroids,
    load_tempos_dict,
    tempo_cluster_centroids,
)

OUT = REPO / "data" / "derived"


def build_codas(df) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        icis = coda_ici_sequence(r, ICI_COLS_D2)
        rd = r["rubato_drift_prev"]
        rows.append({
            "id": int(r["coda_id"]),
            "exchange_id": r["exchange_id"],
            "speaker": int(r["Whale"]),
            "t_start": float(r["TsTo"]),
            "n_clicks": int(r["nClicks"]),
            "duration": float(r["Duration"]),
            "ici_seq": [round(v, 5) for v in icis],
            "rhythm_cluster": int(r["rhythm_cluster"]),
            "tempo_cluster": int(r["tempo_cluster"]),
            "has_ornament": int(r["has_ornament"]),
            "rubato_drift_prev": None if np.isnan(rd) else round(float(rd), 5),
        })
    return rows


def build_exchanges(df) -> list[dict]:
    ex = exchanges_table(df)
    rows = []
    for _, r in ex.iterrows():
        rows.append({
            "id": r["exchange_id"],
            "speakers": [int(s) for s in r["speakers"]],
            "n_codas": int(r["n_codas"]),
            "n_speakers": int(len(r["speakers"])),
            "t_start": round(float(r["t_start"]), 4),
            "t_end": round(float(r["t_end"]), 4),
            "duration_total": round(float(r["duration_total"]), 4),
            "coda_ids": [int(i) for i in r["coda_ids"]],
        })
    rows.sort(key=lambda x: -x["n_codas"])
    return rows


def build_clusters(df) -> dict:
    rhythm_centroids = load_rhythm_centroids()
    rhythm_counts = (
        df["rhythm_cluster"].value_counts().sort_index().to_dict()
    )
    rhythms = [
        {
            "id": i,
            "centroid": [round(float(x), 5) for x in c],
            "count": int(rhythm_counts.get(i, 0)),
            "colour": colour.rhythm_palette()[i],
        }
        for i, c in enumerate(rhythm_centroids)
    ]

    tempos_dict = load_tempos_dict()
    tempo_means = tempo_cluster_centroids(tempos_dict)
    tempo_counts = (
        df["tempo_cluster"].value_counts().sort_index().to_dict()
    )
    tempos = [
        {
            "id": i,
            "mean_duration": round(float(tempo_means.get(i, 0.0)), 4),
            "count": int(tempo_counts.get(i, 0)),
            "colour": colour.tempo_palette()[i],
        }
        for i in range(5)
    ]

    return {
        "rhythms": rhythms,
        "tempos": tempos,
        "caller_colours": colour.CALLER_COLOURS,
        "caller_colours_extended": colour.CALLER_EXTENDED,
        "tempo_boundaries": [0.45, 0.61, 0.93, 1.08],
        "n_codas": int(len(df)),
        "n_exchanges": int(df["exchange_id"].nunique()),
        "ornament_rate": round(float(df["has_ornament"].mean()), 5),
    }


def build_corpus_timeline() -> dict:
    """v3 LTSA-style corpus heat-clock from Dataset 1 (DominicaCodas.csv).

    Dataset 1 carries `Date` (DD/MM/YYYY) but no time-of-day. We therefore reduce
    the LTSA to a 2-D density grid:
      - X axis: year × month, 156 columns across 2005-01..2017-12 inclusive
        (Dataset 1 spans 2005-03 .. 2017-11 in practice; we pad to whole years
        so the cursor sweep stays uniform).
      - Y axis: day-of-week, 7 rows (Mon=0 .. Sun=6).

    Cell value = raw coda count. The web layer applies log(count+1) and looks up
    a baked OKLCH magma-like ramp. The current month column is highlighted by the
    global playback clock cursor.
    """
    df = load_dataset1()
    # Dataset 1 mixes two formats: DD/MM/YYYY (2005-2014) and DD-MM-YYYY (2014-2017).
    # Try slash first, then fill remaining with dash.
    dates_a = pd.to_datetime(df["Date"], format="%d/%m/%Y", errors="coerce")
    dates_b = pd.to_datetime(df["Date"], format="%d-%m-%Y", errors="coerce")
    dates = dates_a.fillna(dates_b)
    if dates.isna().any():
        n_bad = int(dates.isna().sum())
        print(f"  WARN: {n_bad} rows with unparseable Date; dropped from timeline")
    valid = dates.dropna()

    years = valid.dt.year.to_numpy()
    months = valid.dt.month.to_numpy()
    dows = valid.dt.dayofweek.to_numpy()  # Mon=0 .. Sun=6

    # X axis labels: pad to whole years across the data extent.
    y_min = int(years.min())
    y_max = int(years.max())
    x_cols = []
    for y in range(y_min, y_max + 1):
        for m in range(1, 13):
            x_cols.append({"year": y, "month": m, "label": f"{y}-{m:02d}"})
    col_index = {(c["year"], c["month"]): i for i, c in enumerate(x_cols)}

    # Grid: rows = day-of-week (7), cols = months (len(x_cols))
    grid = np.zeros((7, len(x_cols)), dtype=int)
    monthly_totals = np.zeros(len(x_cols), dtype=int)
    for y, m, d in zip(years, months, dows):
        col = col_index.get((int(y), int(m)))
        if col is None:
            continue
        grid[int(d), col] += 1
        monthly_totals[col] += 1

    ramp = colour.magma_like_ramp(32)

    return {
        "source": "DominicaCodas.csv",
        "n_codas_used": int(valid.shape[0]),
        "n_codas_dropped": int(dates.isna().sum()),
        "x_axis": {
            "kind": "year_month",
            "labels": x_cols,
            "n_cols": len(x_cols),
        },
        "y_axis": {
            "kind": "day_of_week",
            "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "n_rows": 7,
        },
        "grid": grid.tolist(),
        "max_count": int(grid.max()),
        "monthly_totals": monthly_totals.tolist(),
        "ramp": ramp,
        "caption": (
            "Dataset 1 (DominicaCodas.csv) carries calendar Date only, no time-of-day. "
            "LTSA therefore reduces to a 2-D density: months across, day-of-week down. "
            "Cell shading is log(count + 1) on a perceptually uniform OKLCH magma-like ramp."
        ),
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print("Loading Dataset 2 with labels...")
    df = load_dataset2()
    print(f"  {len(df)} codas, {df['exchange_id'].nunique()} exchanges")

    print("Computing rubato drift (per-coda, signed)...")
    df = attach_rubato_drift(df)

    print("Building codas.json...")
    codas = build_codas(df)
    (OUT / "codas.json").write_text(json.dumps(codas, separators=(",", ":")))
    print(f"  wrote {len(codas)} codas")

    print("Building exchanges.json...")
    exchanges = build_exchanges(df)
    (OUT / "exchanges.json").write_text(json.dumps(exchanges, separators=(",", ":")))
    print(f"  wrote {len(exchanges)} exchanges")

    print("Building clusters.json...")
    clusters = build_clusters(df)
    (OUT / "clusters.json").write_text(json.dumps(clusters, indent=2))
    print(f"  wrote clusters meta")

    print("Building corpus_timeline.json (v3 LTSA from Dataset 1)...")
    ct = build_corpus_timeline()
    (OUT / "corpus_timeline.json").write_text(json.dumps(ct, separators=(",", ":")))
    print(f"  wrote timeline: {ct['n_codas_used']} codas, "
          f"{ct['x_axis']['n_cols']} months, max cell {ct['max_count']}")

    # Verification load
    for name in ("codas.json", "exchanges.json", "clusters.json", "corpus_timeline.json"):
        path = OUT / name
        data = json.loads(path.read_text())
        size = path.stat().st_size
        print(f"  {name}: {size:,} bytes; OK")


if __name__ == "__main__":
    main()
