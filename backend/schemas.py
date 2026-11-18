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


class SimulatedResponse(BaseModel):
    """Simulated alert/response that would be sent to operators."""
    alert_type: str = Field(..., description="Type of alert: EMERGENCY_LEAK, CRITICAL_LEAK, HIGH_CONFIDENCE_LEAK, PROBABLE_LEAK, SUSPECTED_ANOMALY, NORMAL_OPERATIONS, UNKNOWN_RULE_MATCH")
    severity: str = Field(..., description="Severity level: CRITICAL, HIGH, MEDIUM, LOW, INFO, WARNING")
    message: str = Field(..., description="Human-readable alert message with template variables")
    channels: List[str] = Field(default_factory=list, description="Delivery channels: SMS, EMAIL, SCADA_ALARM, RADIO")
    auto_escalate_minutes: int = Field(..., description="Minutes before auto-escalation (0 = no auto-escalation)")
    acknowledgement_required: bool = Field(..., description="Whether operator acknowledgement is required")
    escalation_contact: str = Field(..., description="Role/contact for escalation")
    template_id: str = Field(..., description="Template identifier for alert formatting")


class ActionItem(BaseModel):
    """Individual action item."""
    immediate: List[str] = Field(default_factory=list, description="Immediate actions required")
    short_term: List[str] = Field(default_factory=list, description="Short-term follow-up actions")
    notifications: List[str] = Field(default_factory=list, description="Notification recipients")
    priority: str = Field(..., description="Action priority: EMERGENCY, URGENT, HIGH, MEDIUM, LOW, ROUTINE, UNKNOWN")
    sla_hours: int = Field(..., description="Service level agreement in hours")
    estimated_cost_tier: str = Field(..., description="Estimated cost: HIGH, MEDIUM, LOW, MINIMAL, NONE, UNKNOWN")
    simulated_response: Optional[SimulatedResponse] = Field(None, description="Simulated alert/response that would be sent")


class PredictResponse(BaseModel):
    """Response payload for leak prediction."""
    probs: List[float] = Field(..., description="Leak probability per window [0, 1]")
    preds: List[int] = Field(..., description="Binary prediction per window (0=no leak, 1=leak)")
    thr: float = Field(..., description="Threshold used for prediction")
    actions: Optional[List[ActionItem]] = Field(None, description="Recommended operational actions per window")
    metadata: Optional[List[dict]] = Field(None, description="Additional metadata per window (tier info, rule matched, etc.)")


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
    actions: Optional[ActionItem] = Field(None, description="Recommended operational actions")
    metadata: Optional[dict] = Field(None, description="Additional metadata (tier info, rule matched, etc.)")


class BatchPredictResponse(BaseModel):
    """Batch prediction response."""
    results: List[BatchPredictResult]
    summary: dict
    thr_used: float


class ModelInfo(BaseModel):
    """Individual model information."""
    name: str
    loaded: bool
    type: Optional[str] = None


class ModelsListResponse(BaseModel):
    """List of available models."""
    models: List[ModelInfo]
    default: str


class ModelSwitchRequest(BaseModel):
    """Request to switch default model."""
    model_name: str