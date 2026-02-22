"""
Statistical test helpers for impact analysis.

Provides two-proportion z-test, confidence intervals,
Cohen's h effect size, and significance badge mapping.
"""

import math
from typing import Optional

try:
    from scipy import stats as sp_stats
    _norm_cdf = sp_stats.norm.cdf
    _norm_ppf = sp_stats.norm.ppf
except ImportError:
    # Pure-math fallback using Python's built-in math.erf
    def _norm_cdf(x: float) -> float:
        return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

    def _norm_ppf(p: float) -> float:
        """Rational approximation (Abramowitz & Stegun 26.2.23)."""
        if p <= 0:
            return -float('inf')
        if p >= 1:
            return float('inf')
        if p == 0.5:
            return 0.0
        if p > 0.5:
            return -_norm_ppf(1.0 - p)
        t = math.sqrt(-2.0 * math.log(p))
        c0, c1, c2 = 2.515517, 0.802853, 0.010328
        d1, d2, d3 = 1.432788, 0.189269, 0.001308
        return -(t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t))


def two_proportion_z_test(
    successes_a: int, total_a: int,
    successes_b: int, total_b: int,
) -> dict:
    """
    Two-proportion z-test comparing SR between two periods.
    Returns z-statistic, p-value, and whether the difference is significant.
    """
    if total_a == 0 or total_b == 0:
        return {"z_stat": 0, "p_value": 1.0, "significant": False}

    p_a = successes_a / total_a
    p_b = successes_b / total_b
    p_pool = (successes_a + successes_b) / (total_a + total_b)

    se = math.sqrt(p_pool * (1 - p_pool) * (1 / total_a + 1 / total_b))
    if se == 0:
        return {"z_stat": 0, "p_value": 1.0, "significant": False}

    z = (p_b - p_a) / se
    p_value = 2 * (1 - _norm_cdf(abs(z)))

    return {
        "z_stat": round(z, 4),
        "p_value": round(p_value, 6),
        "significant": p_value < 0.05,
    }


def proportion_confidence_interval(successes: int, total: int, confidence: float = 0.95) -> tuple:
    """Wilson score interval for a proportion."""
    if total == 0:
        return (0.0, 0.0)

    p = successes / total
    z = _norm_ppf(1 - (1 - confidence) / 2)
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator

    return (round(max(0, center - spread), 6), round(min(1, center + spread), 6))


def cohens_h(p1: float, p2: float) -> float:
    """Cohen's h effect size for two proportions."""
    h = 2 * math.asin(math.sqrt(p2)) - 2 * math.asin(math.sqrt(p1))
    return round(abs(h), 4)


def effect_size_label(h: float) -> str:
    """Interpret Cohen's h value."""
    if h < 0.2:
        return "Small"
    elif h < 0.5:
        return "Medium"
    else:
        return "Large"


def significance_badge(p_value: float, total: Optional[int] = None) -> dict:
    """
    Return significance badge info based on p-value.
    """
    if total is not None and total < 30:
        return {"level": "insufficient", "label": "Insufficient Sample", "emoji": "⚠️"}

    if p_value < 0.001:
        return {"level": "highly_significant", "label": "Highly Significant", "emoji": "🟢"}
    elif p_value < 0.01:
        return {"level": "significant", "label": "Significant", "emoji": "🟢"}
    elif p_value < 0.05:
        return {"level": "marginal", "label": "Marginally Significant", "emoji": "🟡"}
    else:
        return {"level": "not_significant", "label": "Not Significant", "emoji": "⬛"}


def sr_delta_pp(sr_before: float, sr_after: float) -> float:
    """SR delta in percentage points."""
    return round((sr_after - sr_before) * 100, 2)
