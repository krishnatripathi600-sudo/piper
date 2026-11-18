# Backend Architecture

Detailed architecture of the PIPER FastAPI backend.

## 📁 Directory Structure

```
backend/
├── main.py              # FastAPI app, routes, middleware
├── model_loader.py      # GRU model loading & inference
├── data_service.py      # Test data access & sampling
├── schemas.py           # Pydantic request/response models
├── requirements.txt     # Python dependencies
└── __pycache__/
```

## 🚀 Main Application (`main.py`)

### App Initialization
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.model_loader import load_model, get_model_loader
from backend.data_service import DataService
from backend.schemas import *

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    load_model()  # Load GRU model
    app.state.data_service = DataService()
    yield
    # Shutdown (cleanup if needed)

app = FastAPI(
    title="PIPER API",
    description="Water Leakage Detection API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Route Organization
```python
# Health
@app.get("/api/v1/health", response_model=HealthResponse)
async def health(): ...

# Model Info
@app.get("/api/v1/model/info", response_model=ModelInfoResponse)
async def model_info(): ...

# Prediction
@app.post("/api/v1/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest): ...

# Batch Prediction
@app.post("/api/v1/predict/batch", response_model=BatchPredictionResponse)
async def predict_batch(request: BatchPredictionRequest): ...

# Data Access
@app.get("/api/v1/meters", response_model=MetersResponse)
async def list_meters(): ...

@app.get("/api/v1/data/sample", response_model=SampleDataResponse)
async def get_sample_data(n: int = 10, meter_id: Optional[str] = None): ...
```

## 🧠 Model Loader (`model_loader.py`)

### GRUHead Architecture
```python
class GRUHead(nn.Module):
    """Minimal GRU -> Linear head for per-timestep logits."""
    
    def __init__(
        self,
        in_dim: int,
        hidden: int = 64,
        num_layers: int = 2,
        bidirectional: bool = False,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.gru = nn.GRU(
            input_size=in_dim,
            hidden_size=hidden,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=bidirectional,
            dropout=0.0 if num_layers == 1 else dropout,
        )
        out_dim = hidden * (2 if bidirectional else 1)
        self.fc = nn.Linear(out_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: [B, T, F] → logits: [B, T]"""
        out, _ = self.gru(x)
        out = self.fc(out)
        return out.squeeze(-1)  # [B, T]
```

### ModelLoader Class
```python
class ModelLoader:
    """Loads and manages the GRU model for inference."""
    
    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self.model: Optional[GRUHead] = None
        self.scaler = None
        self.meta: Dict[str, Any] = {}
        self.thr: float = 0.5
        self.feature_cols: list[str] = []
        self._loaded = False

    def load(self) -> bool:
        """Load model artifacts from disk."""
        # 1. Load metadata (gru_cls_meta.json)
        # 2. Load threshold (gru_cls_thr.txt or env override)
        # 3. Initialize GRUHead architecture
        # 4. Load weights (gru_cls.pt)
        # 5. Load scaler (gru_cls_scaler.joblib)
        # 6. Set eval mode

    def predict(
        self,
        X: np.ndarray,  # [B, W, F] raw features
        thr: Optional[float] = None,
        client_feats: Optional[list[str]] = None,
    ) -> Tuple[list[float], list[int], float]:
        """Run inference on batch of windows."""
        # 1. Validate feature count & order
        # 2. Flatten [B, W, F] → [B*W, F] for scaling
        # 3. Apply training scaler
        # 4. Reshape back to [B, W, F]
        # 5. GRU forward pass (no_grad)
        # 6. Use last timestep logit
        # 7. Sigmoid → probability
        # 8. Apply threshold → binary prediction
```

### Singleton Pattern
```python
_model_loader: Optional[ModelLoader] = None

def get_model_loader(models_dir: Optional[Path] = None) -> ModelLoader:
    """Get or create the singleton model loader."""
    global _model_loader
    if _model_loader is None:
        if models_dir is None:
            models_dir = Path(__file__).parent.parent / "models"
        _model_loader = ModelLoader(models_dir)
    return _model_loader

def load_model(models_dir: Optional[Path] = None) -> bool:
    """Load the model (call on startup)."""
    loader = get_model_loader(models_dir)
    return loader.load()
```

## 📊 Data Service (`data_service.py`)

### DataService Class
```python
class DataService:
    """Provides access to test data and metadata."""
    
    def __init__(self, data_dir: Path, models_dir: Path):
        self.data_dir = data_dir
        self.models_dir = models_dir
        self._test_data: Optional[pd.DataFrame] = None
        self._meters: Optional[list[str]] = None

    def get_meters(self) -> list[str]:
        """List available meter IDs from CSV files."""
        # Scan LeakageData/ for *_with_leakages.csv

    def get_sample_windows(
        self,
        n: int = 10,
        meter_id: Optional[str] = None,
    ) -> Tuple[np.ndarray, list[str], list[dict]]:
        """Get n sample windows from test set."""
        # Load test_agg.parquet
        # Filter by meter_id if provided
        # Sample n windows
        # Return (windows, feature_cols, metadata)

    def get_batch_windows(self) -> Tuple[np.ndarray, list[str]]:
        """Get all windows for batch prediction."""
        # Load full test_agg.parquet
        # Return (windows, feature_cols)
```

### Test Data Format (test_agg.parquet)
| Column | Type | Description |
|--------|------|-------------|
| `meter_id` | string | Meter identifier |
| `window_idx` | int | Window index within meter |
| `timestamp` | datetime | Window end timestamp |
| `label` | int | Ground truth (0/1) |
| `Hour` | float | Hour of day |
| `DayOfWeek` | float | Day of week |
| `Month` | float | Month |
| `roll6_mean` | float | 6hr rolling mean |
| `roll24_mean` | float | 24hr rolling mean |
| `roll6_std` | float | 6hr rolling std |
| `roll24_std` | float | 24hr rolling std |
| `rel_to_roll24` | float | Relative to 24hr mean |
| `Delta_Volume` | float | Hourly volume change |

## 📝 Schemas (`schemas.py`)

### Request Models
```python
class PredictionRequest(BaseModel):
    windows: list[list[list[float]]]  # [B, W, F]
    feature_cols: list[str] = Field(default_factory=list)
    thr: Optional[float] = None

    @field_validator("windows")
    @classmethod
    def validate_windows(cls, v):
        # Check: non-empty, consistent dimensions
        # Check: W=48, F=9
        return v

class BatchPredictionRequest(BaseModel):
    thr: Optional[float] = None
```

### Response Models
```python
class PredictionResponse(BaseModel):
    probs: list[float]      # Leak probability per window
    preds: list[int]        # Binary prediction (0/1)
    thr: float              # Threshold used

class BatchPredictionResponse(BaseModel):
    predictions: list[PredictionResponse]
    metrics: Optional[dict] = None  # Accuracy, precision, recall, F1, confusion matrix
    meter_breakdown: Optional[list[dict]] = None

class ModelInfoResponse(BaseModel):
    model: str
    task: str
    window: int
    stride: int
    in_dim: int
    feature_cols: list[str]
    hidden: int
    num_layers: int
    bidirectional: bool
    dropout: float
    thr: float
    metrics: Optional[dict] = None
```

## ⚙️ Configuration

### Environment Variables (from `.env`)
```python
import os
from pathlib import Path

MODELS_DIR = Path(os.environ.get("MODELS_DIR", "../models"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "../LeakageData"))
THR_OVERRIDE = os.environ.get("THR_OVERRIDE", "0.68")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
FRONTEND_PORT = int(os.environ.get("FRONTEND_PORT", "3000"))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
```

### CORS Configuration
```python
# Allow frontend origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # Add production domains
]
```

## 🔌 API Endpoints Detail

### GET /api/v1/health
```json
// Response
{
  "status": "ok",
  "model_loaded": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /api/v1/model/info
```json
// Response
{
  "model": "GRUHead",
  "task": "cls",
  "window": 48,
  "stride": 1,
  "in_dim": 9,
  "feature_cols": ["Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean", "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"],
  "hidden": 64,
  "num_layers": 2,
  "bidirectional": false,
  "dropout": 0.2,
  "thr": 0.68,
  "metrics": {
    "accuracy": 0.92,
    "precision": 0.89,
    "recall": 0.85,
    "f1": 0.87,
    "auc": 0.95,
    "confusion_matrix": [[950, 50], [75, 425]]
  }
}
```

### POST /api/v1/predict
```json
// Request
{
  "windows": [[[1.0, 2.0, ...], ... 48 steps ...]],
  "feature_cols": ["Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean", "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"],
  "thr": 0.68
}

// Response
{
  "probs": [0.847],
  "preds": [1],
  "thr": 0.68
}
```

### POST /api/v1/predict/batch
```json
// Request
{
  "thr": 0.68
}

// Response
{
  "predictions": [
    {"probs": [0.12], "preds": [0], "thr": 0.68},
    {"probs": [0.91], "preds": [1], "thr": 0.68}
  ],
  "metrics": {
    "accuracy": 0.92,
    "precision": 0.89,
    "recall": 0.85,
    "f1": 0.87,
    "confusion_matrix": [[950, 50], [75, 425]]
  },
  "meter_breakdown": [
    {"meter_id": "1000647", "accuracy": 0.94, "f1": 0.89, "n_windows": 200},
    {"meter_id": "1000644", "accuracy": 0.90, "f1": 0.85, "n_windows": 180}
  ]
}
```

### GET /api/v1/meters
```json
// Response
{
  "meters": ["1000647", "1000644", "1000642", "1000640", "1000636", "1000634", "1000632", "1000630", "1000628", "1000626"]
}
```

### GET /api/v1/data/sample
```json
// Query: ?n=5&meter_id=1000647
// Response
{
  "windows": [[[...]], [[...]]],
  "feature_cols": ["Hour", "DayOfWeek", ...],
  "metadata": [
    {"meter_id": "1000647", "window_idx": 10, "timestamp": "2023-06-15T14:00:00", "label": 0},
    {"meter_id": "1000647", "window_idx": 11, "timestamp": "2023-06-15T15:00:00", "label": 1}
  ]
}
```

## 🛡️ Error Handling

### Exception Handlers
```python
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc), "type": "validation_error"}
    )

@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    return JSONResponse(
        status_code=500,
        content={"detail": "Model not loaded", "type": "model_error"}
    )
```

### Common Error Responses
| Status | Scenario | Response |
|--------|----------|----------|
| 400 | Invalid window dimensions | `{"detail": "Expected shape [B, 48, 9], got [B, 48, 8]"}` |
| 400 | Feature order mismatch | `{"detail": "Feature order mismatch. Expected: [...], Got: [...]"}` |
| 400 | Missing feature_cols | `{"detail": "feature_cols required for validation"}` |
| 500 | Model not loaded | `{"detail": "Model not loaded. Call load() first."}` |
| 500 | Model file missing | `{"detail": "Missing model artifacts in models/..."}` |

## 📈 Performance Optimization

### Model Caching
- **Singleton pattern**: Model loaded once at startup
- **No reloading**: Weights stay in memory
- **Thread-safe**: PyTorch `eval()` mode, `no_grad()` for inference

### Request Processing
```python
# Efficient batch processing
def predict(self, X: np.ndarray, ...):
    # 1. Vectorized scaling (no loop)
    flat = X.reshape(B * W, F)
    df = pd.DataFrame(flat, columns=self.feature_cols)
    flat_scaled = self.scaler.transform(df).astype(np.float32)
    xb = torch.from_numpy(flat_scaled.reshape(B, W, F))
    
    # 2. Single forward pass for entire batch
    with torch.no_grad():
        logits_bt = self.model(xb).detach().numpy()
    
    # 3. Vectorized post-processing
    last_logits = logits_bt[:, -1]
    probs = 1.0 / (1.0 + np.exp(-np.clip(last_logits, -20, 20)))
    preds = (probs >= threshold).astype(np.int32)
```

### Concurrency
- **Uvicorn workers**: Multiple processes for CPU parallelism
- **Async endpoints**: Non-blocking I/O for data loading
- **Thread pool**: For CPU-bound preprocessing (if needed)

## 🔧 Extensibility Points

### Adding New Endpoints
```python
# 1. Add schema in schemas.py
# 2. Add route in main.py
# 3. Add logic in model_loader.py or data_service.py
```

### Supporting New Models
```python
# In model_loader.py
class ModelLoader:
    def load(self):
        # Detect model type from meta.json
        model_type = self.meta.get("model", "GRUHead")
        if model_type == "GRUHead":
            self.model = GRUHead(...)
        elif model_type == "LSTMHead":
            self.model = LSTMHead(...)
        # ...
```

### Custom Preprocessing
```python
# In data_service.py
class DataService:
    def preprocess_window(self, raw_window: np.ndarray) -> np.ndarray:
        # Custom feature engineering
        return engineered_features
```

## 🧪 Testing

### Unit Tests Structure
```
backend/tests/
├── test_model_loader.py
├── test_data_service.py
├── test_schemas.py
└── test_api.py
```

### Example Test
```python
# test_api.py
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_predict():
    request = {
        "windows": [[[0.0]*9]*48],
        "feature_cols": ["Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean", "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"]
    }
    response = client.post("/api/v1/predict", json=request)
    assert response.status_code == 200
    data = response.json()
    assert "probs" in data
    assert "preds" in data
    assert len(data["probs"]) == 1
```