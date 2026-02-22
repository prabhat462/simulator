"""
Dataset API routes — upload, stats, synthetic generation.
"""

import os
import uuid
import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from api.schemas import DatasetUploadResponse, SyntheticDatasetRequest
from data.ingestor import validate_and_load, compute_stats, compute_file_hash
from data.synthetic import generate_scenario, SCENARIO_TEMPLATES

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

# In-memory store for datasets (in production, use a DB)
_datasets = {}
_upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(_upload_dir, exist_ok=True)


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """Upload a CSV or Parquet transaction file."""
    dataset_id = str(uuid.uuid4())[:8]
    filename = file.filename or "uploaded_data"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in (".csv", ".parquet", ".pq"):
        raise HTTPException(400, f"Unsupported file type: {ext}. Use .csv or .parquet")

    # Save file
    file_path = os.path.join(_upload_dir, f"{dataset_id}{ext}")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Validate and load
    df, errors = validate_and_load(file_path)
    if df.empty and errors:
        raise HTTPException(400, detail={"errors": errors})

    stats = compute_stats(df)

    # Store
    _datasets[dataset_id] = {
        "id": dataset_id,
        "filename": filename,
        "file_path": file_path,
        "stats": stats.__dict__,
        "df": df,
    }

    return DatasetUploadResponse(
        dataset_id=dataset_id,
        filename=filename,
        total_transactions=stats.total_transactions,
        errors=errors,
        stats=stats.__dict__,
    )


@router.get("/{dataset_id}/stats")
async def get_dataset_stats(dataset_id: str):
    """Get computed dataset statistics."""
    if dataset_id not in _datasets:
        raise HTTPException(404, "Dataset not found")
    return _datasets[dataset_id]["stats"]


@router.get("/synthetic/templates")
async def list_templates():
    """List all built-in scenario templates."""
    return {
        tid: {"id": tid, **info}
        for tid, info in SCENARIO_TEMPLATES.items()
    }


@router.post("/synthetic/generate")
async def generate_synthetic(req: SyntheticDatasetRequest):
    """Generate a synthetic dataset from a template."""
    try:
        df = generate_scenario(req.template_id, req.n_transactions, req.seed)
    except ValueError as e:
        raise HTTPException(400, str(e))

    dataset_id = f"syn_{req.template_id}_{str(uuid.uuid4())[:4]}"

    # Save to CSV
    file_path = os.path.join(_upload_dir, f"{dataset_id}.csv")
    df.to_csv(file_path, index=False)

    stats = compute_stats(df)

    _datasets[dataset_id] = {
        "id": dataset_id,
        "filename": f"{req.template_id}_synthetic.csv",
        "file_path": file_path,
        "stats": stats.__dict__,
        "df": df,
    }

    return {
        "dataset_id": dataset_id,
        "template": req.template_id,
        "total_transactions": stats.total_transactions,
        "stats": stats.__dict__,
    }


def get_dataset(dataset_id: str):
    """Helper to get dataset by ID (used by other routes)."""
    if dataset_id not in _datasets:
        return None
    return _datasets[dataset_id]
