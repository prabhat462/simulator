"""
FastAPI application — main entry point.
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.routes import datasets, experiments, results, reports, algorithms, impact_analysis

app = FastAPI(
    title="PG Routing Algorithm Simulator",
    description="Payment Gateway Routing Algorithm Simulator — Compare algorithms, tune hyperparameters, and generate transparent reports.",
    version="1.0.0",
)

# CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(datasets.router)
app.include_router(experiments.router)
app.include_router(results.router)
app.include_router(reports.router)
app.include_router(algorithms.router)
app.include_router(impact_analysis.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "pg-routing-simulator"}


# Serve frontend static files in production
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
