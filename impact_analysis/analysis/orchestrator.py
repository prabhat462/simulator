"""
Analysis Orchestrator — runs all analysis modules in parallel.
"""

import uuid
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from impact_analysis.analysis.config import AnalysisConfig
from impact_analysis.analysis.modules.global_module import GlobalAnalysisModule
from impact_analysis.analysis.modules.gateway_module import GatewayAnalysisModule
from impact_analysis.analysis.modules.mode_module import ModeAnalysisModule
from impact_analysis.analysis.modules.bank_module import BankAnalysisModule
from impact_analysis.analysis.modules.merchant_module import MerchantAnalysisModule
from impact_analysis.analysis.modules.temporal_module import TemporalAnalysisModule
from impact_analysis.analysis.modules.amount_module import AmountAnalysisModule
from impact_analysis.analysis.modules.failure_module import FailureAnalysisModule
from impact_analysis.database import get_connection
import duckdb


ALL_MODULES = [
    GlobalAnalysisModule,
    GatewayAnalysisModule,
    ModeAnalysisModule,
    BankAnalysisModule,
    MerchantAnalysisModule,
    TemporalAnalysisModule,
    AmountAnalysisModule,
    FailureAnalysisModule,
]


def run_analysis(config: AnalysisConfig) -> dict:
    """
    Execute all analysis modules and persist results.

    Returns a dict with run_id, config info, and all module results.
    """
    errors = config.validate()
    if errors:
        return {"success": False, "errors": errors}

    run_id = str(uuid.uuid4())[:12]
    conn = get_connection()

    # Save run as pending
    conn.execute("""
        INSERT INTO analysis_runs (run_id, baseline_start, baseline_end, algo_start, algo_end, status)
        VALUES (?, ?, ?, ?, ?, 'running')
    """, [run_id, str(config.baseline_start), str(config.baseline_end),
          str(config.algo_start), str(config.algo_end)])

    # Run all modules (using threads since DuckDB is in-process)
    results = {}
    module_errors = {}

    # DuckDB connections are not thread-safe, so we run sequentially
    # but each module is independent — this keeps it simple and correct
    for module_cls in ALL_MODULES:
        module = module_cls()
        try:
            module_conn = get_connection()
            results[module.name] = module.run(config, module_conn)
        except Exception as e:
            module_errors[module.name] = str(e)
            results[module.name] = {"error": str(e)}

    # Extract headline stats for the run record
    global_results = results.get("global", {})
    headline = global_results.get("headline", {})

    before = headline.get("before", {})
    after = headline.get("after", {})
    test = headline.get("test", {})

    # Update analysis run record
    try:
        result_json = json.dumps(results, default=str)
        conn.execute("""
            UPDATE analysis_runs SET
                status = 'completed',
                baseline_txn_count = ?,
                algo_txn_count = ?,
                baseline_sr = ?,
                algo_sr = ?,
                sr_uplift = ?,
                p_value = ?,
                is_significant = ?,
                result_json = ?
            WHERE run_id = ?
        """, [
            before.get("total_txns", 0),
            after.get("total_txns", 0),
            before.get("sr", 0),
            after.get("sr", 0),
            headline.get("sr_uplift_pp", 0),
            test.get("p_value", 1),
            test.get("significant", False),
            result_json,
            run_id,
        ])
    except Exception as e:
        module_errors["persistence"] = str(e)

    return {
        "success": True,
        "run_id": run_id,
        "config": {
            "baseline_start": str(config.baseline_start),
            "baseline_end": str(config.baseline_end),
            "algo_start": str(config.algo_start),
            "algo_end": str(config.algo_end),
        },
        "results": results,
        "errors": module_errors if module_errors else None,
    }


def get_analysis_results(run_id: str) -> dict | None:
    """Retrieve cached analysis results by run_id."""
    conn = get_connection()
    row = conn.execute("""
        SELECT run_id, created_at, baseline_start, baseline_end,
               algo_start, algo_end, baseline_txn_count, algo_txn_count,
               baseline_sr, algo_sr, sr_uplift, p_value, is_significant,
               status, result_json
        FROM analysis_runs WHERE run_id = ?
    """, [run_id]).fetchone()

    if not row:
        return None

    result = {
        "run_id": row[0],
        "created_at": str(row[1]),
        "config": {
            "baseline_start": str(row[2]),
            "baseline_end": str(row[3]),
            "algo_start": str(row[4]),
            "algo_end": str(row[5]),
        },
        "baseline_txn_count": row[6],
        "algo_txn_count": row[7],
        "baseline_sr": row[8],
        "algo_sr": row[9],
        "sr_uplift": row[10],
        "p_value": row[11],
        "is_significant": row[12],
        "status": row[13],
    }

    if row[14]:
        try:
            result["results"] = json.loads(row[14])
        except Exception:
            result["results"] = None

    return result


def get_analysis_history() -> list:
    """List all past analysis runs (summary only, no full results)."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT run_id, created_at, baseline_start, baseline_end,
               algo_start, algo_end, baseline_txn_count, algo_txn_count,
               baseline_sr, algo_sr, sr_uplift, p_value, is_significant, status
        FROM analysis_runs
        ORDER BY created_at DESC;
    """).fetchall()

    return [
        {
            "run_id": r[0],
            "created_at": str(r[1]),
            "baseline_start": str(r[2]),
            "baseline_end": str(r[3]),
            "algo_start": str(r[4]),
            "algo_end": str(r[5]),
            "baseline_txn_count": r[6],
            "algo_txn_count": r[7],
            "baseline_sr": r[8],
            "algo_sr": r[9],
            "sr_uplift": r[10],
            "p_value": r[11],
            "is_significant": r[12],
            "status": r[13],
        }
        for r in rows
    ]
