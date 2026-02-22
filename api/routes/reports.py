"""
Report API routes — generate and download reports.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from api.routes.experiments import get_results
from reporting.report_generator import generate_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{run_id}/json")
async def get_json_report(run_id: str):
    """Download results as JSON report."""
    data = get_results(run_id)
    if not data:
        raise HTTPException(404, "Results not found")

    report = generate_report(
        run_id=run_id,
        run_name=data.get("run_name", ""),
        dataset_stats=data.get("dataset_stats", {}),
        algorithm_results=data.get("results", {}),
        simulation_config=data.get("config", {}),
    )

    return report


@router.get("/{run_id}/summary")
async def get_report_summary(run_id: str):
    """Get executive summary for the report."""
    data = get_results(run_id)
    if not data:
        raise HTTPException(404, "Results not found")

    report = generate_report(
        run_id=run_id,
        run_name=data.get("run_name", ""),
        dataset_stats=data.get("dataset_stats", {}),
        algorithm_results=data.get("results", {}),
        simulation_config=data.get("config", {}),
    )

    return report.get("sections", {}).get("1_executive_summary", {})
