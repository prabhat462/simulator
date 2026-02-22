"""
Epsilon-Greedy algorithm with optional decay.
Reference: Sutton & Barto, Reinforcement Learning (2018)
"""

import random
from typing import List, Dict, Any
from algorithms.base import BaseAlgorithm, TransactionContext


class EpsilonGreedy(BaseAlgorithm):
    """
    With probability ε: explore (random arm). Else: exploit (best empirical SR).
    Optional epsilon decay to reduce exploration over time.
    """

    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        self.arms = arms
        self.epsilon = config.get("epsilon", 0.1)
        self.initial_epsilon = self.epsilon
        self.decay_rate = config.get("decay_rate", 0.0)
        self.successes: Dict[str, int] = {arm: 0 for arm in arms}
        self.counts: Dict[str, int] = {arm: 0 for arm in arms}
        self.total_selections = 0
        self._last_chosen: str = ""
        self._was_exploration: bool = False
        self._rng = random.Random(config.get("seed", 42))

    def select(self, context: TransactionContext) -> str:
        self.total_selections += 1

        if self._rng.random() < self.epsilon:
            # Explore: pick random arm
            self._last_chosen = self._rng.choice(self.arms)
            self._was_exploration = True
        else:
            # Exploit: pick arm with best empirical SR
            best_arm = self.arms[0]
            best_sr = -1.0
            for arm in self.arms:
                if self.counts[arm] == 0:
                    best_arm = arm
                    break
                sr = self.successes[arm] / self.counts[arm]
                if sr > best_sr:
                    best_sr = sr
                    best_arm = arm
            self._last_chosen = best_arm
            self._was_exploration = False

        # Decay epsilon
        if self.decay_rate > 0:
            self.epsilon *= (1 - self.decay_rate)

        return self._last_chosen

    def update(self, arm: str, reward: int, context: TransactionContext) -> None:
        self.counts[arm] += 1
        self.successes[arm] += reward

    def get_state(self) -> Dict[str, Any]:
        state = {}
        for arm in self.arms:
            n = self.counts[arm]
            state[arm] = {
                "estimated_sr": self.successes[arm] / n if n > 0 else None,
                "selection_score": self.successes[arm] / n if n > 0 else 0,
                "total_selections": n,
                "total_successes": self.successes[arm],
                "total_failures": n - self.successes[arm],
            }
        return state

    def explain_last_decision(self) -> str:
        if not self._last_chosen:
            return "No decision made yet."
        mode = "exploration (random)" if self._was_exploration else "exploitation (best SR)"
        chosen = self._last_chosen
        n = self.counts[chosen]
        sr = self.successes[chosen] / n if n > 0 else 0
        return (
            f"Chose '{chosen}' via {mode} "
            f"(ε={self.epsilon:.4f}, SR={sr:.3f}, n={n})"
        )

    def get_hyperparameter_schema(self) -> Dict[str, Any]:
        return {
            "epsilon": {
                "type": "number",
                "default": 0.1,
                "min": 0.0,
                "max": 1.0,
                "step": 0.01,
                "description": "Exploration probability. 0 = pure exploitation, 1 = pure exploration.",
            },
            "decay_rate": {
                "type": "number",
                "default": 0.0,
                "min": 0.0,
                "max": 0.1,
                "step": 0.001,
                "description": "Per-step multiplicative decay for epsilon. 0 = no decay.",
            },
        }

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        return {
            "name": "Epsilon-Greedy",
            "short_name": "ε-Greedy",
            "description": "Simple baseline: explore with probability ε, exploit with probability 1-ε. Optional epsilon decay.",
            "paper": "Sutton & Barto, Reinforcement Learning: An Introduction (2018)",
            "paper_url": "http://incompleteideas.net/book/the-book.html",
            "category": "bandit",
            "non_stationary": "false",
        }
