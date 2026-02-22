"""
Merchant Analysis Module — leaderboard, category analysis, regression flagging.
"""

from impact_analysis.analysis.base import BaseAnalysisModule
from impact_analysis.analysis.config import AnalysisConfig
from impact_analysis.analysis.stats import (
    two_proportion_z_test, significance_badge, sr_delta_pp
)
import duckdb


class MerchantAnalysisModule(BaseAnalysisModule):
    name = "merchants"

    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        min_vol = config.min_merchant_volume

        # ── Merchant SR leaderboard ──
        rows = conn.execute(f"""
            SELECT
                m.merchant_id,
                MAX(m.merchant_name) AS merchant_name,
                MAX(m.merchant_category) AS merchant_category,
                SUM(CASE WHEN m.period='before' THEN m.total_txns ELSE 0 END) AS baseline_txns,
                SUM(CASE WHEN m.period='before' THEN m.successful_txns ELSE 0 END) AS baseline_successes,
                SUM(CASE WHEN m.period='after' THEN m.total_txns ELSE 0 END) AS algo_txns,
                SUM(CASE WHEN m.period='after' THEN m.successful_txns ELSE 0 END) AS algo_successes,
                SUM(CASE WHEN m.period='after' THEN m.total_gmv ELSE 0 END) AS algo_gmv
            FROM merchant_daily_sr m
            WHERE (m.period='before' AND m.date BETWEEN '{config.baseline_start}' AND '{config.baseline_end}')
               OR (m.period='after'  AND m.date BETWEEN '{config.algo_start}' AND '{config.algo_end}')
            GROUP BY m.merchant_id
            HAVING SUM(CASE WHEN m.period='after' THEN m.total_txns ELSE 0 END) >= {min_vol}
            ORDER BY (
                CASE WHEN SUM(CASE WHEN m.period='after' THEN m.total_txns ELSE 0 END) > 0
                     THEN SUM(CASE WHEN m.period='after' THEN m.successful_txns ELSE 0 END)::DOUBLE /
                          SUM(CASE WHEN m.period='after' THEN m.total_txns ELSE 0 END)
                     ELSE 0 END
                -
                CASE WHEN SUM(CASE WHEN m.period='before' THEN m.total_txns ELSE 0 END) > 0
                     THEN SUM(CASE WHEN m.period='before' THEN m.successful_txns ELSE 0 END)::DOUBLE /
                          SUM(CASE WHEN m.period='before' THEN m.total_txns ELSE 0 END)
                     ELSE 0 END
            ) DESC;
        """).fetchall()

        leaderboard = []
        regressions = []
        for r in rows:
            b_txns, b_succ = int(r[3]), int(r[4])
            a_txns, a_succ = int(r[5]), int(r[6])
            b_sr = b_succ / b_txns if b_txns > 0 else 0
            a_sr = a_succ / a_txns if a_txns > 0 else 0
            delta = sr_delta_pp(b_sr, a_sr)

            test = two_proportion_z_test(b_succ, b_txns, a_succ, a_txns)
            gmv_impact = delta / 100 * float(r[7]) if r[7] else 0

            # Status
            if b_txns < 100:
                status = "insufficient_data"
            elif test["significant"] and delta > 0:
                status = "improved"
            elif test["significant"] and delta < 0:
                status = "regression"
            else:
                status = "no_change"

            entry = {
                "merchant_id": r[0],
                "merchant_name": r[1] or r[0],
                "merchant_category": r[2] or "Unknown",
                "before_sr": round(b_sr, 6),
                "after_sr": round(a_sr, 6),
                "sr_delta_pp": delta,
                "before_txns": b_txns,
                "after_txns": a_txns,
                "gmv_impact": round(gmv_impact, 2),
                "p_value": test["p_value"],
                "significant": test["significant"],
                "badge": significance_badge(test["p_value"]),
                "status": status,
            }
            leaderboard.append(entry)
            if status == "regression":
                regressions.append(entry)

        # ── Category aggregate ──
        cat_rows = conn.execute(f"""
            SELECT
                MAX(m.merchant_category) AS category,
                COUNT(DISTINCT m.merchant_id) AS merchant_count,
                SUM(CASE WHEN m.period='before' THEN m.total_txns ELSE 0 END) AS b_txns,
                SUM(CASE WHEN m.period='before' THEN m.successful_txns ELSE 0 END) AS b_succ,
                SUM(CASE WHEN m.period='after' THEN m.total_txns ELSE 0 END) AS a_txns,
                SUM(CASE WHEN m.period='after' THEN m.successful_txns ELSE 0 END) AS a_succ,
                SUM(CASE WHEN m.period='after' THEN m.total_gmv ELSE 0 END) AS a_gmv
            FROM merchant_daily_sr m
            WHERE (m.period='before' AND m.date BETWEEN '{config.baseline_start}' AND '{config.baseline_end}')
               OR (m.period='after'  AND m.date BETWEEN '{config.algo_start}' AND '{config.algo_end}')
            GROUP BY m.merchant_category
            HAVING SUM(m.total_txns) > 0
            ORDER BY SUM(m.total_txns) DESC;
        """).fetchall()

        categories = []
        for r in cat_rows:
            b_txns, b_succ = int(r[2]), int(r[3])
            a_txns, a_succ = int(r[4]), int(r[5])
            b_sr = b_succ / b_txns if b_txns > 0 else 0
            a_sr = a_succ / a_txns if a_txns > 0 else 0
            delta = sr_delta_pp(b_sr, a_sr)

            categories.append({
                "category": r[0] or "Unknown",
                "merchant_count": int(r[1]),
                "before_sr": round(b_sr, 6),
                "after_sr": round(a_sr, 6),
                "sr_delta_pp": delta,
                "gmv_impact": round(delta / 100 * float(r[6]), 2) if r[6] else 0,
            })

        return {
            "leaderboard": leaderboard,
            "regressions": regressions,
            "regression_count": len(regressions),
            "categories": categories,
            "total_merchants": len(leaderboard),
        }
