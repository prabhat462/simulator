"""
Bank & Issuer Analysis Module — bank SR ranking, bank×mode heatmap.
"""

from impact_analysis.analysis.base import BaseAnalysisModule
from impact_analysis.analysis.config import AnalysisConfig
from impact_analysis.analysis.stats import (
    two_proportion_z_test, significance_badge, sr_delta_pp
)
import duckdb


class BankAnalysisModule(BaseAnalysisModule):
    name = "banks"

    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        pf = self._period_filter(config)

        # ── Bank SR ranking (top 30 by volume) ──
        rows = conn.execute(f"""
            WITH bank_data AS (
                SELECT period, issuing_bank,
                       SUM(total_txns) AS total_txns,
                       SUM(successful_txns) AS successful_txns,
                       CASE WHEN SUM(total_txns)>0
                            THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                            ELSE 0 END AS sr,
                       SUM(total_gmv) AS total_gmv
                FROM daily_cohort_sr
                WHERE {pf}
                GROUP BY period, issuing_bank
            ),
            top_banks AS (
                SELECT issuing_bank, SUM(total_txns) AS vol
                FROM bank_data GROUP BY issuing_bank
                ORDER BY vol DESC LIMIT 30
            )
            SELECT bd.* FROM bank_data bd
            JOIN top_banks tb ON bd.issuing_bank = tb.issuing_bank
            ORDER BY tb.vol DESC, bd.period;
        """).fetchall()

        banks = {}
        for r in rows:
            period, bank = r[0], r[1]
            if bank not in banks:
                banks[bank] = {}
            banks[bank][period] = {
                "total_txns": int(r[2]),
                "successful_txns": int(r[3]),
                "sr": round(r[4], 6),
                "total_gmv": round(r[5], 2),
            }

        bank_comparison = []
        for bank, periods in banks.items():
            before = periods.get("before", {"total_txns": 0, "successful_txns": 0, "sr": 0, "total_gmv": 0})
            after = periods.get("after", {"total_txns": 0, "successful_txns": 0, "sr": 0, "total_gmv": 0})

            test = two_proportion_z_test(
                before["successful_txns"], before["total_txns"],
                after["successful_txns"], after["total_txns"],
            )

            delta = sr_delta_pp(before["sr"], after["sr"])
            gmv_impact = delta / 100 * after["total_gmv"] if after["total_gmv"] else 0

            bank_comparison.append({
                "bank": bank,
                "before_sr": before["sr"],
                "after_sr": after["sr"],
                "sr_delta_pp": delta,
                "before_txns": before["total_txns"],
                "after_txns": after["total_txns"],
                "gmv_impact": round(gmv_impact, 2),
                "p_value": test["p_value"],
                "significant": test["significant"],
                "badge": significance_badge(test["p_value"]),
            })

        bank_comparison.sort(key=lambda x: x["before_txns"] + x["after_txns"], reverse=True)

        # ── Bank × Mode heatmap ──
        heatmap_rows = conn.execute(f"""
            WITH top_banks AS (
                SELECT issuing_bank, SUM(total_txns) AS vol
                FROM daily_cohort_sr WHERE {pf}
                GROUP BY issuing_bank
                ORDER BY vol DESC LIMIT 20
            )
            SELECT d.period, d.issuing_bank, d.payment_mode,
                   SUM(d.total_txns) AS txns,
                   SUM(d.successful_txns) AS successes,
                   CASE WHEN SUM(d.total_txns)>0
                        THEN SUM(d.successful_txns)::DOUBLE/SUM(d.total_txns)
                        ELSE 0 END AS sr
            FROM daily_cohort_sr d
            JOIN top_banks tb ON d.issuing_bank = tb.issuing_bank
            WHERE {pf}
            GROUP BY d.period, d.issuing_bank, d.payment_mode
            ORDER BY tb.vol DESC, d.payment_mode;
        """).fetchall()

        heatmap = [
            {"period": r[0], "bank": r[1], "mode": r[2],
             "txns": int(r[3]), "successes": int(r[4]), "sr": round(r[5], 6)}
            for r in heatmap_rows
        ]

        return {
            "bank_comparison": bank_comparison,
            "bank_mode_heatmap": heatmap,
        }
