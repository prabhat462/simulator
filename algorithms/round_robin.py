"""
Round Robin baseline algorithm.
Deterministic cycling through all gateways regardless of outcome.
"""

from typing import List, Dict, Any
from algorithms.base import BaseAlgorithm, TransactionContext


class RoundRobin(BaseAlgorithm):
    """
    Deterministic baseline: cycles through gateways in fixed order.
    Uses no outcome feedback. Establishes minimum performance benchmark.
    """

    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        self.arms = arms
        self.step_count = 0
        self.successes: Dict[str, int] = {arm: 0 for arm in arms}
        self.counts: Dict[str, int] = {arm: 0 for arm in arms}

    def select(self, context: TransactionContext) -> str:
        chosen = self.arms[self.step_count % len(self.arms)]
        self.step_count += 1
        return chosen

    def update(self, arm: str, reward: int, context: TransactionContext) -> None:
        self.counts[arm] += 1
        self.successes[arm] += reward

    def get_state(self) -> Dict[str, Any]:
        state = {}
        for arm in self.arms:
            n = self.counts[arm]
            state[arm] = {
                "estimated_sr": self.successes[arm] / n if n > 0 else None,
                "selection_score": None,
                "total_selections": n,
                "total_successes": self.successes[arm],
                "total_failures": n - self.successes[arm],
            }
        return state

    def explain_last_decision(self) -> str:
        idx = (self.step_count - 1) % len(self.arms)
        return f"Round Robin: selected arm #{idx} ('{self.arms[idx]}') at step {self.step_count}."

    def get_hyperparameter_schema(self) -> Dict[str, Any]:
        return {}

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        return {
            "name": "Round Robin",
            "short_name": "RR",
            "description": "Deterministic baseline cycling through all gateways. Uses no outcome feedback. Establishes minimum performance benchmark.",
            "paper": "Deterministic baseline — no research paper",
            "paper_url": "",
            "category": "rule_based",
            "non_stationary": "false",
        }
