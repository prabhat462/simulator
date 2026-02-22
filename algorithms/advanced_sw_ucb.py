"""
Advanced Sliding Window Upper Confidence Bound (Advanced SW-UCB) algorithm.
Reference: Garivier & Moulines (2011), with modifications for recovery detection.

Enhanced version of SW-UCB with dedicated exploration budget to detect
when previously failed gateways recover.
"""

import math
import random
from collections import deque
from typing import List, Dict, Any
from algorithms.base import BaseAlgorithm, TransactionContext


class AdvancedSlidingWindowUCB(BaseAlgorithm):
    """
    Enhanced SW-UCB with configurable exploration percentage.
    
    Balances exploitation (UCB-based) with exploration (random arm selection)
    to detect recovery in previously failing gateways. The exploration budget
    is dedicated to uniformly sampling non-best arms, enabling early detection
    of state changes in the environment.
    """

    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        self.arms = arms
        self.window_size = config.get("window_size", 200)
        self.exploration_rate = config.get("exploration_rate", 0.05)  # 5% default
        self.history: Dict[str, deque] = {
            arm: deque(maxlen=self.window_size) for arm in arms
        }
        self.total_selections = 0
        self._last_scores: Dict[str, float] = {}
        self._last_chosen: str = ""
        self._last_was_exploration: bool = False
        self.random_seed = config.get("seed", 42)
        random.seed(self.random_seed)

    def select(self, context: TransactionContext) -> str:
        self.total_selections += 1

        # Decide: explore or exploit?
        use_exploration = random.random() < self.exploration_rate

        if use_exploration and len(self.arms) > 1:
            # Exploration: randomly select an arm (uniform distribution)
            self._last_chosen = random.choice(self.arms)
            self._last_was_exploration = True
            # Still compute scores for state tracking
            self._compute_scores()
            return self._last_chosen

        # Exploitation: use UCB-based selection
        self._last_was_exploration = False
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

    def _compute_scores(self) -> None:
        """Compute UCB scores for all arms (for state tracking even during exploration)."""
        scores = {}
        for arm in self.arms:
            hist = self.history[arm]
            n = len(hist)
            if n == 0:
                scores[arm] = float('inf')
            else:
                sr = sum(hist) / n
                exploration_bonus = math.sqrt(2 * math.log(self.total_selections) / n)
                scores[arm] = sr + exploration_bonus
        self._last_scores = scores

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
        if not self._last_chosen:
            return "No decision made yet."

        if self._last_was_exploration:
            chosen = self._last_chosen
            hist = self.history[chosen]
            n = len(hist)
            sr = sum(hist) / n if n > 0 else 0
            others = {a: f"{s:.4f}" for a, s in self._last_scores.items() if a != chosen}
            return (
                f"[EXPLORATION] Randomly chose '{chosen}' "
                f"(SR={sr:.3f}, window_n={n}). "
                f"UCB scores: {others}"
            )

        # Exploitation path
        chosen = self._last_chosen
        score = self._last_scores.get(chosen, 0)
        hist = self.history[chosen]
        n = len(hist)
        sr = sum(hist) / n if n > 0 else 0
        bonus = score - sr if score != float('inf') else float('inf')
        others = {a: f"{s:.4f}" for a, s in self._last_scores.items() if a != chosen}
        return (
            f"[EXPLOITATION] Chose '{chosen}' with UCB={score:.4f} "
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
            },
            "exploration_rate": {
                "type": "number",
                "default": 0.05,
                "min": 0.0,
                "max": 0.50,
                "step": 0.01,
                "description": "Fraction of traffic dedicated to random exploration (0.0-0.50). Higher = more probing for recovery, lower = more stable. Default 0.05 = 5% exploration.",
            },
        }

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        return {
            "name": "Advanced Sliding Window UCB",
            "short_name": "Adv. SW-UCB",
            "description": "Enhanced SW-UCB with configurable exploration budget to detect when previously failed gateways recover. Balances exploitation with proactive recovery detection.",
            "paper": "Garivier & Moulines (2011), with recovery detection modifications",
            "paper_url": "https://arxiv.org/abs/0805.3415",
            "category": "bandit",
            "non_stationary": "true",
        }
