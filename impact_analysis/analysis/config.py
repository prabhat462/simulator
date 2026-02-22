"""
Analysis configuration model.
"""

from dataclasses import dataclass, field
from datetime import date


@dataclass
class AnalysisConfig:
    """Date range configuration for impact analysis."""
    baseline_start: date
    baseline_end: date
    algo_start: date
    algo_end: date
    min_merchant_volume: int = 1000

    def validate(self) -> list[str]:
        errors = []
        if self.baseline_start > self.baseline_end:
            errors.append("Baseline start must be before baseline end")
        if self.algo_start > self.algo_end:
            errors.append("Algo start must be before algo end")
        if self.baseline_end >= self.algo_start:
            errors.append("Baseline must end before algo period starts (no overlap)")
        return errors
