"""Feature derivations on top of the loaded data.

Definitions follow Sharma et al. 2024 and the source notebooks 1-6 in
sw-combinatoriality. Each function takes the Dataset 2 dataframe (with
rhythm/tempo/ornament labels already attached by pipeline.load) and returns
either a per-coda vector (added back as a column) or a derived structure.

Rubato drift (per-coda, signed):
    rubato_drift_prev[i] = duration(i) - duration(prev_same_speaker_in_exchange(i))
  with prev defined by source 4-rubato.ipynb: same exchange (REC), same Whale,
  within a 6s window of TsTo, |nClicks delta| < 3. If the previous coda's
  ornament flag is on, subtract its terminal ICI from its duration before
  comparison (mirrors the source's ornament correction).

Ornament rate:
    cross-check: should land near 4% per paper. Already covered by
    load.load_dataset2()['has_ornament'].mean() but we provide a helper.

Exchange grouping:
    exchange_id = REC[:9] (audio file name root, matches source).
    Inside each exchange, codas are sorted by TsTo to recover temporal order.

ICI sequences:
    ICI1..ICI28 are inter-click intervals. The source convention is that
    consecutive zeros mark the end of the coda. We compress to the
    non-zero prefix, allowing for trailing ornament click; ornament-flagged
    codas keep their final ICI (it IS the ornament click).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

ICI_COLS_D2 = [f"ICI{i}" for i in range(1, 29)]
ICI_COLS_D1 = [f"ICI{i}" for i in range(1, 10)]


def coda_ici_sequence(row: pd.Series, ici_cols: list[str]) -> list[float]:
    """Return the non-trailing-zero ICI prefix for a coda row, as floats."""
    raw = [float(row[c]) for c in ici_cols]
    # Take prefix up to first zero (matches source notebooks 1 and 4)
    n = 0
    for v in raw:
        if v <= 0:
            break
        n += 1
    return raw[:n]


def coda_click_times(row: pd.Series, ici_cols: list[str]) -> list[float]:
    """Cumulative click offsets (t1=0 anchored), in seconds, for a coda."""
    icis = coda_ici_sequence(row, ici_cols)
    t = [0.0]
    s = 0.0
    for v in icis:
        s += v
        t.append(s)
    return t


def attach_rubato_drift(df: pd.DataFrame) -> pd.DataFrame:
    """Add column rubato_drift_prev: duration delta vs the previous same-speaker coda
    in the same exchange within 6s and |nClicks delta| < 3.

    Ornament-flagged codas have their last-ICI subtracted from Duration before
    differencing — mirrors source 4-rubato.ipynb's `if curr_ec>0 / next_ec>0`.

    NaN where no eligible predecessor exists.
    """
    df = df.copy()
    drifts = np.full(len(df), np.nan, dtype=float)

    # Iterate within each exchange, in TsTo order
    for ex_id, sub in df.groupby("exchange_id", sort=False):
        sub_sorted = sub.sort_values("TsTo")
        idx = sub_sorted.index.to_numpy()
        whales = sub_sorted["Whale"].to_numpy()
        ts = sub_sorted["TsTo"].to_numpy()
        durs = sub_sorted["Duration"].to_numpy().astype(float).copy()
        nclicks = sub_sorted["nClicks"].to_numpy()
        ornaments = sub_sorted["has_ornament"].to_numpy()

        # Apply ornament correction: subtract the final ICI when ornament is set
        # We need each row's last ICI in original (un-cumulated) form.
        last_ici = np.zeros(len(sub_sorted))
        for k, (_, r) in enumerate(sub_sorted.iterrows()):
            icis = coda_ici_sequence(r, ICI_COLS_D2)
            last_ici[k] = icis[-1] if icis else 0.0

        adj_durs = durs.copy()
        adj_durs[ornaments == 1] -= last_ici[ornaments == 1]

        # For each row, search backwards within the exchange for a same-speaker
        # predecessor within 6s in TsTo and |dn| < 3.
        for k in range(len(sub_sorted)):
            target_w = whales[k]
            t_curr = ts[k]
            n_curr = nclicks[k]
            for j in range(k - 1, -1, -1):
                if t_curr - ts[j] > 6.0:
                    break
                if whales[j] == target_w and abs(nclicks[j] - n_curr) < 3:
                    drifts[idx[k]] = adj_durs[k] - adj_durs[j]
                    break

    df["rubato_drift_prev"] = drifts
    return df


def ornament_rate(df: pd.DataFrame) -> float:
    return float(df["has_ornament"].mean())


def exchanges_table(df: pd.DataFrame) -> pd.DataFrame:
    """One row per exchange with summary fields."""
    rows = []
    for ex_id, sub in df.groupby("exchange_id", sort=False):
        sub_sorted = sub.sort_values("TsTo")
        rows.append({
            "exchange_id": ex_id,
            "n_codas": int(len(sub_sorted)),
            "speakers": sorted(sub_sorted["Whale"].unique().tolist()),
            "t_start": float(sub_sorted["TsTo"].min()),
            "t_end": float(
                sub_sorted["TsTo"].max() + sub_sorted["Duration"].iloc[-1]
            ),
            "coda_ids": sub_sorted["coda_id"].tolist(),
        })
    out = pd.DataFrame(rows)
    out["duration_total"] = out["t_end"] - out["t_start"]
    return out


if __name__ == "__main__":
    from pipeline.load import load_dataset2
    df = load_dataset2()
    df = attach_rubato_drift(df)
    print(f"Rubato drift available on {df['rubato_drift_prev'].notna().sum()} codas")
    print(f"Mean |rubato drift|: "
          f"{df['rubato_drift_prev'].abs().mean():.4f}s (paper: ~0.06s)")
    print(f"Ornament rate: {ornament_rate(df):.4f}")
    ex = exchanges_table(df)
    print(f"Exchanges: {len(ex)}, mean codas/exchange: {ex['n_codas'].mean():.1f}")
    print(f"Longest exchange: {ex['duration_total'].max():.1f}s "
          f"({ex.loc[ex['duration_total'].idxmax(), 'exchange_id']})")
