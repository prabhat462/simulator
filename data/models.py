"""
Data models for the PG Routing Simulator.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Transaction:
    transaction_id: str
    timestamp: datetime
    payment_gateway: str
    payment_mode: str           # 'upi' | 'card' | 'netbanking' | 'wallet' | 'bnpl'
    issuing_bank: str
    amount: float
    outcome: int                # 1 = success, 0 = failure
    card_network: Optional[str] = None
    merchant_id: Optional[str] = None
    merchant_category: Optional[str] = None
    failure_reason: Optional[str] = None
    device_type: Optional[str] = None
    state: Optional[str] = None


@dataclass
class DatasetStats:
    total_transactions: int
    date_range_start: str
    date_range_end: str
    gateways: list
    overall_sr: float
    sr_by_gateway: dict
    sr_by_mode: dict
    volume_by_mode: dict
    volume_by_gateway: dict
    missing_values: dict
    data_quality_score: float   # 0–100 composite score


@dataclass
class SimulationConfig:
    run_id: str
    run_name: str
    dataset_id: str
    algorithms: list            # [{id, class, hyperparameters}]
    counterfactual_mode: str    # 'direct_replay' | 'ips' | 'sr_interpolation'
    warm_up_transactions: int = 0
    random_seed: int = 42
    segment_filter: Optional[dict] = None


@dataclass
class AlgorithmResult:
    algorithm_id: str
    algorithm_name: str
    total_transactions: int
    total_successes: int
    overall_sr: float
    sr_confidence_interval: tuple
    cumulative_regret: float
    exploration_ratio: float
    sr_by_gateway: dict
    sr_by_mode: dict
    sr_by_bank: dict
    regret_over_time: list
    sr_over_time: list
    decisions_sample: list      # sampled decision log (last N)
    arm_state_snapshots: list   # periodic snapshots for timeline scrubbing
