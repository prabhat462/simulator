"""
Amount Band Analysis Module — amount band SR comparison, GMV-weighted SR.
"""

from impact_analysis.analysis.base import BaseAnalysisModule
from impact_analysis.analysis.config import AnalysisConfig
from impact_analysis.analysis.stats import (
    two_proportion_z_test, significance_badge, sr_delta_pp
)
import duckdb


class AmountAnalysisModule(BaseAnalysisModule):
    name = "amounts"

    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        pf = self._period_filter(config)

        # ── Amount band SR comparison ──
        rows = conn.execute(f"""
            SELECT period, amount_band,
                   SUM(total_txns) AS total_txns,
                   SUM(successful_txns) AS successful_txns,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr,
                   SUM(total_gmv) AS total_gmv,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(total_gmv)/SUM(total_txns)
                        ELSE 0 END AS avg_amount
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period, amount_band
            ORDER BY period,
                CASE amount_band
                    WHEN '0-500' THEN 1
                    WHEN '500-5k' THEN 2
                    WHEN '5k-50k' THEN 3
                    WHEN '50k+' THEN 4
                    ELSE 5
                END;
        """).fetchall()

        bands = {}
        for r in rows:
            period, band = r[0], r[1]
            if band not in bands:
                bands[band] = {}
            bands[band][period] = {
                "total_txns": int(r[2]),
                "successful_txns": int(r[3]),
                "sr": round(r[4], 6),
                "total_gmv": round(r[5], 2),
                "avg_amount": round(r[6], 2),
            }

        amount_comparison = []
        band_order = ["0-500", "500-5k", "5k-50k", "50k+"]
        for band in band_order:
            if band not in bands:
                continue
            before = bands[band].get("before", {"total_txns": 0, "successful_txns": 0, "sr": 0, "total_gmv": 0, "avg_amount": 0})
            after = bands[band].get("after", {"total_txns": 0, "successful_txns": 0, "sr": 0, "total_gmv": 0, "avg_amount": 0})

            test = two_proportion_z_test(
                before["successful_txns"], before["total_txns"],
                after["successful_txns"], after["total_txns"],
            )

            amount_comparison.append({
                "amount_band": band,
                "before_sr": before["sr"],
                "after_sr": after["sr"],
                "sr_delta_pp": sr_delta_pp(before["sr"], after["sr"]),
                "before_txns": before["total_txns"],
                "after_txns": after["total_txns"],
                "before_avg_amount": before["avg_amount"],
                "after_avg_amount": after["avg_amount"],
                "p_value": test["p_value"],
                "significant": test["significant"],
                "badge": significance_badge(test["p_value"]),
            })

        # ── GMV-weighted SR ──
        gmv_weighted = conn.execute(f"""
            SELECT period,
                   CASE WHEN SUM(total_gmv) > 0
                        THEN SUM(successful_gmv)::DOUBLE / SUM(total_gmv)
                        ELSE 0 END AS gmv_weighted_sr
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period;
        """).fetchall()

        gmv_weighted_sr = {}
        for r in gmv_weighted:
            gmv_weighted_sr[r[0]] = round(r[1], 6)

        return {
            "amount_comparison": amount_comparison,
            "gmv_weighted_sr": gmv_weighted_sr,
        }
