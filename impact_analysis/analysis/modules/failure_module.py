"""
Failure Analysis Module — failure category comparison, waterfall, per-gateway failures.
"""

from impact_analysis.analysis.base import BaseAnalysisModule
from impact_analysis.analysis.config import AnalysisConfig
import duckdb


class FailureAnalysisModule(BaseAnalysisModule):
    name = "failures"

    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        pf = self._period_filter(config)

        # ── Failure category comparison ──
        rows = conn.execute(f"""
            SELECT period, failure_category,
                   SUM(total_txns) - SUM(successful_txns) AS failed_txns,
                   SUM(total_txns) AS total_txns
            FROM daily_cohort_sr
            WHERE {pf}
              AND failure_category IS NOT NULL AND failure_category != ''
            GROUP BY period, failure_category
            ORDER BY period, failed_txns DESC;
        """).fetchall()

        # Get total failures per period for share calculation
        totals = {}
        for r in rows:
            period = r[0]
            if period not in totals:
                totals[period] = 0
            totals[period] += r[2]

        categories = {}
        for r in rows:
            period, cat = r[0], r[1]
            if cat not in categories:
                categories[cat] = {}
            total_period_failures = totals.get(period, 1)
            categories[cat][period] = {
                "failed_txns": int(r[2]),
                "share": round(r[2] / total_period_failures, 6) if total_period_failures > 0 else 0,
            }

        failure_comparison = []
        for cat, periods in categories.items():
            before = periods.get("before", {"failed_txns": 0, "share": 0})
            after = periods.get("after", {"failed_txns": 0, "share": 0})
            change = after["failed_txns"] - before["failed_txns"]
            pct_change = (change / before["failed_txns"] * 100) if before["failed_txns"] > 0 else 0

            failure_comparison.append({
                "failure_category": cat,
                "before_count": before["failed_txns"],
                "after_count": after["failed_txns"],
                "before_share": before["share"],
                "after_share": after["share"],
                "change": change,
                "pct_change": round(pct_change, 1),
                "improved": change < 0,
            })

        failure_comparison.sort(key=lambda x: abs(x["change"]), reverse=True)

        # ── Waterfall data ──
        total_before_failures = totals.get("before", 0)
        total_after_failures = totals.get("after", 0)

        waterfall = {
            "total_before_failures": total_before_failures,
            "total_after_failures": total_after_failures,
            "net_change": total_after_failures - total_before_failures,
            "net_pct_change": round(
                (total_after_failures - total_before_failures) / total_before_failures * 100, 1
            ) if total_before_failures > 0 else 0,
            "categories": failure_comparison,
        }

        # ── Per-gateway failure breakdown ──
        gw_rows = conn.execute(f"""
            SELECT period, payment_gateway, failure_category,
                   SUM(total_txns) - SUM(successful_txns) AS failed_txns
            FROM daily_cohort_sr
            WHERE {pf}
              AND failure_category IS NOT NULL AND failure_category != ''
            GROUP BY period, payment_gateway, failure_category
            ORDER BY period, payment_gateway, failed_txns DESC;
        """).fetchall()

        gateway_failures = [
            {"period": r[0], "gateway": r[1], "failure_category": r[2],
             "failed_txns": int(r[3])}
            for r in gw_rows
        ]

        # ── Failure rate by mode ──
        mode_rows = conn.execute(f"""
            SELECT period, payment_mode,
                   SUM(total_txns) AS total_txns,
                   SUM(total_txns) - SUM(successful_txns) AS failed_txns,
                   CASE WHEN SUM(total_txns)>0
                        THEN (SUM(total_txns) - SUM(successful_txns))::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS failure_rate
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period, payment_mode
            ORDER BY period, total_txns DESC;
        """).fetchall()

        failure_by_mode = [
            {"period": r[0], "payment_mode": r[1], "total_txns": int(r[2]),
             "failed_txns": int(r[3]), "failure_rate": round(r[4], 6)}
            for r in mode_rows
        ]

        return {
            "failure_comparison": failure_comparison,
            "waterfall": waterfall,
            "gateway_failures": gateway_failures,
            "failure_by_mode": failure_by_mode,
        }
