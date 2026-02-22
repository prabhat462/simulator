"""
Statistical significance testing for algorithm comparisons.
"""

import math
from typing import Dict


def _norm_cdf(x: float) -> float:
    """Standard normal CDF approximation (no scipy dependency)."""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _norm_ppf(p: float) -> float:
    """Approximate inverse normal CDF (percent point function)."""
    # Rational approximation (Abramowitz and Stegun)
    if p <= 0:
        return -10
    if p >= 1:
        return 10
    if p < 0.5:
        return -_norm_ppf(1 - p)

    t = math.sqrt(-2 * math.log(1 - p))
    c0, c1, c2 = 2.515517, 0.802853, 0.010328
    d1, d2, d3 = 1.432788, 0.189269, 0.001308
    return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t)


def compare_success_rates(
    successes_a: int, total_a: int,
    successes_b: int, total_b: int,
    confidence: float = 0.95
) -> Dict:
    """
    Two-proportion z-test for comparing algorithm success rates.
    Returns p-value, confidence interval, and significance verdict.
    """
    if total_a == 0 or total_b == 0:
        return {
            "sr_a": 0, "sr_b": 0, "difference": 0,
            "z_statistic": 0, "p_value": 1.0,
            "confidence_interval": (0, 0),
            "is_significant": False,
            "interpretation": "Insufficient data for comparison."
        }

    sr_a = successes_a / total_a
    sr_b = successes_b / total_b

    # Pooled proportion under H0
    p_pool = (successes_a + successes_b) / (total_a + total_b)
    se = math.sqrt(p_pool * (1 - p_pool) * (1/total_a + 1/total_b)) if p_pool > 0 and p_pool < 1 else 0.0001

    z_stat = (sr_a - sr_b) / se if se > 0 else 0
    p_value = 2 * (1 - _norm_cdf(abs(z_stat)))

    # Confidence interval for (SR_A - SR_B)
    alpha = 1 - confidence
    z_crit = _norm_ppf(1 - alpha/2)
    se_diff = math.sqrt((sr_a*(1-sr_a)/total_a) + (sr_b*(1-sr_b)/total_b))
    ci_low = (sr_a - sr_b) - z_crit * se_diff
    ci_high = (sr_a - sr_b) + z_crit * se_diff

    return {
        "sr_a": round(sr_a, 4),
        "sr_b": round(sr_b, 4),
        "difference": round(sr_a - sr_b, 4),
        "z_statistic": round(z_stat, 4),
        "p_value": round(p_value, 6),
        "confidence_interval": (round(ci_low, 4), round(ci_high, 4)),
        "is_significant": p_value < (1 - confidence),
        "interpretation": (
            f"Algorithm A SR ({sr_a:.3%}) is "
            f"{'significantly' if p_value < 0.05 else 'not significantly'} "
            f"{'higher' if sr_a > sr_b else 'lower'} than Algorithm B ({sr_b:.3%}). "
            f"p={p_value:.4f}, 95% CI: [{ci_low:+.3%}, {ci_high:+.3%}]"
        ),
    }
