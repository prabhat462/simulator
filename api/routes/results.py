"""
Results API routes — full results, segments, decisions, arm state.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from api.routes.experiments import get_results

router = APIRouter(prefix="/api/results", tags=["results"])


@router.get("/{run_id}")
async def get_full_results(run_id: str):
    """Get full simulation results."""
    data = get_results(run_id)
    if not data:
        raise HTTPException(404, "Results not found. Simulation may still be running.")
    return data


@router.get("/{run_id}/segments")
async def get_segment_results(
    run_id: str,
    payment_mode: Optional[str] = None,
    issuing_bank: Optional[str] = None,
    amount_band: Optional[str] = None,
):
    """Get segment-filtered results."""
    data = get_results(run_id)
    if not data:
        raise HTTPException(404, "Results not found")

    # Filter segment data from results
    filtered = {}
    for algo_id, result in data.get("results", {}).items():
        segment_data = {
            "algorithm_id": algo_id,
            "algorithm_name": result.get("algorithm_name", algo_id),
            "overall_sr": result.get("overall_sr", 0),
        }

        if payment_mode:
            mode_data = result.get("sr_by_mode", {}).get(payment_mode, {})
            segment_data["filtered_sr"] = mode_data.get("sr", 0) if isinstance(mode_data, dict) else mode_data

        if issuing_bank:
            bank_data = result.get("sr_by_bank", {}).get(issuing_bank, {})
            segment_data["filtered_sr"] = bank_data.get("sr", 0) if isinstance(bank_data, dict) else bank_data

        filtered[algo_id] = segment_data

    return {
        "run_id": run_id,
        "filters": {
            "payment_mode": payment_mode,
            "issuing_bank": issuing_bank,
            "amount_band": amount_band,
        },
        "results": filtered,
    }


@router.get("/{run_id}/decisions")
async def get_decisions(
    run_id: str,
    algorithm_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
):
    """Paginated decision log."""
    data = get_results(run_id)
    if not data:
        raise HTTPException(404, "Results not found")

    all_decisions = []
    for algo_id, result in data.get("results", {}).items():
        if algorithm_id and algo_id != algorithm_id:
            continue
        decisions = result.get("decisions_sample", [])
        for d in decisions:
            d["algorithm_id"] = algo_id
            all_decisions.append(d)

    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    page_data = all_decisions[start:end]

    return {
        "run_id": run_id,
        "total": len(all_decisions),
        "page": page,
        "page_size": page_size,
        "decisions": page_data,
    }


@router.get("/{run_id}/arm-state/{transaction_idx}")
async def get_arm_state(run_id: str, transaction_idx: int):
    """Get arm state snapshot at a specific transaction index."""
    data = get_results(run_id)
    if not data:
        raise HTTPException(404, "Results not found")

    snapshots = {}
    for algo_id, result in data.get("results", {}).items():
        arm_states = result.get("arm_state_snapshots", [])
        # Find closest snapshot
        closest = None
        for snap in arm_states:
            if snap["transaction_idx"] <= transaction_idx:
                closest = snap
            else:
                break
        snapshots[algo_id] = closest

    return {
        "run_id": run_id,
        "transaction_idx": transaction_idx,
        "arm_states": snapshots,
    }
