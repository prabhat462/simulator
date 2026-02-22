"""
Thompson Sampling (Bernoulli) algorithm.
Reference: Agrawal & Goyal (2012), COLT 2012, arXiv:1111.1797
"""

import random
from typing import List, Dict, Any
from algorithms.base import BaseAlgorithm, TransactionContext


class ThompsonSampling(BaseAlgorithm):
    """
    Thompson Sampling with Beta-Bernoulli model. Samples from
    posterior Beta distributions and selects arm with highest sample.
    """

    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        self.arms = arms
        self.alpha_prior = config.get("alpha_prior", 1.0)
        self.beta_prior = config.get("beta_prior", 1.0)
        self.alpha: Dict[str, float] = {arm: self.alpha_prior for arm in arms}
        self.beta: Dict[str, float] = {arm: self.beta_prior for arm in arms}
        self._last_samples: Dict[str, float] = {}
        self._last_chosen: str = ""
        self._rng = random.Random(config.get("seed", 42))

    def select(self, context: TransactionContext) -> str:
        samples = {}
        for arm in self.arms:
            samples[arm] = self._rng.betavariate(self.alpha[arm], self.beta[arm])

        self._last_samples = samples
        self._last_chosen = max(samples, key=samples.get)
        return self._last_chosen

    def update(self, arm: str, reward: int, context: TransactionContext) -> None:
        if reward == 1:
            self.alpha[arm] += 1.0
        else:
            self.beta[arm] += 1.0

    def get_state(self) -> Dict[str, Any]:
        state = {}
        for arm in self.arms:
            a, b = self.alpha[arm], self.beta[arm]
            total = a + b - 2 * self.alpha_prior  # subtract priors to get observation count
            state[arm] = {
                "estimated_sr": a / (a + b) if (a + b) > 0 else None,
                "selection_score": self._last_samples.get(arm),
                "alpha": round(a, 2),
                "beta": round(b, 2),
                "total_observations": int(total),
            }
        return state

    def explain_last_decision(self) -> str:
        if not self._last_chosen or not self._last_samples:
            return "No decision made yet."
        chosen = self._last_chosen
        sample = self._last_samples.get(chosen, 0)
        a, b = self.alpha[chosen], self.beta[chosen]
        mean = a / (a + b)
        others = {arm: f"{s:.4f}" for arm, s in self._last_samples.items() if arm != chosen}
        return (
            f"Chose '{chosen}' with sampled θ={sample:.4f} "
            f"(Beta(α={a:.1f}, β={b:.1f}), mean={mean:.3f}). "
            f"Other samples: {others}"
        )

    def get_hyperparameter_schema(self) -> Dict[str, Any]:
        return {
            "alpha_prior": {
                "type": "number",
                "default": 1.0,
                "min": 0.01,
                "max": 100.0,
                "description": "Prior alpha parameter for Beta distribution. 1.0 = uniform prior.",
            },
            "beta_prior": {
                "type": "number",
                "default": 1.0,
                "min": 0.01,
                "max": 100.0,
                "description": "Prior beta parameter for Beta distribution. 1.0 = uniform prior.",
            },
        }

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        return {
            "name": "Thompson Sampling",
            "short_name": "TS",
            "description": "Bayesian approach sampling from posterior Beta distributions. Natural exploration-exploitation balance.",
            "paper": "Agrawal & Goyal (2012). Analysis of Thompson Sampling for the Multi-Armed Bandit Problem. COLT 2012.",
            "paper_url": "https://arxiv.org/abs/1111.1797",
            "category": "bandit",
            "non_stationary": "false",
        }
