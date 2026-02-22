"""
Metrics accumulation and evaluation for simulation results.
"""

import numpy as np
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from data.models import AlgorithmResult


@dataclass
class AlgorithmMetrics:
    """Tracks metrics for a single algorithm during simulation."""
    algorithm_id: str
    algorithm_name: str
    total: int = 0
    successes: int = 0
    exploration_count: int = 0
    cumulative_regret: float = 0.0

    # Time series (sampled)
    sr_over_time: list = field(default_factory=list)
    regret_over_time: list = field(default_factory=list)

    # Segment tracking
    gw_successes: dict = field(default_factory=dict)
    gw_counts: dict = field(default_factory=dict)
    mode_successes: dict = field(default_factory=dict)
    mode_counts: dict = field(default_factory=dict)
    bank_successes: dict = field(default_factory=dict)
    bank_counts: dict = field(default_factory=dict)

    # Decision log
    decisions: list = field(default_factory=list)
    arm_state_snapshots: list = field(default_factory=list)

    # Snapshot interval
    _snapshot_interval: int = 500

    def record(
        self,
        chosen_gw: str,
        outcome: int,
        oracle_sr: float,
        context: dict,
        was_exploration: bool = False,
        arm_state: Optional[dict] = None,
    ):
        self.total += 1
        if outcome == 1:
            self.successes += 1
        if was_exploration:
            self.exploration_count += 1

        # Regret
        actual_sr = outcome  # 0 or 1 per transaction
        self.cumulative_regret += (oracle_sr - actual_sr)

        # Time series (sample every 100 transactions)
        if self.total % 100 == 0:
            current_sr = self.successes / self.total if self.total > 0 else 0
            self.sr_over_time.append(round(current_sr, 4))
            self.regret_over_time.append(round(self.cumulative_regret, 4))

        # Gateway-level
        gw = chosen_gw
        self.gw_counts[gw] = self.gw_counts.get(gw, 0) + 1
        self.gw_successes[gw] = self.gw_successes.get(gw, 0) + outcome

        # Mode-level
        mode = context.get("payment_mode", "unknown")
        self.mode_counts[mode] = self.mode_counts.get(mode, 0) + 1
        self.mode_successes[mode] = self.mode_successes.get(mode, 0) + outcome

        # Bank-level
        bank = context.get("issuing_bank", "unknown")
        self.bank_counts[bank] = self.bank_counts.get(bank, 0) + 1
        self.bank_successes[bank] = self.bank_successes.get(bank, 0) + outcome

        # Decision log (keep last 200)
        if len(self.decisions) < 200 or self.total % max(self.total // 200, 1) == 0:
            self.decisions.append({
                "transaction_idx": self.total,
                "chosen_gw": chosen_gw,
                "outcome": outcome,
                "payment_mode": mode,
                "issuing_bank": bank,
                "amount": context.get("amount", 0),
            })
            if len(self.decisions) > 500:
                self.decisions = self.decisions[-200:]

        # Arm state snapshots
        if arm_state and self.total % self._snapshot_interval == 0:
            self.arm_state_snapshots.append({
                "transaction_idx": self.total,
                "state": arm_state,
            })

    def to_result(self) -> AlgorithmResult:
        """Convert accumulated metrics to final AlgorithmResult."""
        overall_sr = self.successes / self.total if self.total > 0 else 0

        # 95% CI for SR
        if self.total > 0:
            se = np.sqrt(overall_sr * (1 - overall_sr) / self.total)
            ci = (round(overall_sr - 1.96 * se, 4), round(overall_sr + 1.96 * se, 4))
        else:
            ci = (0, 0)

        sr_by_gw = {
            gw: round(self.gw_successes.get(gw, 0) / cnt, 4) if cnt > 0 else 0
            for gw, cnt in self.gw_counts.items()
        }
        sr_by_mode = {
            mode: {
                "sr": round(self.mode_successes.get(mode, 0) / cnt, 4) if cnt > 0 else 0,
                "volume": cnt,
            }
            for mode, cnt in self.mode_counts.items()
        }
        sr_by_bank = {
            bank: {
                "sr": round(self.bank_successes.get(bank, 0) / cnt, 4) if cnt > 0 else 0,
                "volume": cnt,
            }
            for bank, cnt in self.bank_counts.items()
        }

        return AlgorithmResult(
            algorithm_id=self.algorithm_id,
            algorithm_name=self.algorithm_name,
            total_transactions=self.total,
            total_successes=self.successes,
            overall_sr=round(overall_sr, 4),
            sr_confidence_interval=ci,
            cumulative_regret=round(self.cumulative_regret, 4),
            exploration_ratio=round(self.exploration_count / self.total, 4) if self.total > 0 else 0,
            sr_by_gateway=sr_by_gw,
            sr_by_mode=sr_by_mode,
            sr_by_bank=sr_by_bank,
            regret_over_time=self.regret_over_time,
            sr_over_time=self.sr_over_time,
            decisions_sample=self.decisions[-100:],
            arm_state_snapshots=self.arm_state_snapshots,
        )
