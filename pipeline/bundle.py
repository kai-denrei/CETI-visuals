"""Emit the three JSON bundles consumed by the web layer.

  - codas.json      one row per Dataset-2 coda
  - exchanges.json  one row per exchange
  - clusters.json   rhythm centroids (18), tempo centroids (5), colour palettes
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from pipeline import colour
from pipeline.features import (
    ICI_COLS_D2,
    attach_rubato_drift,
    coda_ici_sequence,
    exchanges_table,
)
from pipeline.load import (
    REPO,
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

    # Verification load
    for name in ("codas.json", "exchanges.json", "clusters.json"):
        path = OUT / name
        data = json.loads(path.read_text())
        size = path.stat().st_size
        print(f"  {name}: {size:,} bytes; OK")


if __name__ == "__main__":
    main()
