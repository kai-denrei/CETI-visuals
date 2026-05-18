"""Load raw CSV data and attached pickle labels from sw-combinatoriality.

Two datasets ship in the source repo:
  - Dataset 1: DominicaCodas.csv (8719 rows, EC-1 broad corpus 2005-2018, ICI only).
  - Dataset 2: sperm-whale-dialogues.csv (3840 rows, DTag subset 2014-2018 with
    speaker IDs and exchange grouping via the REC column).

Pickle labels (rhythms.p, ornaments.p, tempos-dict.p, mean_codas.p) align 1:1 with
Dataset 2 by row index. The often-cited 3839-vs-3840 mismatch is a counting artefact
of source notebooks that index via numpy.genfromtxt's header-included row 0; with
pandas.read_csv the data row count is 3840 and pickles align cleanly.
"""

from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "data" / "sw-combinatoriality" / "data"


def load_dataset1() -> pd.DataFrame:
    """Return Dataset 1 (DominicaCodas)."""
    df = pd.read_csv(SRC / "DominicaCodas.csv")
    return df


def load_dataset2() -> pd.DataFrame:
    """Return Dataset 2 (sperm-whale-dialogues) with pickle labels attached.

    Adds columns:
      - rhythm_cluster (int, 0-17)
      - has_ornament   (int, 0/1)
      - tempo_cluster  (int, 0-4 via paper's piecewise duration thresholds)

    The tempo cluster is derived from coda Duration using the boundaries
    {0.45, 0.61, 0.93, 1.08} discovered in source notebook 4-rubato.ipynb,
    which match the five tempo modes found by GMM/KDE in notebook 2-tempo.ipynb.
    Cluster 5 in the source tempos-dict.p is empty (an artefact of the source's
    six-component GMM); we emit 0..4 only.
    """
    df = pd.read_csv(SRC / "sperm-whale-dialogues.csv")

    rhythms = _load_pickle("rhythms.p")
    ornaments = _load_pickle("ornaments.p")

    assert len(df) == len(rhythms) == len(ornaments) == 3840, (
        f"Expected 3840 rows across df/rhythms/ornaments; got "
        f"{len(df)}/{len(rhythms)}/{len(ornaments)}"
    )

    df = df.copy()
    df["rhythm_cluster"] = np.asarray(rhythms, dtype=int)
    df["has_ornament"] = np.asarray(ornaments, dtype=int)
    df["tempo_cluster"] = df["Duration"].apply(_duration_to_tempo_cluster).astype(int)

    # Exchange ID: first 9 chars of REC (mirrors source notebook 1-exchange-plot
    # which uses my_data[i,0][:9] as the audio file name). Inside an exchange we
    # later sort by TsTo to recover temporal order.
    df["exchange_id"] = df["REC"].str.slice(0, 9)

    # 0-based coda id, stable across the whole dataset
    df.insert(0, "coda_id", np.arange(len(df), dtype=int))

    return df


def load_rhythm_centroids() -> list[np.ndarray]:
    """18 rhythm cluster centroids (each a 4-vector in normalised-cumulative-ICI space)."""
    return [np.asarray(c, dtype=float) for c in _load_pickle("mean_codas.p")]


def load_tempos_dict() -> dict[int, list[float]]:
    """Per-tempo-cluster list of member coda durations (cluster 5 is empty)."""
    raw: dict[Any, Any] = _load_pickle("tempos-dict.p")
    return {int(k): [float(x) for x in v] for k, v in raw.items()}


def _load_pickle(name: str) -> Any:
    with open(SRC / name, "rb") as f:
        return pickle.load(f)


# Tempo cluster boundaries from source 4-rubato.ipynb's return_tempo() function.
# These five buckets correspond to the five GMM/KDE modes in paper Fig 2A.
_TEMPO_BOUNDS = (0.45, 0.61, 0.93, 1.08)


def _duration_to_tempo_cluster(d: float) -> int:
    """Map a coda duration in seconds to {0, 1, 2, 3, 4}."""
    for i, b in enumerate(_TEMPO_BOUNDS):
        if d < b:
            return i
    return 4


def tempo_cluster_centroids(tempos_dict: dict[int, list[float]]) -> dict[int, float]:
    """Mean duration per non-empty tempo cluster — anchor points for the KDE labels."""
    return {k: float(np.mean(v)) for k, v in tempos_dict.items() if v}


if __name__ == "__main__":
    d1 = load_dataset1()
    d2 = load_dataset2()
    mc = load_rhythm_centroids()
    td = load_tempos_dict()
    print(f"Dataset 1: {len(d1)} codas, columns: {len(d1.columns)}")
    print(f"Dataset 2: {len(d2)} codas, exchanges: {d2['exchange_id'].nunique()}, "
          f"speakers: {sorted(d2['Whale'].unique().tolist())}")
    print(f"Rhythm centroids: {len(mc)} (each {mc[0].shape})")
    print(f"Tempo cluster sizes (from dict): "
          f"{ {k: len(v) for k, v in td.items()} }")
    print(f"Tempo cluster sizes (from duration buckets): "
          f"{d2['tempo_cluster'].value_counts().sort_index().to_dict()}")
    print(f"Ornament rate (D2): {d2['has_ornament'].mean():.4f}")
