"""
Global Analysis Module — headline SR metrics, daily trend, traffic mix, GMV impact.
"""

from impact_analysis.analysis.base import BaseAnalysisModule
from impact_analysis.analysis.config import AnalysisConfig
from impact_analysis.analysis.stats import (
    two_proportion_z_test, proportion_confidence_interval,
    cohens_h, effect_size_label, significance_badge, sr_delta_pp
)
import duckdb


class GlobalAnalysisModule(BaseAnalysisModule):
    name = "global"

    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        pf = self._period_filter(config)

        # ── Headline metrics ──
        rows = conn.execute(f"""
            SELECT
                period,
                SUM(total_txns) AS total_txns,
                SUM(successful_txns) AS successful_txns,
                CASE WHEN SUM(total_txns) > 0
                     THEN SUM(successful_txns)::DOUBLE / SUM(total_txns)
                     ELSE 0 END AS sr,
                SUM(total_gmv) AS total_gmv,
                SUM(successful_gmv) AS successful_gmv,
                AVG(avg_latency_ms) AS avg_latency
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period;
        """).fetchall()

        metrics = {}
        for row in rows:
            period = row[0]
            metrics[period] = {
                "total_txns": int(row[1]),
                "successful_txns": int(row[2]),
                "sr": round(row[3], 6),
                "total_gmv": round(row[4], 2),
                "successful_gmv": round(row[5], 2),
                "avg_latency": round(row[6], 1) if row[6] else None,
            }

        before = metrics.get("before", {"sr": 0, "total_txns": 0, "successful_txns": 0, "total_gmv": 0, "successful_gmv": 0, "avg_latency": None})
        after = metrics.get("after", {"sr": 0, "total_txns": 0, "successful_txns": 0, "total_gmv": 0, "successful_gmv": 0, "avg_latency": None})

        # Statistical test
        test = two_proportion_z_test(
            before["successful_txns"], before["total_txns"],
            after["successful_txns"], after["total_txns"],
        )
        before_ci = proportion_confidence_interval(before["successful_txns"], before["total_txns"])
        after_ci = proportion_confidence_interval(after["successful_txns"], after["total_txns"])
        h = cohens_h(max(before["sr"], 0.001), max(after["sr"], 0.001))

        sr_uplift = sr_delta_pp(before["sr"], after["sr"])
        gmv_saved = sr_uplift / 100 * after["total_gmv"] if after["total_gmv"] else 0

        # Verdict
        if test["p_value"] >= 0.05:
            if before["total_txns"] < 100 or after["total_txns"] < 100:
                verdict = "insufficient_data"
            else:
                verdict = "not_working" if sr_uplift < 0 else "not_significant"
        elif sr_uplift > 0:
            verdict = "working"
        else:
            verdict = "not_working"

        headline = {
            "before": before,
            "after": after,
            "sr_uplift_pp": sr_uplift,
            "before_ci": before_ci,
            "after_ci": after_ci,
            "test": test,
            "cohens_h": h,
            "effect_size": effect_size_label(h),
            "badge": significance_badge(test["p_value"]),
            "gmv_saved": round(gmv_saved, 2),
            "verdict": verdict,
        }

        # ── Daily SR trend ──
        daily = conn.execute(f"""
            SELECT date, period,
                   SUM(total_txns) AS txns,
                   SUM(successful_txns) AS successes,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY date, period
            ORDER BY date;
        """).fetchall()

        daily_trend = [
            {"date": str(r[0]), "period": r[1], "txns": int(r[2]),
             "successes": int(r[3]), "sr": round(r[4], 6)}
            for r in daily
        ]

        # ── Traffic mix (payment mode distribution) ──
        mix = conn.execute(f"""
            SELECT period, payment_mode,
                   SUM(total_txns) AS txns,
                   SUM(total_txns)::DOUBLE / SUM(SUM(total_txns)) OVER (PARTITION BY period) AS share
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period, payment_mode
            ORDER BY period, txns DESC;
        """).fetchall()

        traffic_mix = [
            {"period": r[0], "payment_mode": r[1], "txns": int(r[2]),
             "share": round(r[3], 6)}
            for r in mix
        ]

        # ── Mix-adjusted SR ──
        try:
            mix_adj = conn.execute(f"""
                WITH baseline_shares AS (
                    SELECT payment_mode, issuing_bank, amount_band,
                           SUM(total_txns) AS cohort_txns,
                           SUM(total_txns)::DOUBLE / SUM(SUM(total_txns)) OVER () AS share
                    FROM daily_cohort_sr
                    WHERE period = 'before' AND date BETWEEN '{config.baseline_start}' AND '{config.baseline_end}'
                    GROUP BY payment_mode, issuing_bank, amount_band
                ),
                algo_sr AS (
                    SELECT payment_mode, issuing_bank, amount_band,
                           SUM(successful_txns)::DOUBLE / NULLIF(SUM(total_txns), 0) AS cohort_sr
                    FROM daily_cohort_sr
                    WHERE period = 'after' AND date BETWEEN '{config.algo_start}' AND '{config.algo_end}'
                    GROUP BY payment_mode, issuing_bank, amount_band
                )
                SELECT ROUND(SUM(b.share * a.cohort_sr), 6) AS mix_adjusted_sr
                FROM baseline_shares b
                JOIN algo_sr a USING (payment_mode, issuing_bank, amount_band);
            """).fetchone()
            mix_adjusted_sr = mix_adj[0] if mix_adj and mix_adj[0] else after["sr"]
        except Exception:
            mix_adjusted_sr = after["sr"]

        # ── GMV waterfall by mode ──
        gmv_by_mode = conn.execute(f"""
            SELECT period, payment_mode,
                   SUM(total_gmv) AS gmv,
                   SUM(successful_gmv) AS successful_gmv,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period, payment_mode
            ORDER BY period, gmv DESC;
        """).fetchall()

        gmv_waterfall = [
            {"period": r[0], "payment_mode": r[1], "gmv": round(r[2], 2),
             "successful_gmv": round(r[3], 2), "sr": round(r[4], 6)}
            for r in gmv_by_mode
        ]

        return {
            "headline": headline,
            "daily_trend": daily_trend,
            "traffic_mix": traffic_mix,
            "mix_adjusted_sr": round(mix_adjusted_sr, 6) if mix_adjusted_sr else None,
            "gmv_waterfall": gmv_waterfall,
        }
