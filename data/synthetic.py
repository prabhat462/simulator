"""
Synthetic data generator with 6 built-in scenario templates.
"""

import random
import uuid
from datetime import datetime, timedelta
from typing import Optional
import pandas as pd
import numpy as np


GATEWAYS_DEFAULT = [
    {"id": "razorpay", "base_sr": {"upi": 0.92, "card": 0.88, "netbanking": 0.85}},
    {"id": "cashfree", "base_sr": {"upi": 0.89, "card": 0.90, "netbanking": 0.82}},
    {"id": "payu",     "base_sr": {"upi": 0.87, "card": 0.86, "netbanking": 0.88}},
]

BANKS = ["HDFC", "SBI", "ICICI", "AXIS", "KOTAK", "PNB", "BOB", "IDBI"]
MODES = ["upi", "card", "netbanking"]
CARD_NETWORKS = ["visa", "mastercard", "rupay", "amex"]
MERCHANT_CATEGORIES = ["ecomm", "travel", "gaming", "utilities", "food"]
DEVICE_TYPES = ["mobile_app", "mobile_web", "desktop"]
STATES = ["MH", "KA", "DL", "TN", "UP", "GJ", "RJ", "WB"]


def _generate_base_transactions(
    n: int,
    gateways: list,
    seed: int = 42,
    mode_mix: Optional[dict] = None,
    start_date: Optional[datetime] = None,
) -> pd.DataFrame:
    """Generate base transaction DataFrame."""
    rng = np.random.RandomState(seed)
    py_rng = random.Random(seed)

    if mode_mix is None:
        mode_mix = {"upi": 0.45, "card": 0.35, "netbanking": 0.20}
    if start_date is None:
        start_date = datetime(2025, 1, 1, 0, 0, 0)

    modes_list = list(mode_mix.keys())
    mode_probs = [mode_mix[m] for m in modes_list]

    records = []
    gw_ids = [g["id"] for g in gateways]
    gw_sr = {g["id"]: g["base_sr"] for g in gateways}

    for i in range(n):
        mode = rng.choice(modes_list, p=mode_probs)
        bank = py_rng.choice(BANKS)
        gw = py_rng.choice(gw_ids)
        amount = round(rng.exponential(2500), 2)
        amount = max(10, min(amount, 200000))

        hour = int(rng.normal(14, 5)) % 24
        ts = start_date + timedelta(
            seconds=int(i * (86400 * 30 / n)),  # spread over ~30 days
            hours=hour - 12
        )

        base = gw_sr.get(gw, {}).get(mode, 0.85)
        outcome = 1 if rng.random() < base else 0

        card_network = py_rng.choice(CARD_NETWORKS) if mode == "card" else None

        records.append({
            "transaction_id": f"txn_{i:08d}",
            "timestamp": ts.isoformat(),
            "payment_gateway": gw,
            "payment_mode": mode,
            "card_network": card_network,
            "issuing_bank": bank,
            "amount": amount,
            "outcome": outcome,
            "merchant_id": f"m_{rng.randint(1, 50):04d}",
            "merchant_category": py_rng.choice(MERCHANT_CATEGORIES),
            "failure_reason": None if outcome == 1 else py_rng.choice(["timeout", "declined", "gateway_error", "bank_error"]),
            "device_type": py_rng.choice(DEVICE_TYPES),
            "state": py_rng.choice(STATES),
        })

    df = pd.DataFrame(records)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


def apply_outage(df: pd.DataFrame, gateway_id: str, start_idx: int, end_idx: int,
                 degraded_sr: float = 0.15, seed: int = 42) -> pd.DataFrame:
    """Apply an outage event to a specific gateway."""
    rng = np.random.RandomState(seed + 1)
    mask = (df.index >= start_idx) & (df.index < end_idx) & (df["payment_gateway"] == gateway_id)
    for idx in df[mask].index:
        df.at[idx, "outcome"] = 1 if rng.random() < degraded_sr else 0
    return df


def apply_gradual_degradation(df: pd.DataFrame, gateway_id: str, start_idx: int,
                               end_idx: int, final_sr: float = 0.60, seed: int = 42) -> pd.DataFrame:
    """Apply gradual SR degradation to a gateway."""
    rng = np.random.RandomState(seed + 2)
    mask = (df["payment_gateway"] == gateway_id)
    gw_indices = df[mask].index.tolist()

    for idx in gw_indices:
        if idx < start_idx:
            continue
        if idx >= end_idx:
            break
        progress = (idx - start_idx) / max(end_idx - start_idx, 1)
        original_sr = 0.90
        current_sr = original_sr - (original_sr - final_sr) * progress
        df.at[idx, "outcome"] = 1 if rng.random() < current_sr else 0
    return df


def apply_peak_hour(df: pd.DataFrame, peak_hours: list = None,
                    sr_drop: float = 0.15, seed: int = 42) -> pd.DataFrame:
    """Apply SR drop during peak hours."""
    if peak_hours is None:
        peak_hours = [18, 19, 20, 21]
    rng = np.random.RandomState(seed + 3)
    df["_hour"] = pd.to_datetime(df["timestamp"]).dt.hour
    mask = df["_hour"].isin(peak_hours)
    for idx in df[mask].index:
        if df.at[idx, "outcome"] == 1 and rng.random() < sr_drop:
            df.at[idx, "outcome"] = 0
    df = df.drop(columns=["_hour"])
    return df


# ── Scenario Templates ──

SCENARIO_TEMPLATES = {
    "gateway_outage": {
        "name": "Gateway Outage",
        "description": "PG-A SR drops to 15% at T=5,000; recovers at T=7,000. Tests outage detection speed.",
        "n_transactions": 20000,
    },
    "gradual_degradation": {
        "name": "Gradual Degradation",
        "description": "PG-B SR drifts 92% → 60% over 10,000 transactions. Tests discount/window sensitivity.",
        "n_transactions": 20000,
    },
    "peak_hour_stress": {
        "name": "Peak Hour Stress",
        "description": "All gateways SR drops 15% during hours 18–21. Tests time-aware adaptation.",
        "n_transactions": 20000,
    },
    "new_gateway_onboard": {
        "name": "New Gateway Onboard",
        "description": "PG-C added at T=3,000 with unknown SR. Tests cold-start handling.",
        "n_transactions": 20000,
    },
    "stable_production": {
        "name": "Stable Production",
        "description": "All gateways maintain steady SR ±2%. Verify no over-exploration.",
        "n_transactions": 20000,
    },
    "bank_mode_interaction": {
        "name": "Bank-Mode Interaction",
        "description": "HDFC card SR: 95% on PG-A, 60% on PG-B; reversed for SBI. Tests contextual advantage.",
        "n_transactions": 20000,
    },
}


def generate_scenario(template_id: str, n_transactions: Optional[int] = None, seed: int = 42) -> pd.DataFrame:
    """Generate a synthetic dataset from a template."""
    template = SCENARIO_TEMPLATES.get(template_id)
    if not template:
        raise ValueError(f"Unknown template: {template_id}. Available: {list(SCENARIO_TEMPLATES.keys())}")

    n = n_transactions or template["n_transactions"]
    df = _generate_base_transactions(n, GATEWAYS_DEFAULT, seed=seed)

    if template_id == "gateway_outage":
        df = apply_outage(df, "razorpay", 5000, 7000, 0.15, seed)

    elif template_id == "gradual_degradation":
        df = apply_gradual_degradation(df, "cashfree", 3000, 13000, 0.60, seed)

    elif template_id == "peak_hour_stress":
        df = apply_peak_hour(df, [18, 19, 20, 21], 0.15, seed)

    elif template_id == "new_gateway_onboard":
        # Remove PG-C from first 3000 transactions
        new_gw_mask = (df.index < 3000) & (df["payment_gateway"] == "payu")
        reassign = df[new_gw_mask].index
        rng = random.Random(seed)
        for idx in reassign:
            df.at[idx, "payment_gateway"] = rng.choice(["razorpay", "cashfree"])

    elif template_id == "stable_production":
        pass  # Already stable by default

    elif template_id == "bank_mode_interaction":
        rng = np.random.RandomState(seed + 10)
        for idx in df.index:
            row = df.iloc[idx]
            if row["payment_mode"] == "card" and row["issuing_bank"] == "HDFC":
                if row["payment_gateway"] == "razorpay":
                    df.at[idx, "outcome"] = 1 if rng.random() < 0.95 else 0
                elif row["payment_gateway"] == "cashfree":
                    df.at[idx, "outcome"] = 1 if rng.random() < 0.60 else 0
            elif row["payment_mode"] == "card" and row["issuing_bank"] == "SBI":
                if row["payment_gateway"] == "razorpay":
                    df.at[idx, "outcome"] = 1 if rng.random() < 0.60 else 0
                elif row["payment_gateway"] == "cashfree":
                    df.at[idx, "outcome"] = 1 if rng.random() < 0.95 else 0

    return df
