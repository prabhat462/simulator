"""
DuckDB database layer for Algorithm Impact Analysis.

Manages an embedded DuckDB database storing transaction data
partitioned by period (before/after), with pre-aggregated
materialised views for fast dashboard queries.
"""

import os
import duckdb
import threading

_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "impact_analysis.duckdb"
)

_local = threading.local()


def get_connection() -> duckdb.DuckDBPyConnection:
    """Return a thread-local DuckDB connection."""
    if not hasattr(_local, "conn") or _local.conn is None:
        os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
        _local.conn = duckdb.connect(_DB_PATH)
        _init_schema(_local.conn)
    return _local.conn


def _init_schema(conn: duckdb.DuckDBPyConnection):
    """Create tables if they don't exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id      VARCHAR NOT NULL,
            timestamp           TIMESTAMP,
            date                DATE NOT NULL,
            period              VARCHAR NOT NULL,

            payment_gateway     VARCHAR NOT NULL,
            algo_recommended_pg VARCHAR,
            was_algo_routing    BOOLEAN DEFAULT FALSE,

            payment_mode        VARCHAR NOT NULL,
            card_network        VARCHAR,
            issuing_bank        VARCHAR NOT NULL,
            amount              DOUBLE NOT NULL,
            merchant_id         VARCHAR NOT NULL,
            merchant_name       VARCHAR,
            merchant_category   VARCHAR,
            device_type         VARCHAR,
            state               VARCHAR,

            outcome             SMALLINT NOT NULL,
            failure_reason      VARCHAR,
            failure_category    VARCHAR,
            latency_ms          INTEGER
        );
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS analysis_runs (
            run_id              VARCHAR PRIMARY KEY,
            created_at          TIMESTAMP DEFAULT current_timestamp,
            baseline_start      DATE NOT NULL,
            baseline_end        DATE NOT NULL,
            algo_start          DATE NOT NULL,
            algo_end            DATE NOT NULL,
            baseline_txn_count  BIGINT,
            algo_txn_count      BIGINT,
            baseline_sr         DOUBLE,
            algo_sr             DOUBLE,
            sr_uplift           DOUBLE,
            p_value             DOUBLE,
            is_significant      BOOLEAN,
            status              VARCHAR DEFAULT 'pending',
            result_json         VARCHAR
        );
    """)


def refresh_materialized_views(conn: duckdb.DuckDBPyConnection):
    """Rebuild pre-aggregated tables from raw transactions."""
    conn.execute("DROP TABLE IF EXISTS daily_cohort_sr;")
    conn.execute("""
        CREATE TABLE daily_cohort_sr AS
        SELECT
            date,
            period,
            payment_gateway,
            payment_mode,
            card_network,
            issuing_bank,
            merchant_id,
            merchant_category,
            CASE
                WHEN amount < 500    THEN '0-500'
                WHEN amount < 5000   THEN '500-5k'
                WHEN amount < 50000  THEN '5k-50k'
                ELSE '50k+'
            END AS amount_band,
            EXTRACT(HOUR FROM timestamp) AS hour_of_day,
            EXTRACT(DOW FROM timestamp) AS day_of_week,
            failure_category,

            COUNT(*) AS total_txns,
            SUM(outcome) AS successful_txns,
            CASE WHEN COUNT(*) > 0
                 THEN SUM(outcome)::DOUBLE / COUNT(*)
                 ELSE 0 END AS sr,
            SUM(amount) AS total_gmv,
            SUM(CASE WHEN outcome = 1 THEN amount ELSE 0 END) AS successful_gmv,
            AVG(latency_ms) AS avg_latency_ms
        FROM transactions
        GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;
    """)

    conn.execute("DROP TABLE IF EXISTS merchant_daily_sr;")
    conn.execute("""
        CREATE TABLE merchant_daily_sr AS
        SELECT
            date, period, merchant_id,
            MAX(merchant_name) AS merchant_name,
            MAX(merchant_category) AS merchant_category,
            payment_gateway,
            COUNT(*) AS total_txns,
            SUM(outcome) AS successful_txns,
            CASE WHEN COUNT(*) > 0
                 THEN SUM(outcome)::DOUBLE / COUNT(*)
                 ELSE 0 END AS sr,
            SUM(amount) AS total_gmv,
            COUNT(DISTINCT issuing_bank) AS distinct_banks,
            COUNT(DISTINCT payment_mode) AS distinct_modes
        FROM transactions
        GROUP BY 1,2,3,6;
    """)

    conn.execute("DROP TABLE IF EXISTS daily_gateway_share;")
    conn.execute("""
        CREATE TABLE daily_gateway_share AS
        SELECT
            date, period, payment_gateway,
            COUNT(*) AS txns,
            COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY date, period) AS share_pct,
            CASE WHEN COUNT(*) > 0
                 THEN SUM(outcome)::DOUBLE / COUNT(*)
                 ELSE 0 END AS sr
        FROM transactions
        GROUP BY 1,2,3;
    """)


def get_data_status(conn: duckdb.DuckDBPyConnection) -> dict:
    """Return DB statistics: row counts, date ranges, periods loaded."""
    try:
        row = conn.execute("""
            SELECT
                COUNT(*) AS total_rows,
                COUNT(DISTINCT period) AS periods,
                MIN(date) AS min_date,
                MAX(date) AS max_date,
                SUM(CASE WHEN period='before' THEN 1 ELSE 0 END) AS before_count,
                SUM(CASE WHEN period='after'  THEN 1 ELSE 0 END) AS after_count,
                MIN(CASE WHEN period='before' THEN date END) AS before_start,
                MAX(CASE WHEN period='before' THEN date END) AS before_end,
                MIN(CASE WHEN period='after' THEN date END) AS after_start,
                MAX(CASE WHEN period='after' THEN date END) AS after_end,
                COUNT(DISTINCT payment_gateway) AS gateway_count,
                COUNT(DISTINCT merchant_id) AS merchant_count,
                COUNT(DISTINCT issuing_bank) AS bank_count
            FROM transactions;
        """).fetchone()
    except Exception:
        return {"total_rows": 0, "periods": [], "has_data": False}

    if row is None or row[0] == 0:
        return {"total_rows": 0, "periods": [], "has_data": False}

    periods = []
    if row[4] and row[4] > 0:
        periods.append("before")
    if row[5] and row[5] > 0:
        periods.append("after")

    return {
        "total_rows": row[0],
        "has_data": row[0] > 0,
        "periods": periods,
        "min_date": str(row[2]) if row[2] else None,
        "max_date": str(row[3]) if row[3] else None,
        "before_count": row[4] or 0,
        "after_count": row[5] or 0,
        "before_start": str(row[6]) if row[6] else None,
        "before_end": str(row[7]) if row[7] else None,
        "after_start": str(row[8]) if row[8] else None,
        "after_end": str(row[9]) if row[9] else None,
        "gateway_count": row[10] or 0,
        "merchant_count": row[11] or 0,
        "bank_count": row[12] or 0,
    }
