from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import numpy as np
import shap
import torch
import pandas as pd
from pathlib import Path

from backend.model_loader import get_model_loader, ModelLoader

router = APIRouter(prefix="/explain", tags=["explainability"])

# Global explainer cache
_explainer_cache = {}

# Feature names from the model
FEATURE_NAMES = [
    'Hour', 'DayOfWeek', 'Month', 'roll6_mean', 'roll24_mean',
    'roll6_std', 'roll24_std', 'rel_to_roll24', 'Delta_Volume'
]

FLAT_FEATURE_NAMES = [f"{fn}_t{t}" for t in range(48) for fn in FEATURE_NAMES]

class SHAPExplainRequest(BaseModel):
    windows: List[List[List[float]]] = Field(..., description="Shape: [n_windows, 48, 9]")
    feature_cols: List[str] = Field(default=FEATURE_NAMES)
    method: str = Field(default="kernel", description="kernel (only supported for PyTorch models)")
    max_samples: Optional[int] = Field(default=100, description="For kernel SHAP")

class SHAPExplainResponse(BaseModel):
    shap_values: List[List[float]] = Field(..., description="Shape: [48, 9] - per timestep per feature")
    base_value: float = Field(..., description="Expected model output E[f(x)]")
    feature_names: List[str]
    data: List[List[float]] = Field(..., description="Original feature values [48, 9]")
    aggregated_importance: Dict[str, float] = Field(..., description="Mean |SHAP| per feature")


def get_explainer(loader: ModelLoader, method: str = "kernel"):
    """Get or create SHAP explainer for the PyTorch model using flattened features."""
    cache_key = f"{loader.model_name}:{method}"
    
    if cache_key in _explainer_cache:
        return _explainer_cache[cache_key]
    
    model = loader.model
    model.eval()
    
    def model_predict_flat(X):
        """Wrapper to handle model prediction for SHAP with flattened input.
        
        X shape: [n_samples, 432] (48 timesteps * 9 features flattened)
        Returns: probabilities for positive class (leak)
        """
        with torch.no_grad():
            # Reshape to [n_samples, 48, 9]
            X_reshaped = X.reshape(X.shape[0], 48, 9)
            xb = torch.from_numpy(X_reshaped.astype(np.float32))
            logits = model(xb).detach().numpy()  # [n_samples, 48]
            # Use last timestep
            last_logits = logits[:, -1]
            last_logits = np.clip(last_logits, -20.0, 20.0)
            probs = 1.0 / (1.0 + np.exp(-last_logits))
            return probs
    
    if method == "kernel":
        # KernelExplainer works with any model but needs background data
        # Use zeros as background (not ideal but works for testing)
        background_flat = np.zeros((10, 432), dtype=np.float32)
        
        explainer = shap.KernelExplainer(model_predict_flat, background_flat)
        _explainer_cache[cache_key] = explainer
        return explainer
    
    raise ValueError(f"Unknown method: {method}. Only 'kernel' supported for PyTorch models.")


@router.post("/shap", response_model=SHAPExplainResponse)
async def explain_shap(
    request: SHAPExplainRequest,
    loader: ModelLoader = Depends(get_model_loader)
):
    """
    Compute SHAP values for a prediction window.
    
    Returns SHAP values explaining why the model predicted LEAK/NORMAL.
    """
    try:
        explainer = get_explainer(loader, request.method)
        
        # Input shape: [n_windows, 48, 9] - we only explain the first window
        windows = np.array(request.windows)
        if windows.ndim != 3 or windows.shape[1:] != (48, 9):
            raise HTTPException(
                status_code=400,
                detail=f"Expected windows shape [n, 48, 9], got {windows.shape}"
            )
        
        # Take first window: [48, 9]
        features = windows[0].astype(np.float32)  # [48, 9]
        
        # Apply the scaler to the features
        feature_df = pd.DataFrame(features, columns=request.feature_cols)
        features_scaled = loader.scaler.transform(feature_df).astype(np.float32)  # [48, 9]
        
        # Flatten for SHAP: [48, 9] -> [432]
        features_flat = features_scaled.flatten().reshape(1, -1)  # [1, 432]
        
        # Compute SHAP values
        shap_values_flat = explainer.shap_values(features_flat)
        base_value = explainer.expected_value
        
        # Reshape SHAP values from [1, 432] to [48, 9]
        shap_values = shap_values_flat.reshape(48, 9)
        
        # Aggregate importance across timesteps (mean absolute SHAP per feature)
        mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
        aggregated_importance = dict(zip(request.feature_cols, mean_abs_shap.tolist()))
        
        return SHAPExplainResponse(
            shap_values=shap_values.tolist(),
            base_value=float(base_value),
            feature_names=request.feature_cols,
            data=features.tolist(),  # Return original (unscaled) data
            aggregated_importance=aggregated_importance
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"SHAP computation failed: {str(e)}")


@router.get("/health")
async def explain_health(loader: ModelLoader = Depends(get_model_loader)):
    """Check if explainability service is available."""
    try:
        return {
            "status": "healthy",
            "model_loaded": loader.is_loaded(),
            "model_type": loader.meta.get("model", "Unknown"),
            "model_name": loader.model_name
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "model_loaded": False,
            "error": str(e)
        }