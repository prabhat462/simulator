"""
Data ingestion for Algorithm Impact Analysis.

Handles CSV/Parquet upload, schema validation, deduplication,
period tagging, and materialized view refresh.
"""

import os
import pandas as pd
from impact_analysis.database import get_connection, refresh_materialized_views

# Required columns in uploaded data
REQUIRED_COLUMNS = [
    "transaction_id", "date", "payment_gateway", "payment_mode",
    "issuing_bank", "amount", "merchant_id", "outcome",
]

# Optional columns — will be filled with defaults if missing
OPTIONAL_COLUMNS = {
    "timestamp": None,
    "algo_recommended_pg": None,
    "was_algo_routing": False,
    "card_network": None,
    "merchant_name": None,
    "merchant_category": None,
    "device_type": None,
    "state": None,
    "failure_reason": None,
    "failure_category": None,
    "latency_ms": None,
}

ALL_COLUMNS = [
    "transaction_id", "timestamp", "date", "period",
    "payment_gateway", "algo_recommended_pg", "was_algo_routing",
    "payment_mode", "card_network", "issuing_bank", "amount",
    "merchant_id", "merchant_name", "merchant_category",
    "device_type", "state",
    "outcome", "failure_reason", "failure_category", "latency_ms",
]


def validate_schema(df: pd.DataFrame) -> list[str]:
    """Check that required columns are present. Returns list of errors."""
    errors = []
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            errors.append(f"Missing required column: '{col}'")
    return errors


def ingest_file(file_path: str, period: str) -> dict:
    """
    Validate, deduplicate, and insert a CSV/Parquet file into DuckDB.

    Args:
        file_path: Path to the CSV or Parquet file.
        period: 'before' or 'after'.

    Returns:
        Dict with ingestion stats.
    """
    if period not in ("before", "after"):
        raise ValueError("period must be 'before' or 'after'")

    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        df = pd.read_csv(file_path, low_memory=False)
    elif ext in (".parquet", ".pq"):
        df = pd.read_parquet(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    # Validate schema
    errors = validate_schema(df)
    if errors:
        return {"success": False, "errors": errors, "rows_inserted": 0}

    original_count = len(df)

    # Add period column
    df["period"] = period

    # Fill optional columns with defaults
    for col, default in OPTIONAL_COLUMNS.items():
        if col not in df.columns:
            df[col] = default

    # Coerce types
    df["date"] = pd.to_datetime(df["date"]).dt.date
    if df["timestamp"].isna().all() or df["timestamp"].dtype == object:
        # If timestamp is missing, derive from date
        df["timestamp"] = pd.to_datetime(df["date"])
    else:
        df["timestamp"] = pd.to_datetime(df["timestamp"])

    df["outcome"] = df["outcome"].astype(int)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    if "latency_ms" in df.columns:
        df["latency_ms"] = pd.to_numeric(df["latency_ms"], errors="coerce")

    if "was_algo_routing" in df.columns:
        df["was_algo_routing"] = df["was_algo_routing"].fillna(False).astype(bool)

    # Select final columns in order
    df = df[[c for c in ALL_COLUMNS if c in df.columns]]
    for col in ALL_COLUMNS:
        if col not in df.columns:
            df[col] = None

    df = df[ALL_COLUMNS]

    # Insert into DuckDB (dedup by transaction_id)
    conn = get_connection()

    # Remove any existing rows with the same transaction_ids
    temp_table = "temp_ingest"
    conn.execute(f"DROP TABLE IF EXISTS {temp_table}")
    conn.execute(f"CREATE TEMP TABLE {temp_table} AS SELECT * FROM df")

    # Deduplicate within the upload
    dedup_count = conn.execute(f"""
        SELECT COUNT(*) - COUNT(DISTINCT transaction_id) FROM {temp_table}
    """).fetchone()[0]

    # Remove existing duplicates from main table
    existing_dupes = conn.execute(f"""
        SELECT COUNT(*) FROM transactions t
        WHERE EXISTS (SELECT 1 FROM {temp_table} tmp WHERE tmp.transaction_id = t.transaction_id)
    """).fetchone()[0]

    if existing_dupes > 0:
        conn.execute(f"""
            DELETE FROM transactions
            WHERE transaction_id IN (SELECT DISTINCT transaction_id FROM {temp_table})
        """)

    # Insert deduplicated rows
    conn.execute(f"""
        INSERT INTO transactions
        SELECT DISTINCT ON (transaction_id) * FROM {temp_table}
    """)

    conn.execute(f"DROP TABLE IF EXISTS {temp_table}")

    rows_inserted = original_count - dedup_count

    # Refresh materialized views
    refresh_materialized_views(conn)

    return {
        "success": True,
        "errors": [],
        "rows_total": original_count,
        "rows_inserted": rows_inserted,
        "duplicates_removed": dedup_count + existing_dupes,
        "period": period,
    }
