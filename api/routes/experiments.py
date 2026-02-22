"""
Experiment API routes — create, status, stream (WebSocket).
"""

import uuid
import asyncio
import json
import threading
from dataclasses import asdict
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from api.schemas import ExperimentRequest, ExperimentResponse, ExperimentStatus
from api.routes.datasets import get_dataset
from engine.plugin_loader import load_algorithms
from engine.simulation import SimulationEngine, SimulationProgress

router = APIRouter(prefix="/api/experiments", tags=["experiments"])

# In-memory stores
_experiments: Dict[str, dict] = {}
_engine = SimulationEngine()
_progress_store: Dict[str, SimulationProgress] = {}
_results_store: Dict[str, dict] = {}
_websocket_clients: Dict[str, list] = {}


def _run_in_thread(run_id: str, experiment: dict):
    """Run simulation in a background thread."""
    try:
        dataset = get_dataset(experiment["dataset_id"])
        if not dataset:
            _experiments[run_id]["status"] = "error"
            _experiments[run_id]["error"] = "Dataset not found"
            return

        df = dataset["df"].copy()
        registry = load_algorithms()

        # Initialize algorithm instances
        gateways = sorted(df["payment_gateway"].unique().tolist())
        algo_instances = {}
        for algo_config in experiment["algorithms"]:
            algo_id = algo_config["id"]
            if algo_id not in registry:
                continue
            cls = registry[algo_id]
            instance = cls()
            instance.initialize(gateways, algo_config.get("hyperparameters", {}))
            instance_id = algo_config.get("instance_id", algo_id)
            algo_instances[instance_id] = instance

        def progress_callback(progress: SimulationProgress):
            _progress_store[run_id] = progress
            _experiments[run_id]["progress"] = {
                "processed": progress.processed,
                "total": progress.total_transactions,
                "percent": progress.percent,
                "elapsed": progress.elapsed_seconds,
                "remaining": progress.estimated_remaining,
                "throughput": progress.throughput,
                "metrics": progress.current_metrics,
            }

        def cancel_check():
            return _experiments.get(run_id, {}).get("status") == "cancelled"

        _experiments[run_id]["status"] = "running"

        results = _engine.run_simulation(
            run_id=run_id,
            df=df,
            algorithm_instances=algo_instances,
            counterfactual_mode=experiment.get("counterfactual_mode", "sr_interpolation"),
            warm_up_transactions=experiment.get("warm_up_transactions", 0),
            random_seed=experiment.get("random_seed", 42),
            progress_callback=progress_callback,
            cancel_check=cancel_check,
        )

        # Store results
        results_dict = {}
        for aid, result in results.items():
            results_dict[aid] = asdict(result)

        _results_store[run_id] = {
            "run_id": run_id,
            "run_name": experiment.get("run_name", ""),
            "dataset_id": experiment["dataset_id"],
            "dataset_stats": dataset["stats"],
            "config": experiment,
            "results": results_dict,
        }

        _experiments[run_id]["status"] = "completed"

    except Exception as e:
        _experiments[run_id]["status"] = "error"
        _experiments[run_id]["error"] = str(e)
        import traceback
        traceback.print_exc()


@router.post("", response_model=ExperimentResponse)
async def create_experiment(req: ExperimentRequest):
    """Create and launch a simulation run."""
    dataset = get_dataset(req.dataset_id)
    if not dataset:
        raise HTTPException(404, f"Dataset '{req.dataset_id}' not found")

    run_id = str(uuid.uuid4())[:8]

    experiment = {
        "run_id": run_id,
        "run_name": req.run_name,
        "dataset_id": req.dataset_id,
        "algorithms": [a.model_dump() for a in req.algorithms],
        "counterfactual_mode": req.counterfactual_mode,
        "warm_up_transactions": req.warm_up_transactions,
        "random_seed": req.random_seed,
        "status": "queued",
        "progress": {},
    }

    _experiments[run_id] = experiment

    # Run in background thread
    thread = threading.Thread(target=_run_in_thread, args=(run_id, experiment))
    thread.daemon = True
    thread.start()

    return ExperimentResponse(
        run_id=run_id,
        status="queued",
        message=f"Simulation '{req.run_name}' started with {len(req.algorithms)} algorithms.",
    )


@router.get("/{run_id}/status")
async def get_experiment_status(run_id: str):
    """Poll simulation progress."""
    if run_id not in _experiments:
        raise HTTPException(404, "Experiment not found")

    exp = _experiments[run_id]
    progress = exp.get("progress", {})

    return {
        "run_id": run_id,
        "status": exp.get("status", "unknown"),
        "total_transactions": progress.get("total", 0),
        "processed": progress.get("processed", 0),
        "percent": progress.get("percent", 0),
        "elapsed_seconds": progress.get("elapsed", 0),
        "estimated_remaining": progress.get("remaining", 0),
        "throughput": progress.get("throughput", 0),
        "current_metrics": progress.get("metrics", {}),
        "error": exp.get("error"),
    }


@router.post("/{run_id}/cancel")
async def cancel_experiment(run_id: str):
    """Cancel a running simulation."""
    if run_id not in _experiments:
        raise HTTPException(404, "Experiment not found")
    _experiments[run_id]["status"] = "cancelled"
    return {"run_id": run_id, "status": "cancelled"}


@router.get("")
async def list_experiments():
    """List all experiments."""
    return [
        {
            "run_id": exp["run_id"],
            "run_name": exp.get("run_name", ""),
            "status": exp.get("status", "unknown"),
            "dataset_id": exp.get("dataset_id", ""),
        }
        for exp in _experiments.values()
    ]


# WebSocket endpoint for live streaming
@router.websocket("/{run_id}/stream")
async def stream_experiment(websocket: WebSocket, run_id: str):
    """WebSocket: live metrics stream during simulation."""
    await websocket.accept()

    try:
        while True:
            if run_id not in _experiments:
                await websocket.send_json({"error": "Experiment not found"})
                break

            exp = _experiments[run_id]
            status = exp.get("status", "unknown")
            progress = exp.get("progress", {})

            await websocket.send_json({
                "type": "progress",
                "run_id": run_id,
                "status": status,
                **progress,
            })

            if status in ("completed", "cancelled", "error"):
                # Send final results
                if run_id in _results_store:
                    await websocket.send_json({
                        "type": "completed",
                        "run_id": run_id,
                    })
                break

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        pass
    except Exception:
        pass


def get_results(run_id: str):
    """Helper to get results for other routes."""
    return _results_store.get(run_id)


def get_experiment(run_id: str):
    """Helper to get experiment for other routes."""
    return _experiments.get(run_id)
