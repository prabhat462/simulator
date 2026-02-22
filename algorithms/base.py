"""
BaseAlgorithm interface — the contract every routing algorithm must implement.
The simulator engine ONLY calls these methods. No other coupling exists.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class TransactionContext:
    """Context available at routing time for each transaction."""
    payment_mode: str           # 'upi' | 'card' | 'netbanking' | 'wallet' | 'bnpl'
    card_network: str | None    # 'visa' | 'mastercard' | 'rupay' | 'amex' | None
    issuing_bank: str           # 'HDFC' | 'SBI' | 'ICICI' | 'AXIS' | ...
    amount: float               # transaction amount in INR
    amount_band: str            # '0-500' | '500-5k' | '5k-50k' | '50k+'
    hour: int                   # 0–23
    day_of_week: int            # 0=Monday, 6=Sunday
    merchant_category: str      # 'ecomm' | 'travel' | 'gaming' | 'utilities' | ...
    device_type: str | None     # 'mobile_app' | 'mobile_web' | 'desktop' | None
    state: str | None           # Indian state code or None


class BaseAlgorithm(ABC):
    """
    Every routing algorithm — built-in or custom plugin — must implement this interface.
    The simulator engine ONLY calls these methods.
    """

    @abstractmethod
    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        """Called once at simulation start."""
        ...

    @abstractmethod
    def select(self, context: TransactionContext) -> str:
        """Select a gateway for this transaction. Must return one of the arm IDs."""
        ...

    @abstractmethod
    def update(self, arm: str, reward: int, context: TransactionContext) -> None:
        """Receive outcome feedback after a routing decision."""
        ...

    @abstractmethod
    def get_state(self) -> Dict[str, Any]:
        """Return current internal arm state for UI transparency panel."""
        ...

    def explain_last_decision(self) -> str:
        """Human-readable explanation of the most recent select() decision."""
        return "No explanation provided by this algorithm."

    def get_hyperparameter_schema(self) -> Dict[str, Any]:
        """JSON Schema for this algorithm's hyperparameters."""
        return {}

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        """Algorithm metadata displayed in the UI algorithm card."""
        return {
            "name": cls.__name__,
            "short_name": cls.__name__,
            "description": "No description provided.",
            "paper": "",
            "paper_url": "",
            "category": "bandit",
            "non_stationary": "false",
        }
