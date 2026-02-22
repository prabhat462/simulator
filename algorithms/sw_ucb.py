"""
Sliding Window Upper Confidence Bound (SW-UCB) algorithm.
Reference: Garivier & Moulines (2011), arXiv:0805.3415
"""

import math
from collections import deque
from typing import List, Dict, Any
from algorithms.base import BaseAlgorithm, TransactionContext


class SlidingWindowUCB(BaseAlgorithm):
    """
    Non-stationary UCB using a sliding window. Forgets old observations,
    enabling fast adaptation to gateway outages and SR changes.
    """

    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        self.arms = arms
        self.window_size = config.get("window_size", 200)
        self.history: Dict[str, deque] = {
            arm: deque(maxlen=self.window_size) for arm in arms
        }
        self.total_selections = 0
        self._last_scores: Dict[str, float] = {}
        self._last_chosen: str = ""

    def select(self, context: TransactionContext) -> str:
        self.total_selections += 1
        scores = {}

        for arm in self.arms:
            hist = self.history[arm]
            n = len(hist)

            if n == 0:
                self._last_chosen = arm
                self._last_scores = {a: float('inf') if a == arm else 0.0 for a in self.arms}
                return arm

            sr = sum(hist) / n
            exploration_bonus = math.sqrt(2 * math.log(self.total_selections) / n)
            scores[arm] = sr + exploration_bonus

        self._last_scores = scores
        self._last_chosen = max(scores, key=scores.get)
        return self._last_chosen

    def update(self, arm: str, reward: int, context: TransactionContext) -> None:
        self.history[arm].append(reward)

    def get_state(self) -> Dict[str, Any]:
        state = {}
        for arm in self.arms:
            hist = self.history[arm]
            n = len(hist)
            state[arm] = {
                "estimated_sr": sum(hist) / n if n > 0 else None,
                "selection_score": self._last_scores.get(arm),
                "window_count": n,
                "window_capacity": self.window_size,
                "window_successes": sum(hist),
                "window_failures": n - sum(hist),
            }
        return state

    def explain_last_decision(self) -> str:
        if not self._last_chosen or not self._last_scores:
            return "No decision made yet."
        chosen = self._last_chosen
        score = self._last_scores.get(chosen, 0)
        hist = self.history[chosen]
        n = len(hist)
        sr = sum(hist) / n if n > 0 else 0
        bonus = score - sr if score != float('inf') else float('inf')
        others = {a: f"{s:.4f}" for a, s in self._last_scores.items() if a != chosen}
        return (
            f"Chose '{chosen}' with UCB={score:.4f} "
            f"(SR={sr:.3f} + bonus={bonus:.4f}, window_n={n}). "
            f"Other scores: {others}"
        )

    def get_hyperparameter_schema(self) -> Dict[str, Any]:
        return {
            "window_size": {
                "type": "integer",
                "default": 200,
                "min": 10,
                "max": 10000,
                "description": "Number of most recent transactions per gateway to consider. Smaller = faster adaptation but noisier.",
            }
        }

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        return {
            "name": "Sliding Window UCB",
            "short_name": "SW-UCB",
            "description": "Non-stationary UCB using a sliding window. Forgets old observations, enabling fast adaptation to gateway outages and SR changes.",
            "paper": "Garivier & Moulines (2011). On Upper-Confidence Bound Policies for Non-Stationary Bandit Problems. ALT 2011.",
            "paper_url": "https://arxiv.org/abs/0805.3415",
            "category": "bandit",
            "non_stationary": "true",
        }
