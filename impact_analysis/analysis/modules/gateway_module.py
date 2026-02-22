"""
Gateway Analysis Module — routing share shift, per-PG SR, preference matrix.
"""

from impact_analysis.analysis.base import BaseAnalysisModule
from impact_analysis.analysis.config import AnalysisConfig
from impact_analysis.analysis.stats import (
    two_proportion_z_test, proportion_confidence_interval, significance_badge, sr_delta_pp
)
import duckdb


class GatewayAnalysisModule(BaseAnalysisModule):
    name = "gateways"

    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        pf = self._period_filter(config)

        # ── Gateway routing share + SR ──
        rows = conn.execute(f"""
            SELECT
                period, payment_gateway,
                SUM(total_txns) AS total_txns,
                SUM(successful_txns) AS successful_txns,
                SUM(total_txns)::DOUBLE / SUM(SUM(total_txns)) OVER (PARTITION BY period) AS share,
                CASE WHEN SUM(total_txns)>0
                     THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                     ELSE 0 END AS sr,
                SUM(total_gmv) AS total_gmv
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period, payment_gateway
            ORDER BY period, total_txns DESC;
        """).fetchall()

        # Organize by gateway
        gateways = {}
        for r in rows:
            period, pg = r[0], r[1]
            if pg not in gateways:
                gateways[pg] = {}
            gateways[pg][period] = {
                "total_txns": int(r[2]),
                "successful_txns": int(r[3]),
                "share": round(r[4], 6),
                "sr": round(r[5], 6),
                "total_gmv": round(r[6], 2),
            }

        # Compute comparisons
        gateway_comparison = []
        for pg, periods in gateways.items():
            before = periods.get("before", {"total_txns": 0, "successful_txns": 0, "share": 0, "sr": 0, "total_gmv": 0})
            after = periods.get("after", {"total_txns": 0, "successful_txns": 0, "share": 0, "sr": 0, "total_gmv": 0})

            test = two_proportion_z_test(
                before["successful_txns"], before["total_txns"],
                after["successful_txns"], after["total_txns"],
            )

            gateway_comparison.append({
                "gateway": pg,
                "before_share": before["share"],
                "after_share": after["share"],
                "share_delta": round(after["share"] - before["share"], 6),
                "before_sr": before["sr"],
                "after_sr": after["sr"],
                "sr_delta_pp": sr_delta_pp(before["sr"], after["sr"]),
                "before_txns": before["total_txns"],
                "after_txns": after["total_txns"],
                "before_gmv": before["total_gmv"],
                "after_gmv": after["total_gmv"],
                "p_value": test["p_value"],
                "significant": test["significant"],
                "badge": significance_badge(test["p_value"]),
            })

        gateway_comparison.sort(key=lambda x: x["after_txns"], reverse=True)

        # ── Gateway preference matrix (mode × gateway) ──
        pref = conn.execute(f"""
            SELECT period, payment_mode, payment_gateway,
                   SUM(total_txns) AS txns,
                   SUM(total_txns)::DOUBLE /
                     SUM(SUM(total_txns)) OVER (PARTITION BY period, payment_mode) AS share
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period, payment_mode, payment_gateway
            ORDER BY period, payment_mode, txns DESC;
        """).fetchall()

        preference_matrix = [
            {"period": r[0], "payment_mode": r[1], "gateway": r[2],
             "txns": int(r[3]), "share": round(r[4], 6)}
            for r in pref
        ]

        return {
            "gateway_comparison": gateway_comparison,
            "preference_matrix": preference_matrix,
        }
