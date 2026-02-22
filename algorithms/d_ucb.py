"""
Discounted Upper Confidence Bound (D-UCB) algorithm.
Reference: Garivier & Moulines (2011), arXiv:0805.3415
"""

import math
from typing import List, Dict, Any
from algorithms.base import BaseAlgorithm, TransactionContext


class DiscountedUCB(BaseAlgorithm):
    """
    Non-stationary UCB using discounted counters. Recent observations
    weigh more than older ones, allowing gradual adaptation to SR drift.
    """

    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        self.arms = arms
        self.discount = config.get("discount", 0.6)
        self.n_eff: Dict[str, float] = {arm: 0.0 for arm in arms}
        self.s_eff: Dict[str, float] = {arm: 0.0 for arm in arms}
        self.total_n_eff = 0.0
        self.total_selections = 0
        self._last_scores: Dict[str, float] = {}
        self._last_chosen: str = ""

    def select(self, context: TransactionContext) -> str:
        self.total_selections += 1
        scores = {}

        for arm in self.arms:
            n = self.n_eff[arm]
            if n < 1.0:
                self._last_chosen = arm
                self._last_scores = {a: float('inf') if a == arm else 0.0 for a in self.arms}
                return arm

            sr = self.s_eff[arm] / n
            exploration_bonus = math.sqrt(2 * math.log(self.total_n_eff) / n)
            scores[arm] = sr + exploration_bonus

        self._last_scores = scores
        self._last_chosen = max(scores, key=scores.get)
        return self._last_chosen

    def update(self, arm: str, reward: int, context: TransactionContext) -> None:
        gamma = self.discount
        for a in self.arms:
            self.n_eff[a] *= gamma
            self.s_eff[a] *= gamma
        self.n_eff[arm] += 1.0
        self.s_eff[arm] += reward
        self.total_n_eff = sum(self.n_eff.values())

    def get_state(self) -> Dict[str, Any]:
        state = {}
        for arm in self.arms:
            n = self.n_eff[arm]
            state[arm] = {
                "estimated_sr": self.s_eff[arm] / n if n > 0 else None,
                "selection_score": self._last_scores.get(arm),
                "n_effective": round(n, 2),
                "s_effective": round(self.s_eff[arm], 2),
                "total_selections": self.total_selections,
            }
        return state

    def explain_last_decision(self) -> str:
        if not self._last_chosen or not self._last_scores:
            return "No decision made yet."
        chosen = self._last_chosen
        score = self._last_scores.get(chosen, 0)
        n = self.n_eff[chosen]
        sr = self.s_eff[chosen] / n if n > 0 else 0
        bonus = score - sr if score != float('inf') else float('inf')
        others = {a: f"{s:.4f}" for a, s in self._last_scores.items() if a != chosen}
        return (
            f"Chose '{chosen}' with D-UCB={score:.4f} "
            f"(discounted SR={sr:.3f} + bonus={bonus:.4f}, n_eff={n:.1f}). "
            f"Other scores: {others}"
        )

    def get_hyperparameter_schema(self) -> Dict[str, Any]:
        return {
            "discount": {
                "type": "number",
                "default": 0.6,
                "min": 0.01,
                "max": 1.0,
                "step": 0.05,
                "description": "Discount factor (γ). Lower = forgets faster. Applied multiplicatively to all counters at each step.",
            }
        }

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        return {
            "name": "Discounted UCB",
            "short_name": "D-UCB",
            "description": "Non-stationary UCB using discounted counters. Recent observations weigh more, allowing gradual adaptation to SR drift.",
            "paper": "Garivier & Moulines (2011). On Upper-Confidence Bound Policies for Non-Stationary Bandit Problems. ALT 2011.",
            "paper_url": "https://arxiv.org/abs/0805.3415",
            "category": "bandit",
            "non_stationary": "true",
        }
