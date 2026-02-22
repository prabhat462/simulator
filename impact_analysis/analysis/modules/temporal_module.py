"""
Temporal Analysis Module — hour×day heatmap, intraday SR, day-of-week, volatility.
"""

from impact_analysis.analysis.base import BaseAnalysisModule
from impact_analysis.analysis.config import AnalysisConfig
import duckdb
import math


class TemporalAnalysisModule(BaseAnalysisModule):
    name = "temporal"

    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        pf = self._period_filter(config)

        # ── Hour × Day-of-Week SR heatmap ──
        heatmap_rows = conn.execute(f"""
            SELECT period, day_of_week, hour_of_day,
                   SUM(total_txns) AS txns,
                   SUM(successful_txns) AS successes,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr
            FROM daily_cohort_sr
            WHERE {pf}
              AND hour_of_day IS NOT NULL AND day_of_week IS NOT NULL
            GROUP BY period, day_of_week, hour_of_day
            ORDER BY period, day_of_week, hour_of_day;
        """).fetchall()

        heatmap = [
            {"period": r[0], "day_of_week": int(r[1]) if r[1] is not None else 0,
             "hour": int(r[2]) if r[2] is not None else 0,
             "txns": int(r[3]), "sr": round(r[4], 6)}
            for r in heatmap_rows
        ]

        # ── Intraday SR trend (average SR by hour) ──
        hourly = conn.execute(f"""
            SELECT period, hour_of_day,
                   SUM(total_txns) AS txns,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr
            FROM daily_cohort_sr
            WHERE {pf}
              AND hour_of_day IS NOT NULL
            GROUP BY period, hour_of_day
            ORDER BY period, hour_of_day;
        """).fetchall()

        intraday = [
            {"period": r[0], "hour": int(r[1]) if r[1] is not None else 0,
             "txns": int(r[2]), "sr": round(r[3], 6)}
            for r in hourly
        ]

        # ── Day-of-week comparison ──
        dow = conn.execute(f"""
            SELECT period, day_of_week,
                   SUM(total_txns) AS txns,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr
            FROM daily_cohort_sr
            WHERE {pf}
              AND day_of_week IS NOT NULL
            GROUP BY period, day_of_week
            ORDER BY period, day_of_week;
        """).fetchall()

        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        day_of_week = [
            {"period": r[0], "day_of_week": int(r[1]) if r[1] is not None else 0,
             "day_name": day_names[int(r[1]) % 7] if r[1] is not None else "Unknown",
             "txns": int(r[2]), "sr": round(r[3], 6)}
            for r in dow
        ]

        # ── SR volatility (std dev of daily SR) ──
        daily_sr = conn.execute(f"""
            SELECT period, date,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period, date
            ORDER BY period, date;
        """).fetchall()

        sr_by_period = {}
        for r in daily_sr:
            period = r[0]
            if period not in sr_by_period:
                sr_by_period[period] = []
            sr_by_period[period].append(r[2])

        volatility = {}
        for period, srs in sr_by_period.items():
            if len(srs) > 1:
                mean = sum(srs) / len(srs)
                var = sum((s - mean) ** 2 for s in srs) / (len(srs) - 1)
                std = math.sqrt(var)
            else:
                mean = srs[0] if srs else 0
                std = 0
            volatility[period] = {
                "mean_sr": round(mean, 6),
                "std_sr": round(std, 6),
                "days": len(srs),
            }

        return {
            "heatmap": heatmap,
            "intraday": intraday,
            "day_of_week": day_of_week,
            "volatility": volatility,
        }
