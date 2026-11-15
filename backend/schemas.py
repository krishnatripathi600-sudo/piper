from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class PredictRequest(BaseModel):
    """Request payload for leak prediction."""
    windows: List[List[List[float]]] = Field(
        ...,
        description="Batch of windows with shape [B, W, F] - Batch, Window length, Features",
        min_length=1,
    )
    feature_cols: Optional[List[str]] = Field(
        None,
        description="Feature column names in order (must match training order if provided)",
    )
    thr: Optional[float] = Field(
        None,
        description="Optional threshold override for this request",
        ge=0.0,
        le=1.0,
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "windows": [
                    [
                        [0.0, 1.0, 2.0, 0.5, 0.3, 0.1, 0.2, 0.0, 10.0],
                        [0.0, 1.0, 2.0, 0.5, 0.3, 0.1, 0.2, 0.0, 10.0],
                    ]
                ],
                "feature_cols": [
                    "Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean",
                    "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"
                ],
                "thr": 0.68
            }
        }
    )


class PredictResponse(BaseModel):
    """Response payload for leak prediction."""
    probs: List[float] = Field(..., description="Leak probability per window [0, 1]")
    preds: List[int] = Field(..., description="Binary prediction per window (0=no leak, 1=leak)")
    thr: float = Field(..., description="Threshold used for prediction")


class ModelInfoResponse(BaseModel):
    """Model metadata and configuration."""
    model: str
    task: str
    window: int
    stride: int
    in_dim: int
    feature_cols: List[str]
    hidden: int
    num_layers: int
    bidirectional: bool
    dropout: float
    thr: float
    metrics: Optional[dict] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model_loaded: bool
    model_type: Optional[str] = None


class MeterInfo(BaseModel):
    """Meter information."""
    meter_id: str
    n_readings: int
    date_range: dict


class MetersResponse(BaseModel):
    """List of available meters."""
    meters: List[MeterInfo]
    total: int


class SampleWindow(BaseModel):
    """Sample window for testing."""
    meter_id: str
    timestamp_end: str
    hour: int
    y_true: int
    features: List[List[float]]  # [W, F]


class SampleResponse(BaseModel):
    """Sample windows for testing."""
    windows: List[SampleWindow]
    feature_cols: List[str]
    window_size: int
    total_available: int


class BatchPredictRequest(BaseModel):
    """Batch prediction request using meter IDs from test set."""
    meter_ids: Optional[List[str]] = Field(None, description="Specific meter IDs to predict (default: all)")
    max_windows_per_meter: Optional[int] = Field(10, ge=1, le=100)
    thr: Optional[float] = Field(None, ge=0.0, le=1.0)


class BatchPredictResult(BaseModel):
    """Single prediction result in batch."""
    meter_id: str
    timestamp_end: str
    y_true: int
    prob: float
    pred: int


class BatchPredictResponse(BaseModel):
    """Batch prediction response."""
    results: List[BatchPredictResult]
    summary: dict
    thr_used: float