"""
Algorithm API routes — list algorithms, get schema.
"""

from fastapi import APIRouter, HTTPException
from api.schemas import AlgorithmInfo
from engine.plugin_loader import load_algorithms

router = APIRouter(prefix="/api/algorithms", tags=["algorithms"])


@router.get("")
async def list_algorithms():
    """List all registered algorithms with metadata."""
    registry = load_algorithms()
    result = []
    for algo_id, cls in registry.items():
        meta = cls.metadata()
        instance = cls.__new__(cls)
        schema = {}
        try:
            # Need to call on an instance, so create temp instance
            schema = cls.get_hyperparameter_schema(instance)
        except Exception:
            pass

        result.append({
            "id": algo_id,
            **meta,
            "hyperparameter_schema": schema,
        })
    return result


@router.get("/{algorithm_id}/schema")
async def get_algorithm_schema(algorithm_id: str):
    """Get hyperparameter schema for a specific algorithm."""
    registry = load_algorithms()
    if algorithm_id not in registry:
        raise HTTPException(404, f"Algorithm '{algorithm_id}' not found")

    cls = registry[algorithm_id]
    meta = cls.metadata()
    instance = cls.__new__(cls)
    try:
        schema = cls.get_hyperparameter_schema(instance)
    except Exception:
        schema = {}

    return {
        "id": algorithm_id,
        **meta,
        "hyperparameter_schema": schema,
    }
