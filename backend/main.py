from __future__ import annotations
import os
import numpy as np
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.schemas import (
    PredictRequest,
    PredictResponse,
    ModelInfoResponse,
    HealthResponse,
    MetersResponse,
    SampleResponse,
    BatchPredictRequest,
    BatchPredictResponse,
    BatchPredictResult,
)
from backend.model_loader import get_model_loader, load_model
from backend.data_service import get_data_service


# Configuration
MODELS_DIR = Path(__file__).parent.parent / "models"
DATA_DIR = Path(__file__).parent.parent / "LeakageData"
API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - load model on startup."""
    print(f"[Startup] Loading model from {MODELS_DIR}...")
    success = load_model(MODELS_DIR)
    if success:
        print("[Startup] Model loaded successfully")
    else:
        print("[Startup] WARNING: Model failed to load")
    yield
    print("[Shutdown] Cleaning up...")


app = FastAPI(
    title="PIPER Leak Detection API",
    description="Water leakage detection in utility networks using GRU classifier",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency to get model loader
def get_loader() -> "ModelLoader":
    loader = get_model_loader()
    if not loader.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded")
    return loader


def get_data_svc() -> "DataService":
    return get_data_service()


@app.get(f"{API_PREFIX}/health", response_model=HealthResponse, tags=["Health"])
async def health_check(loader: "ModelLoader" = Depends(get_loader)):
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        model_loaded=loader.is_loaded(),
        model_type="GRU" if loader.is_loaded() else None,
    )


@app.get(f"{API_PREFIX}/model/info", response_model=ModelInfoResponse, tags=["Model"])
async def model_info(loader: "ModelLoader" = Depends(get_loader)):
    """Get model metadata and configuration."""
    return loader.get_model_info()


@app.post(f"{API_PREFIX}/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(
    request: PredictRequest,
    loader: "ModelLoader" = Depends(get_loader),
):
    """
    Predict leak probability for a batch of sensor windows.

    Input shape: [B, W, F] where:
    - B = batch size (number of windows)
    - W = window length (48 hours for GRU model)
    - F = number of features (9 for GRU model)
    """
    try:
        X = np.array(request.windows, dtype=np.float32)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid windows format: {e}")

    if X.ndim != 3:
        raise HTTPException(
            status_code=400,
            detail=f"'windows' must be 3D array [B, W, F], got shape {X.shape}",
        )

    # Validate window length matches model
    expected_window = loader.meta.get("window", 48)
    if X.shape[1] != expected_window:
        raise HTTPException(
            status_code=400,
            detail=f"Window length must be {expected_window}, got {X.shape[1]}",
        )

    try:
        probs, preds, thr_used = loader.predict(
            X=X,
            thr=request.thr,
            client_feats=request.feature_cols,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    return PredictResponse(probs=probs, preds=preds, thr=thr_used)


@app.get(f"{API_PREFIX}/meters", response_model=MetersResponse, tags=["Data"])
async def list_meters(data_svc: "DataService" = Depends(get_data_svc)):
    """List available meters in the test dataset."""
    try:
        meters = data_svc.get_meters()
        return MetersResponse(meters=meters, total=len(meters))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load meters: {e}")


@app.get(f"{API_PREFIX}/data/sample", response_model=SampleResponse, tags=["Data"])
async def get_sample_windows(
    n: int = 10,
    meter_ids: Optional[str] = None,
    seed: int = 42,
    data_svc: "DataService" = Depends(get_data_svc),
):
    """Get sample windows from test data for testing the predictor."""
    try:
        meter_list = meter_ids.split(",") if meter_ids else None
        return data_svc.get_sample_windows(n=n, meter_ids=meter_list, seed=seed)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get samples: {e}")


@app.post(f"{API_PREFIX}/predict/batch", response_model=BatchPredictResponse, tags=["Prediction"])
async def batch_predict(
    request: BatchPredictRequest,
    loader: "ModelLoader" = Depends(get_loader),
    data_svc: "DataService" = Depends(get_data_svc),
):
    """
    Run batch prediction on test data windows.
    Uses the frozen test set for consistent, reproducible results.
    """
    try:
        X_windows, meta_df = data_svc.get_batch_windows(
            meter_ids=request.meter_ids,
            max_windows_per_meter=request.max_windows_per_meter,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load batch data: {e}")

    if len(X_windows) == 0:
        return BatchPredictResponse(
            results=[],
            summary={"total": 0, "leaks_detected": 0, "accuracy": None},
            thr_used=loader.thr,
        )

    try:
        probs, preds, thr_used = loader.predict(
            X=X_windows,
            thr=request.thr,
            client_feats=None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {e}")

    # Build results
    results = []
    for i, (_, row) in enumerate(meta_df.iterrows()):
        results.append(BatchPredictResult(
            meter_id=row["meter_id"],
            timestamp_end=str(row["timestamp_end"]),
            y_true=int(row["y_true"]),
            prob=probs[i],
            pred=preds[i],
        ))

    # Summary stats
    y_true = meta_df["y_true"].to_numpy()
    leaks_detected = int(sum(preds))
    actual_leaks = int(sum(y_true))
    correct = int(sum(np.array(preds) == y_true))
    accuracy = correct / len(y_true) if len(y_true) > 0 else 0.0

    summary = {
        "total": len(results),
        "leaks_detected": leaks_detected,
        "actual_leaks": actual_leaks,
        "correct_predictions": correct,
        "accuracy": accuracy,
    }

    return BatchPredictResponse(
        results=results,
        summary=summary,
        thr_used=thr_used,
    )


# Root redirect to docs
@app.get("/", include_in_schema=False)
async def root():
    return JSONResponse({"message": "PIPER Leak Detection API", "docs": "/docs"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )