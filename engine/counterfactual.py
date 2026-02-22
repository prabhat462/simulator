"""
Counterfactual outcome estimation.
Estimates what would have happened if a different gateway had been chosen.
"""

import numpy as np
import pandas as pd
from typing import Dict, Optional


class CounterfactualEstimator:
    """Estimates outcomes for counterfactual gateway selections."""

    def __init__(self, mode: str = "sr_interpolation"):
        """
        mode: 'direct_replay' | 'ips' | 'sr_interpolation'
        """
        self.mode = mode
        self.sr_table: Dict[str, float] = {}
        self._is_fitted = False

    def fit(self, df: pd.DataFrame, warm_up_frac: float = 0.2):
        """
        Build SR lookup table from historical data.
        For SR Interpolation: compute per-(gateway, mode, bank, hour) SR.
        """
        warm_up_n = int(len(df) * warm_up_frac)
        warm_up_df = df.iloc[:warm_up_n] if warm_up_n > 0 else df

        # Build multi-level SR table
        for (gw, mode), group in warm_up_df.groupby(["payment_gateway", "payment_mode"]):
            key = f"{gw}|{mode}"
            sr = group["outcome"].mean()
            self.sr_table[key] = float(sr)

        # Also build per-(gateway, mode, bank) if enough data
        for (gw, mode, bank), group in warm_up_df.groupby(
            ["payment_gateway", "payment_mode", "issuing_bank"]
        ):
            if len(group) >= 10:
                key = f"{gw}|{mode}|{bank}"
                self.sr_table[key] = float(group["outcome"].mean())

        self._is_fitted = True

    def estimate_outcome(
        self,
        chosen_gw: str,
        actual_gw: str,
        actual_outcome: int,
        payment_mode: str,
        issuing_bank: str,
        rng: np.random.RandomState,
    ) -> int:
        """
        Estimate outcome for chosen_gw given actual outcome on actual_gw.
        """
        if self.mode == "direct_replay":
            # Only use actual outcome when chosen == actual
            if chosen_gw == actual_gw:
                return actual_outcome
            else:
                return -1  # Signal to skip this transaction

        elif self.mode == "sr_interpolation":
            # Use SR lookup table to simulate
            key_specific = f"{chosen_gw}|{payment_mode}|{issuing_bank}"
            key_general = f"{chosen_gw}|{payment_mode}"

            sr = self.sr_table.get(key_specific,
                  self.sr_table.get(key_general, 0.85))
            return 1 if rng.random() < sr else 0

        elif self.mode == "ips":
            # Simplified IPS: if same gateway, use actual outcome
            # If different, scale by propensity ratio
            if chosen_gw == actual_gw:
                return actual_outcome
            else:
                # Use SR interpolation as fallback for IPS
                key = f"{chosen_gw}|{payment_mode}"
                sr = self.sr_table.get(key, 0.85)
                return 1 if rng.random() < sr else 0

        return actual_outcome
