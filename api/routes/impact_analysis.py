"""
Impact Analysis API routes — data upload, analysis execution, results retrieval.

All routes are under /api/impact/ prefix, completely separate from
the existing simulator routes.
"""

import os
import uuid
from datetime import date
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional

from impact_analysis.database import get_connection, get_data_status
from impact_analysis.ingestion import ingest_file
from impact_analysis.analysis.config import AnalysisConfig
from impact_analysis.analysis.orchestrator import (
    run_analysis, get_analysis_results, get_analysis_history,
)

router = APIRouter(prefix="/api/impact", tags=["impact-analysis"])

_upload_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "impact_uploads"
)
os.makedirs(_upload_dir, exist_ok=True)


# ── Request models ──

class AnalysisRunRequest(BaseModel):
    baseline_start: str         # YYYY-MM-DD
    baseline_end: str
    algo_start: str
    algo_end: str
    min_merchant_volume: int = 1000


# ── Data routes ──

@router.post("/upload")
async def upload_impact_data(
    file: UploadFile = File(...),
    period: str = Form(...),
):
    """Upload a CSV or Parquet file with period tag ('before' or 'after')."""
    if period not in ("before", "after"):
        raise HTTPException(400, "period must be 'before' or 'after'")

    filename = file.filename or "uploaded_data"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".csv", ".parquet", ".pq"):
        raise HTTPException(400, f"Unsupported file type: {ext}. Use .csv or .parquet")

    # Save file
    file_id = str(uuid.uuid4())[:8]
    file_path = os.path.join(_upload_dir, f"{file_id}{ext}")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Ingest
    try:
        result = ingest_file(file_path, period)
    except Exception as e:
        raise HTTPException(500, f"Ingestion error: {str(e)}")

    if not result.get("success"):
        raise HTTPException(400, result.get("errors", ["Unknown error"]))

    # Clean up uploaded file after successful ingestion
    try:
        os.remove(file_path)
    except Exception:
        pass

    return result


@router.get("/data/status")
async def data_status():
    """Get database status: row counts, date ranges, periods loaded."""
    conn = get_connection()
    return get_data_status(conn)


# ── Analysis routes ──

@router.post("/analysis/run")
async def run_impact_analysis(req: AnalysisRunRequest):
    """Run full impact analysis with specified date ranges."""
    try:
        config = AnalysisConfig(
            baseline_start=date.fromisoformat(req.baseline_start),
            baseline_end=date.fromisoformat(req.baseline_end),
            algo_start=date.fromisoformat(req.algo_start),
            algo_end=date.fromisoformat(req.algo_end),
            min_merchant_volume=req.min_merchant_volume,
        )
    except ValueError as e:
        raise HTTPException(400, f"Invalid date format: {str(e)}")

    errors = config.validate()
    if errors:
        raise HTTPException(400, errors)

    result = run_analysis(config)
    if not result.get("success"):
        raise HTTPException(500, result.get("errors", "Analysis failed"))

    return result


@router.get("/analysis/{run_id}")
async def get_analysis(run_id: str):
    """Retrieve analysis results by run_id."""
    result = get_analysis_results(run_id)
    if not result:
        raise HTTPException(404, f"Analysis run {run_id} not found")
    return result


@router.get("/analysis/history/list")
async def analysis_history():
    """List all past analysis runs."""
    return get_analysis_history()
