"""
Base class for analysis modules.
"""

from abc import ABC, abstractmethod
from impact_analysis.analysis.config import AnalysisConfig
import duckdb


class BaseAnalysisModule(ABC):
    """Abstract base for all analysis modules."""

    name: str = "base"

    @abstractmethod
    def run(self, config: AnalysisConfig, conn: duckdb.DuckDBPyConnection) -> dict:
        """Execute analysis and return results dict."""
        ...

    def _period_filter(self, config: AnalysisConfig) -> str:
        """SQL WHERE clause for both periods filtered by date range."""
        return f"""
            ((period = 'before' AND date BETWEEN '{config.baseline_start}' AND '{config.baseline_end}')
             OR (period = 'after' AND date BETWEEN '{config.algo_start}' AND '{config.algo_end}'))
        """
