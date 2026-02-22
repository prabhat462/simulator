"""
Core simulation loop.
Replays transactions chronologically, calling algorithm select/update for each.
"""

import uuid
import time
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict

from algorithms.base import BaseAlgorithm, TransactionContext
from engine.evaluator import AlgorithmMetrics
from engine.counterfactual import CounterfactualEstimator
from engine.oracle import compute_oracle_sr, get_oracle_sr_for_context
from data.models import AlgorithmResult


@dataclass
class SimulationProgress:
    """Tracks simulation progress for live dashboard."""
    run_id: str
    status: str  # 'running' | 'completed' | 'cancelled' | 'error'
    total_transactions: int
    processed: int
    percent: float
    elapsed_seconds: float
    estimated_remaining: float
    throughput: float  # txn/sec
    current_metrics: Dict[str, Any]  # per-algorithm live metrics


class SimulationEngine:
    """
    Core simulation engine. Replays transactions through multiple algorithms
    simultaneously and collects metrics.
    """

    def __init__(self):
        self.runs: Dict[str, dict] = {}

    def run_simulation(
        self,
        run_id: str,
        df: pd.DataFrame,
        algorithm_instances: Dict[str, BaseAlgorithm],
        counterfactual_mode: str = "sr_interpolation",
        warm_up_transactions: int = 0,
        random_seed: int = 42,
        progress_callback: Optional[Callable] = None,
        cancel_check: Optional[Callable] = None,
    ) -> Dict[str, AlgorithmResult]:
        """
        Run simulation on the given dataset with specified algorithms.

        Args:
            run_id: Unique run identifier
            df: Transaction DataFrame (must be sorted by timestamp)
            algorithm_instances: Dict of {algo_id: initialized BaseAlgorithm instance}
            counterfactual_mode: 'direct_replay' | 'ips' | 'sr_interpolation'
            warm_up_transactions: Number of initial transactions for warm-up
            random_seed: For reproducibility
            progress_callback: Called every 500 transactions with SimulationProgress
            cancel_check: Returns True if simulation should be cancelled
        """
        rng = np.random.RandomState(random_seed)
        total = len(df)

        # Initialize counterfactual estimator
        cf_estimator = CounterfactualEstimator(mode=counterfactual_mode)
        cf_estimator.fit(df)

        # Compute oracle
        oracle = compute_oracle_sr(df)

        # Initialize metrics for each algorithm
        metrics: Dict[str, AlgorithmMetrics] = {}
        for algo_id, algo in algorithm_instances.items():
            meta = algo.metadata()
            metrics[algo_id] = AlgorithmMetrics(
                algorithm_id=algo_id,
                algorithm_name=meta.get("name", algo_id),
            )

        # Track progress
        start_time = time.time()
        gateways = sorted(df["payment_gateway"].unique().tolist())

        self.runs[run_id] = {
            "status": "running",
            "total": total,
            "processed": 0,
        }

        # ── Main simulation loop ──
        for idx, row in df.iterrows():
            # Check cancellation
            if cancel_check and cancel_check():
                self.runs[run_id]["status"] = "cancelled"
                break

            # Extract context
            context = TransactionContext(
                payment_mode=str(row.get("payment_mode", "upi")),
                card_network=row.get("card_network"),
                issuing_bank=str(row.get("issuing_bank", "UNKNOWN")),
                amount=float(row.get("amount", 0)),
                amount_band=_get_amount_band(float(row.get("amount", 0))),
                hour=int(row.get("hour", 12)),
                day_of_week=int(row.get("day_of_week", 0)),
                merchant_category=str(row.get("merchant_category", "ecomm")),
                device_type=row.get("device_type"),
                state=row.get("state"),
            )

            actual_gw = str(row["payment_gateway"])
            actual_outcome = int(row["outcome"])
            payment_mode = context.payment_mode
            issuing_bank = context.issuing_bank

            # Oracle SR for this context
            _, oracle_sr = get_oracle_sr_for_context(oracle, payment_mode, issuing_bank)

            context_dict = {
                "payment_mode": payment_mode,
                "issuing_bank": issuing_bank,
                "amount": context.amount,
            }

            # Run each algorithm
            for algo_id, algo in algorithm_instances.items():
                try:
                    # Algorithm selects a gateway
                    chosen_gw = algo.select(context)

                    # Estimate counterfactual outcome
                    predicted_outcome = cf_estimator.estimate_outcome(
                        chosen_gw=chosen_gw,
                        actual_gw=actual_gw,
                        actual_outcome=actual_outcome,
                        payment_mode=payment_mode,
                        issuing_bank=issuing_bank,
                        rng=rng,
                    )

                    # Skip if direct replay and different gateway
                    if predicted_outcome == -1:
                        # Still update with actual data for learning
                        algo.update(actual_gw, actual_outcome, context)
                        continue

                    # Update algorithm with feedback
                    algo.update(chosen_gw, predicted_outcome, context)

                    # Skip warm-up period for metrics
                    current_idx = int(idx) if isinstance(idx, (int, np.integer)) else self.runs[run_id]["processed"]
                    if current_idx < warm_up_transactions:
                        continue

                    # Record metrics
                    arm_state = None
                    if current_idx % 500 == 0:
                        try:
                            arm_state = algo.get_state()
                        except Exception:
                            pass

                    metrics[algo_id].record(
                        chosen_gw=chosen_gw,
                        outcome=predicted_outcome,
                        oracle_sr=oracle_sr,
                        context=context_dict,
                        arm_state=arm_state,
                    )
                except Exception as e:
                    # Algorithm exception — log and continue
                    print(f"[WARN] Algorithm {algo_id} error at txn {idx}: {e}")
                    continue

            # Progress callback
            self.runs[run_id]["processed"] = self.runs[run_id].get("processed", 0) + 1
            processed = self.runs[run_id]["processed"]

            if progress_callback and processed % 500 == 0:
                elapsed = time.time() - start_time
                throughput = processed / elapsed if elapsed > 0 else 0
                remaining = (total - processed) / throughput if throughput > 0 else 0

                current_algo_metrics = {}
                for aid, m in metrics.items():
                    current_algo_metrics[aid] = {
                        "sr": round(m.successes / m.total, 4) if m.total > 0 else 0,
                        "total": m.total,
                        "successes": m.successes,
                        "regret": round(m.cumulative_regret, 4),
                    }

                progress = SimulationProgress(
                    run_id=run_id,
                    status="running",
                    total_transactions=total,
                    processed=processed,
                    percent=round(processed / total * 100, 1),
                    elapsed_seconds=round(elapsed, 1),
                    estimated_remaining=round(remaining, 1),
                    throughput=round(throughput, 0),
                    current_metrics=current_algo_metrics,
                )
                progress_callback(progress)

        # ── Build final results ──
        self.runs[run_id]["status"] = "completed"
        results: Dict[str, AlgorithmResult] = {}
        for algo_id, m in metrics.items():
            results[algo_id] = m.to_result()

        return results


def _get_amount_band(amount: float) -> str:
    if amount <= 500:
        return "0-500"
    elif amount <= 5000:
        return "500-5k"
    elif amount <= 50000:
        return "5k-50k"
    else:
        return "50k+"
