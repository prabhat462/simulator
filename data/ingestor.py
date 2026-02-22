"""
Data ingestor for CSV/Parquet transaction files.
Validates schema, computes dataset statistics.
"""

import pandas as pd
import numpy as np
import hashlib
import os
from typing import Optional
from data.models import DatasetStats


REQUIRED_COLUMNS = [
    "transaction_id", "timestamp", "payment_gateway",
    "payment_mode", "issuing_bank", "amount", "outcome"
]

VALID_PAYMENT_MODES = {"upi", "card", "netbanking", "wallet", "bnpl"}


def get_amount_band(amount: float) -> str:
    if amount <= 500:
        return "0-500"
    elif amount <= 5000:
        return "500-5k"
    elif amount <= 50000:
        return "5k-50k"
    else:
        return "50k+"


def validate_and_load(file_path: str) -> tuple[pd.DataFrame, list]:
    """
    Load and validate a CSV or Parquet file.
    Returns: (dataframe, list_of_errors)
    """
    errors = []
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == ".csv":
            df = pd.read_csv(file_path)
        elif ext in (".parquet", ".pq"):
            df = pd.read_parquet(file_path)
        else:
            return pd.DataFrame(), [f"Unsupported file type: {ext}. Use CSV or Parquet."]
    except Exception as e:
        return pd.DataFrame(), [f"Failed to read file: {str(e)}"]

    # Check required columns
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        errors.append(f"Missing required columns: {missing_cols}")
        return df, errors

    # Validate data types
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    null_timestamps = df["timestamp"].isna().sum()
    if null_timestamps > 0:
        errors.append(f"{null_timestamps} rows with invalid/missing timestamps")

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df["outcome"] = pd.to_numeric(df["outcome"], errors="coerce")

    # Validate outcome values
    invalid_outcomes = df[~df["outcome"].isin([0, 1])].shape[0]
    if invalid_outcomes > 0:
        errors.append(f"{invalid_outcomes} rows with outcome not in {{0, 1}}")

    # Validate payment_mode
    invalid_modes = df[~df["payment_mode"].str.lower().isin(VALID_PAYMENT_MODES)]
    if len(invalid_modes) > 0:
        errors.append(f"{len(invalid_modes)} rows with invalid payment_mode")

    # Normalize
    df["payment_mode"] = df["payment_mode"].str.lower()
    df["amount_band"] = df["amount"].apply(get_amount_band)
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek

    # Sort chronologically
    df = df.sort_values("timestamp").reset_index(drop=True)

    return df, errors


def compute_stats(df: pd.DataFrame) -> DatasetStats:
    """Compute dataset summary statistics."""

    total = len(df)
    overall_sr = float(df["outcome"].mean()) if total > 0 else 0.0

    sr_by_gw = df.groupby("payment_gateway")["outcome"].mean().to_dict()
    sr_by_mode = df.groupby("payment_mode")["outcome"].mean().to_dict()
    vol_by_mode = df["payment_mode"].value_counts().to_dict()
    vol_by_gw = df["payment_gateway"].value_counts().to_dict()

    missing = {}
    for col in df.columns:
        n_missing = int(df[col].isna().sum())
        if n_missing > 0:
            missing[col] = n_missing

    # Data quality score (0–100)
    completeness = 1.0 - (sum(missing.values()) / (total * len(df.columns))) if total > 0 else 0
    volume_score = min(total / 10000, 1.0)  # full score at 10K+
    data_quality = round((completeness * 70 + volume_score * 30), 1)

    return DatasetStats(
        total_transactions=total,
        date_range_start=str(df["timestamp"].min()) if total > 0 else "",
        date_range_end=str(df["timestamp"].max()) if total > 0 else "",
        gateways=sorted(df["payment_gateway"].unique().tolist()) if total > 0 else [],
        overall_sr=round(overall_sr, 4),
        sr_by_gateway={k: round(v, 4) for k, v in sr_by_gw.items()},
        sr_by_mode={k: round(v, 4) for k, v in sr_by_mode.items()},
        volume_by_mode={k: int(v) for k, v in vol_by_mode.items()},
        volume_by_gateway={k: int(v) for k, v in vol_by_gw.items()},
        missing_values=missing,
        data_quality_score=data_quality,
    )


def compute_file_hash(file_path: str) -> str:
    """Compute SHA-256 hash for dataset versioning."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()[:16]
