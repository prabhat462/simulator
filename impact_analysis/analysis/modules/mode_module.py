"""
Payment Mode Analysis Module — mode-level SR comparison, card network breakdown.
"""

from impact_analysis.analysis.base import BaseAnalysisModule
from impact_analysis.analysis.config import AnalysisConfig
from impact_analysis.analysis.stats import (
    two_proportion_z_test, significance_badge, sr_delta_pp
)
import duckdb


class ModeAnalysisModule(BaseAnalysisModule):
    name = "modes"

    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        pf = self._period_filter(config)

        # ── Mode-level SR comparison ──
        rows = conn.execute(f"""
            SELECT period, payment_mode,
                   SUM(total_txns) AS total_txns,
                   SUM(successful_txns) AS successful_txns,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr,
                   SUM(total_gmv) AS total_gmv
            FROM daily_cohort_sr
            WHERE {pf}
            GROUP BY period, payment_mode
            ORDER BY period, total_txns DESC;
        """).fetchall()

        modes = {}
        for r in rows:
            period, mode = r[0], r[1]
            if mode not in modes:
                modes[mode] = {}
            modes[mode][period] = {
                "total_txns": int(r[2]),
                "successful_txns": int(r[3]),
                "sr": round(r[4], 6),
                "total_gmv": round(r[5], 2),
            }

        mode_comparison = []
        for mode, periods in modes.items():
            before = periods.get("before", {"total_txns": 0, "successful_txns": 0, "sr": 0, "total_gmv": 0})
            after = periods.get("after", {"total_txns": 0, "successful_txns": 0, "sr": 0, "total_gmv": 0})

            test = two_proportion_z_test(
                before["successful_txns"], before["total_txns"],
                after["successful_txns"], after["total_txns"],
            )

            mode_comparison.append({
                "payment_mode": mode,
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

        mode_comparison.sort(key=lambda x: x["after_txns"], reverse=True)

        # ── Card network breakdown ──
        card_rows = conn.execute(f"""
            SELECT period, card_network,
                   SUM(total_txns) AS total_txns,
                   SUM(successful_txns) AS successful_txns,
                   CASE WHEN SUM(total_txns)>0
                        THEN SUM(successful_txns)::DOUBLE/SUM(total_txns)
                        ELSE 0 END AS sr
            FROM daily_cohort_sr
            WHERE {pf}
              AND card_network IS NOT NULL AND card_network != ''
            GROUP BY period, card_network
            ORDER BY period, total_txns DESC;
        """).fetchall()

        networks = {}
        for r in card_rows:
            period, net = r[0], r[1]
            if net not in networks:
                networks[net] = {}
            networks[net][period] = {
                "total_txns": int(r[2]),
                "successful_txns": int(r[3]),
                "sr": round(r[4], 6),
            }

        card_network_comparison = []
        for net, periods in networks.items():
            before = periods.get("before", {"total_txns": 0, "successful_txns": 0, "sr": 0})
            after = periods.get("after", {"total_txns": 0, "successful_txns": 0, "sr": 0})

            test = two_proportion_z_test(
                before["successful_txns"], before["total_txns"],
                after["successful_txns"], after["total_txns"],
            )

            card_network_comparison.append({
                "card_network": net,
                "before_sr": before["sr"],
                "after_sr": after["sr"],
                "sr_delta_pp": sr_delta_pp(before["sr"], after["sr"]),
                "before_txns": before["total_txns"],
                "after_txns": after["total_txns"],
                "p_value": test["p_value"],
                "significant": test["significant"],
            })

        return {
            "mode_comparison": mode_comparison,
            "card_network_comparison": card_network_comparison,
        }
