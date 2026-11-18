from __future__ import annotations
import os
import numpy as np
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, Dict

from fastapi import FastAPI, HTTPException, Depends, Query
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
    ModelsListResponse,
    ModelSwitchRequest,
)
from backend.model_loader import get_model_loader, load_model, load_all_models, ModelLoader
from backend.data_service import get_data_service
from backend.api.routes import explain


# Configuration
MODELS_DIR = Path(__file__).parent.parent / "models"
DATA_DIR = Path(__file__).parent.parent / "LeakageData"
API_PREFIX = "/api/v1"

# Default model to use
DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "lstm")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - load all models on startup."""
    print(f"[Startup] Loading models from {MODELS_DIR}...")
    results = load_all_models(MODELS_DIR)
    for model_name, success in results.items():
        if success:
            print(f"[Startup] {model_name.upper()} model loaded successfully")
        else:
            print(f"[Startup] WARNING: {model_name.upper()} model failed to load")
    yield
    print("[Shutdown] Cleaning up...")


app = FastAPI(
    title="PIPER Leak Detection API",
    description="Water leakage detection in utility networks using GRU/LSTM classifiers",
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
def get_loader(model_name: str = DEFAULT_MODEL) -> ModelLoader:
    loader = get_model_loader(MODELS_DIR, model_name)
    if not loader.is_loaded():
        raise HTTPException(status_code=503, detail=f"{model_name.upper()} model not loaded")
    return loader


def get_data_svc() -> "DataService":
    return get_data_service()


@app.get(f"{API_PREFIX}/health", response_model=HealthResponse, tags=["Health"])
async def health_check(loader: ModelLoader = Depends(get_loader)):
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        model_loaded=loader.is_loaded(),
        model_type=DEFAULT_MODEL.upper() if loader.is_loaded() else None,
    )


@app.get(f"{API_PREFIX}/models", response_model=ModelsListResponse, tags=["Model"])
async def list_models():
    """List all available models and their load status."""
    models = []
    for name in ["gru", "lstm"]:
        try:
            loader = get_model_loader(MODELS_DIR, name)
            models.append({
                "name": name,
                "loaded": loader.is_loaded(),
                "type": loader.meta.get("model", name.upper()) if loader.is_loaded() else None,
            })
        except Exception:
            models.append({
                "name": name,
                "loaded": False,
                "type": None,
            })
    return ModelsListResponse(models=models, default=DEFAULT_MODEL)


@app.post(f"{API_PREFIX}/models/switch", tags=["Model"])
async def switch_model(request: ModelSwitchRequest):
    """Switch the default model for subsequent requests."""
    global DEFAULT_MODEL
    if request.model_name not in ["gru", "lstm"]:
        raise HTTPException(status_code=400, detail="Invalid model name. Use 'gru' or 'lstm'.")
    
    loader = get_model_loader(MODELS_DIR, request.model_name)
    if not loader.is_loaded():
        raise HTTPException(status_code=503, detail=f"{request.model_name.upper()} model not loaded")
    
    DEFAULT_MODEL = request.model_name
    return {"message": f"Switched to {request.model_name.upper()} model", "default_model": DEFAULT_MODEL}


@app.get(f"{API_PREFIX}/model/info", response_model=ModelInfoResponse, tags=["Model"])
async def model_info(loader: ModelLoader = Depends(get_loader)):
    """Get model metadata and configuration for the current default model."""
    return loader.get_model_info()


@app.get(f"{API_PREFIX}/model/{{model_name}}/info", response_model=ModelInfoResponse, tags=["Model"])
async def model_info_by_name(model_name: str):
    """Get model metadata for a specific model."""
    if model_name not in ["gru", "lstm"]:
        raise HTTPException(status_code=400, detail="Invalid model name. Use 'gru' or 'lstm'.")
    loader = get_model_loader(MODELS_DIR, model_name)
    return loader.get_model_info()


@app.post(f"{API_PREFIX}/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(
    request: PredictRequest,
    loader: ModelLoader = Depends(get_loader),
    model: Optional[str] = Query(None, description="Model to use: 'gru' or 'lstm'"),
    include_actions: bool = Query(True, description="Include action recommendations in response"),
):
    """
    Predict leak probability for a batch of sensor windows.

    Input shape: [B, W, F] where:
    - B = batch size (number of windows)
    - W = window length (48 hours for GRU/LSTM models)
    - F = number of features (9 for GRU/LSTM models)
    """
    # Allow per-request model override
    if model is not None:
        if model not in ["gru", "lstm"]:
            raise HTTPException(status_code=400, detail="Invalid model name. Use 'gru' or 'lstm'.")
        loader = get_model_loader(MODELS_DIR, model)
        if not loader.is_loaded():
            raise HTTPException(status_code=503, detail=f"{model.upper()} model not loaded")

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
        if include_actions and hasattr(loader, 'predict_with_actions'):
            probs, preds, thr_used, actions_list, metadata_list = loader.predict_with_actions(
                X=X,
                thr=request.thr,
                client_feats=request.feature_cols,
            )
        else:
            probs, preds, thr_used = loader.predict(
                X=X,
                thr=request.thr,
                client_feats=request.feature_cols,
            )
            actions_list = None
            metadata_list = None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    return PredictResponse(
        probs=probs, 
        preds=preds, 
        thr=thr_used,
        actions=actions_list,
        metadata=metadata_list
    )


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
    loader: ModelLoader = Depends(get_loader),
    data_svc: "DataService" = Depends(get_data_svc),
    model: Optional[str] = Query(None, description="Model to use: 'gru' or 'lstm'"),
    include_actions: bool = Query(True, description="Include action recommendations in response"),
):
    """
    Run batch prediction on test data windows.
    Uses the frozen test set for consistent, reproducible results.
    """
    # Allow per-request model override
    if model is not None:
        if model not in ["gru", "lstm"]:
            raise HTTPException(status_code=400, detail="Invalid model name. Use 'gru' or 'lstm'.")
        loader = get_model_loader(MODELS_DIR, model)
        if not loader.is_loaded():
            raise HTTPException(status_code=503, detail=f"{model.upper()} model not loaded")

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
        if include_actions and hasattr(loader, 'predict_with_actions'):
            probs, preds, thr_used, actions_list, metadata_list = loader.predict_with_actions(
                X=X_windows,
                thr=request.thr,
                client_feats=None,
            )
        else:
            probs, preds, thr_used = loader.predict(
                X=X_windows,
                thr=request.thr,
                client_feats=None,
            )
            actions_list = None
            metadata_list = None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {e}")

    # Build results
    results = []
    for i, (_, row) in enumerate(meta_df.iterrows()):
        result = BatchPredictResult(
            meter_id=row["meter_id"],
            timestamp_end=str(row["timestamp_end"]),
            y_true=int(row["y_true"]),
            prob=probs[i],
            pred=preds[i],
        )
        
        # Add actions and metadata if available
        if actions_list and i < len(actions_list):
            result.actions = actions_list[i]
        if metadata_list and i < len(metadata_list):
            result.metadata = metadata_list[i]
            
        results.append(result)

    # Summary stats
    y_true = meta_df["y_true"].to_numpy()
    leaks_detected = int(sum(preds))
    actual_leaks = int(sum(y_true))
    correct = int(sum(np.array(preds) == y_true))
    accuracy = correct / len(y_true) if len(y_true) > 0 else 0.0

    # Add action summary
    priority_counts = {}
    if actions_list:
        for action in actions_list:
            priority = action.get("priority", "UNKNOWN")
            priority_counts[priority] = priority_counts.get(priority, 0) + 1

    summary = {
        "total": len(results),
        "leaks_detected": leaks_detected,
        "actual_leaks": actual_leaks,
        "correct_predictions": correct,
        "accuracy": accuracy,
        "action_priority_distribution": priority_counts,
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


# Include explainability router
app.include_router(explain.router, prefix=API_PREFIX)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )