"""
Oracle SR computation for regret baseline.
Computes the best possible SR for each context from historical data.
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple


def compute_oracle_sr(
    df: pd.DataFrame,
    context_columns: list = None
) -> Dict[str, Dict[str, float]]:
    """
    Compute the oracle: for each context combination, find the gateway with the
    highest historical SR. Returns a nested dict: context_key -> {best_gw, best_sr, all_srs}
    """
    if context_columns is None:
        context_columns = ["payment_mode", "issuing_bank"]

    oracle = {}

    # Group by context columns and payment_gateway
    group_cols = context_columns + ["payment_gateway"]
    grouped = df.groupby(group_cols)["outcome"].agg(["sum", "count"]).reset_index()
    grouped.columns = context_columns + ["payment_gateway", "successes", "total"]
    grouped["sr"] = grouped["successes"] / grouped["total"]

    # For each context combination, find the best gateway
    for _, group_df in grouped.groupby(context_columns):
        context_key = "|".join(str(group_df.iloc[0][c]) for c in context_columns)
        best_row = group_df.loc[group_df["sr"].idxmax()]
        all_srs = {row["payment_gateway"]: round(row["sr"], 4) for _, row in group_df.iterrows()}

        oracle[context_key] = {
            "best_gateway": best_row["payment_gateway"],
            "best_sr": round(best_row["sr"], 4),
            "all_srs": all_srs,
        }

    return oracle


def get_oracle_sr_for_context(
    oracle: Dict,
    payment_mode: str,
    issuing_bank: str,
    default_sr: float = 0.85
) -> Tuple[str, float]:
    """Look up oracle's best gateway and SR for a given context."""
    key = f"{payment_mode}|{issuing_bank}"
    if key in oracle:
        return oracle[key]["best_gateway"], oracle[key]["best_sr"]
    # Fallback to mode-level oracle
    for k, v in oracle.items():
        if k.startswith(f"{payment_mode}|"):
            return v["best_gateway"], v["best_sr"]
    return "", default_sr
