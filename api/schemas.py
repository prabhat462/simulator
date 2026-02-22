"""
Pydantic request/response models for the API.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any


class DatasetUploadResponse(BaseModel):
    dataset_id: str
    filename: str
    total_transactions: int
    errors: List[str]
    stats: Optional[Dict[str, Any]] = None


class SyntheticDatasetRequest(BaseModel):
    template_id: str
    n_transactions: int = 20000
    seed: int = 42


class AlgorithmConfig(BaseModel):
    id: str
    hyperparameters: Dict[str, Any] = {}


class ExperimentRequest(BaseModel):
    run_name: str = "Experiment"
    dataset_id: str
    algorithms: List[AlgorithmConfig]
    counterfactual_mode: str = "sr_interpolation"
    warm_up_transactions: int = 0
    random_seed: int = 42


class ExperimentResponse(BaseModel):
    run_id: str
    status: str
    message: str


class ExperimentStatus(BaseModel):
    run_id: str
    status: str
    total_transactions: int = 0
    processed: int = 0
    percent: float = 0
    elapsed_seconds: float = 0
    estimated_remaining: float = 0
    throughput: float = 0
    current_metrics: Dict[str, Any] = {}


class AlgorithmInfo(BaseModel):
    id: str
    name: str
    short_name: str
    description: str
    paper: str
    paper_url: str
    category: str
    non_stationary: str
    hyperparameter_schema: Dict[str, Any] = {}
    built_in: bool = True
