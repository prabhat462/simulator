"""
Report generator — produces structured JSON report with all sections.
"""

from typing import Dict, List, Any
from datetime import datetime
from reporting.stats import compare_success_rates
from reporting.gmv_calculator import calculate_gmv_impact
from dataclasses import asdict


def generate_report(
    run_id: str,
    run_name: str,
    dataset_stats: dict,
    algorithm_results: Dict[str, Any],
    simulation_config: dict,
) -> Dict:
    """
    Generate a comprehensive simulation report.
    Returns a structured dict with all 12 report sections.
    """
    results_list = list(algorithm_results.values())
    algo_ids = list(algorithm_results.keys())

    # Find baseline (Round Robin) and best algorithm
    baseline_id = None
    best_id = None
    best_sr = -1

    for aid, result in algorithm_results.items():
        r = result if isinstance(result, dict) else asdict(result)
        sr = r.get("overall_sr", 0)
        if "round_robin" in aid.lower() or "rr" in aid.lower():
            baseline_id = aid
        if sr > best_sr:
            best_sr = sr
            best_id = aid

    if baseline_id is None:
        baseline_id = algo_ids[0]

    baseline_result = algorithm_results[baseline_id]
    best_result = algorithm_results[best_id]
    br = baseline_result if isinstance(baseline_result, dict) else asdict(baseline_result)
    bst = best_result if isinstance(best_result, dict) else asdict(best_result)

    sr_uplift = bst.get("overall_sr", 0) - br.get("overall_sr", 0)

    # ── Section 1: Executive Summary ──
    executive_summary = {
        "recommended_algorithm": bst.get("algorithm_name", best_id),
        "recommended_algorithm_id": best_id,
        "overall_sr": bst.get("overall_sr", 0),
        "sr_uplift_vs_baseline": round(sr_uplift, 4),
        "baseline_algorithm": br.get("algorithm_name", baseline_id),
        "baseline_sr": br.get("overall_sr", 0),
        "rationale": (
            f"{bst.get('algorithm_name', best_id)} achieved the highest overall success rate "
            f"of {bst.get('overall_sr', 0):.2%}, which is {sr_uplift:+.2%} vs "
            f"{br.get('algorithm_name', baseline_id)} baseline ({br.get('overall_sr', 0):.2%})."
        ),
    }

    # ── Section 2: Configuration ──
    configuration = {
        "run_id": run_id,
        "run_name": run_name,
        "counterfactual_mode": simulation_config.get("counterfactual_mode", "sr_interpolation"),
        "random_seed": simulation_config.get("random_seed", 42),
        "warm_up_transactions": simulation_config.get("warm_up_transactions", 0),
        "algorithms": simulation_config.get("algorithms", []),
    }

    # ── Section 3: Dataset Statistics ──
    dataset_section = dataset_stats

    # ── Section 4: Results Summary ──
    results_summary = []
    for aid, result in algorithm_results.items():
        r = result if isinstance(result, dict) else asdict(result)
        results_summary.append({
            "algorithm_id": aid,
            "algorithm_name": r.get("algorithm_name", aid),
            "overall_sr": r.get("overall_sr", 0),
            "sr_confidence_interval": r.get("sr_confidence_interval", (0, 0)),
            "cumulative_regret": r.get("cumulative_regret", 0),
            "exploration_ratio": r.get("exploration_ratio", 0),
            "total_transactions": r.get("total_transactions", 0),
            "total_successes": r.get("total_successes", 0),
        })

    # Sort by SR descending
    results_summary.sort(key=lambda x: x["overall_sr"], reverse=True)

    # ── Section 10: Statistical Significance ──
    significance_tests = []
    for i in range(len(algo_ids)):
        for j in range(i + 1, len(algo_ids)):
            r_i = algorithm_results[algo_ids[i]]
            r_j = algorithm_results[algo_ids[j]]
            ri = r_i if isinstance(r_i, dict) else asdict(r_i)
            rj = r_j if isinstance(r_j, dict) else asdict(r_j)

            test = compare_success_rates(
                ri.get("total_successes", 0), ri.get("total_transactions", 1),
                rj.get("total_successes", 0), rj.get("total_transactions", 1),
            )
            test["algorithm_a"] = ri.get("algorithm_name", algo_ids[i])
            test["algorithm_b"] = rj.get("algorithm_name", algo_ids[j])
            significance_tests.append(test)

    # ── Section 11: GMV Impact ──
    avg_txn_value = 2500  # default
    monthly_volume = dataset_stats.get("total_transactions", 0) if isinstance(dataset_stats, dict) else 100000
    gmv_impact = calculate_gmv_impact(
        sr_uplift=max(sr_uplift, 0),
        monthly_volume=monthly_volume,
        avg_transaction_value=avg_txn_value,
    )

    report = {
        "report_version": "1.0",
        "generated_at": datetime.now().isoformat(),
        "sections": {
            "1_executive_summary": executive_summary,
            "2_configuration": configuration,
            "3_dataset_statistics": dataset_section,
            "4_results_summary": results_summary,
            "5_sr_charts": {
                "note": "Chart data available in per-algorithm sr_over_time arrays"
            },
            "6_regret_analysis": {
                "note": "Regret data available in per-algorithm regret_over_time arrays"
            },
            "7_segment_performance": {
                aid: {
                    "sr_by_gateway": (r if isinstance(r, dict) else asdict(r)).get("sr_by_gateway", {}),
                    "sr_by_mode": (r if isinstance(r, dict) else asdict(r)).get("sr_by_mode", {}),
                    "sr_by_bank": (r if isinstance(r, dict) else asdict(r)).get("sr_by_bank", {}),
                }
                for aid, r in algorithm_results.items()
            },
            "8_gateway_analysis": {
                aid: (r if isinstance(r, dict) else asdict(r)).get("sr_by_gateway", {})
                for aid, r in algorithm_results.items()
            },
            "9_algorithm_transparency": {
                "note": "Algorithm formulas and hyperparameters in configuration section"
            },
            "10_statistical_significance": significance_tests,
            "11_gmv_impact": gmv_impact,
            "12_appendix": {
                "reproduction_config": configuration,
            },
        },
    }

    return report
