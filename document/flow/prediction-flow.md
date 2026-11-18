# Prediction Flow

Detailed request/response lifecycle for PIPER prediction API.

## 🔄 Single Prediction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SINGLE PREDICTION REQUEST FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLIENT                                                                     │
│   │                                                                        │
│   │  POST /api/v1/predict                                                  │
│   │  {                                                                    │
│   │    "windows": [[[f1,f2,...f9]] * 48],  // [1, 48, 9]                 │
│   │    "feature_cols": [...],               // Optional validation       │
│   │    "thr": 0.68                          // Optional threshold        │
│   │  }                                                                    │
│   ▼                                                                        │
│                                                                             │
│  BACKEND (FastAPI)                                                         │
│   │                                                                        │
│   ├── 1. REQUEST VALIDATION (Pydantic)                                    │
│   │   ├── Check JSON structure                                            │
│   │   ├── Validate windows: [B, 48, 9]                                    │
│   │   ├── Validate feature_cols length == 9                               │
│   │   └── Validate thr in [0, 1]                                          │
│   │                                                                        │
│   ├── 2. MODEL ACCESS                                                     │
│   │   ├── Get singleton ModelLoader                                       │
│   │   ├── Check model._loaded == True                                     │
│   │   └── Retrieve scaler, threshold, feature_cols                        │
│   │                                                                        │
│   ├── 3. INPUT VALIDATION (ModelLoader)                                   │
│   │   ├── Convert to numpy: X = np.array(windows)  // [B, 48, 9]         │
│   │   ├── Check F == len(model.feature_cols) == 9                         │
│   │   ├── Check feature_cols matches model order (if provided)           │
│   │   └── Check for NaN/Inf in X                                          │
│   │                                                                        │
│   ├── 4. PREPROCESSING                                                    │
│   │   ├── Flatten: flat = X.reshape(B*48, 9)  // [B*48, 9]               │
│   │   ├── DataFrame: df = pd.DataFrame(flat, columns=feature_cols)       │
│   │   ├── Scale: flat_scaled = scaler.transform(df).astype(float32)      │
│   │   └── Reshape: xb = torch.from_numpy(flat_scaled.reshape(B, 48, 9))  │
│   │                                                                        │
│   ├── 5. INFERENCE                                                        │
│   │   ├── model.eval()                                                    │
│   │   ├── with torch.no_grad():                                           │
│   │   │   └── logits_bt = model(xb).numpy()  // [B, 48]                  │
│   │   └── last_logits = logits_bt[:, -1]  // [B] (last timestep)         │
│   │                                                                        │
│   ├── 6. POST-PROCESSING                                                  │
│   │   ├── Clip: last_logits = np.clip(last_logits, -20, 20)              │
│   │   ├── Sigmoid: probs = 1 / (1 + exp(-last_logits))  // [0, 1]        │
│   │   ├── Threshold: preds = (probs >= thr).astype(int32)  // 0/1        │
│   │   └── Convert to Python lists                                         │
│   │                                                                        │
│   └── 7. RESPONSE                                                         │
│       └── Return JSON: {probs, preds, thr}                                │
│                                                                             │
│   ▼                                                                        │
│                                                                             │
│  CLIENT                                                                    │
│   │                                                                        │
│   │  {                                                                    │
│   │    "probs": [0.847],    // Leak probability per window               │
│   │    "preds": [1],        // Binary prediction (0/1)                   │
│   │    "thr": 0.68          // Threshold used                            │
│   │  }                                                                    │
│   ▼                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📝 Request Processing Details

### 1. Request Validation (Pydantic Schema)

```python
# backend/schemas.py
class PredictionRequest(BaseModel):
    windows: list[list[list[float]]]  # [B, W, F]
    feature_cols: list[str] = Field(default_factory=list)
    thr: Optional[float] = None

    @field_validator("windows")
    @classmethod
    def validate_windows(cls, v):
        if not v:
            raise ValueError("windows cannot be empty")
        
        # Check all windows have same shape
        batch_size = len(v)
        window_size = len(v[0]) if v[0] else 0
        n_features = len(v[0][0]) if v[0] and v[0][0] else 0
        
        for i, window in enumerate(v):
            if len(window) != window_size:
                raise ValueError(f"Window {i} has {len(window)} timesteps, expected {window_size}")
            for j, step in enumerate(window):
                if len(step) != n_features:
                    raise ValueError(f"Window {i}, step {j} has {len(step)} features, expected {n_features}")
        
        if window_size != 48:
            raise ValueError(f"Window size must be 48, got {window_size}")
        if n_features != 9:
            raise ValueError(f"Features must be 9, got {n_features}")
        
        return v

    @field_validator("thr")
    @classmethod
    def validate_thr(cls, v):
        if v is not None and not (0 <= v <= 1):
            raise ValueError("Threshold must be between 0 and 1")
        return v
```

### 2. Model Access (Singleton)

```python
# backend/model_loader.py
_model_loader: Optional[ModelLoader] = None

def get_model_loader(models_dir: Optional[Path] = None) -> ModelLoader:
    global _model_loader
    if _model_loader is None:
        if models_dir is None:
            models_dir = Path(__file__).parent.parent / "models"
        _model_loader = ModelLoader(models_dir)
    return _model_loader

# In route handler:
from backend.model_loader import get_model_loader

@app.post("/api/v1/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    loader = get_model_loader()
    if not loader.is_loaded():
        raise RuntimeError("Model not loaded")
    # ... use loader
```

### 3. Input Validation (ModelLoader)

```python
# backend/model_loader.py - predict method
def predict(
    self,
    X: np.ndarray,  # [B, W, F] raw features
    thr: Optional[float] = None,
    client_feats: Optional[list[str]] = None,
) -> Tuple[list[float], list[int], float]:
    
    # Check loaded
    if not self._loaded:
        raise RuntimeError("Model not loaded. Call load() first.")
    
    # Validate shape
    B, W, F = X.shape
    if F != len(self.feature_cols):
        raise ValueError(
            f"Feature count mismatch: got F={F}, expected {len(self.feature_cols)}"
        )
    
    # Validate feature order
    if client_feats is not None:
        if list(client_feats) != list(self.feature_cols):
            raise ValueError(
                f"Feature order mismatch.\nExpected: {self.feature_cols}\nGot:      {client_feats}"
            )
    
    # Check NaN/Inf
    if np.isnan(X).any():
        raise ValueError("Input contains NaN values")
    if not np.isfinite(X).all():
        raise ValueError("Input contains infinite values")
```

### 4. Preprocessing Pipeline

```python
# backend/model_loader.py - predict method (continued)

# Use request threshold or default
threshold = float(thr) if thr is not None else self.thr

# 1. Flatten for scaling: [B, W, F] -> [B*W, F]
flat = X.reshape(B * W, F)

# 2. DataFrame with correct column order
df = pd.DataFrame(flat, columns=self.feature_cols)

# 3. Apply TRAINING scaler (StandardScaler)
#    IMPORTANT: transform only, never fit!
flat_scaled = self.scaler.transform(df).astype(np.float32)

# 4. Reshape back to [B, W, F]
xb = torch.from_numpy(flat_scaled.reshape(B, W, F))

# xb is now ready for model: [B, 48, 9] float32 tensor
```

### 5. Inference

```python
# backend/model_loader.py - predict method (continued)

# Inference
with torch.no_grad():
    logits_bt = self.model(xb).detach().numpy()  # [B, 48]

# Use last timestep logit for classification
last_logits = logits_bt[:, -1]  # [B]
```

### 6. Post-Processing

```python
# backend/model_loader.py - predict method (continued)

# Numerical stability: clip logits before sigmoid
last_logits = np.clip(last_logits, -20.0, 20.0)

# Sigmoid: logit -> probability
probs = 1.0 / (1.0 + np.exp(-last_logits))  # [B] in (0, 1)

# Threshold: probability -> binary prediction
preds = (probs >= threshold).astype(np.int32)  # [B] 0 or 1

return probs.tolist(), preds.tolist(), threshold
```

---

## 📦 Batch Prediction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BATCH PREDICTION REQUEST FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLIENT                                                                     │
│   │                                                                        │
│   │  POST /api/v1/predict/batch                                            │
│   │  {"thr": 0.68}  // Optional custom threshold                          │
│   ▼                                                                        │
│                                                                             │
│  BACKEND                                                                    │
│   │                                                                        │
│   ├── 1. VALIDATE REQUEST                                                  │
│   │   └── Check thr in [0, 1]                                             │
│   │                                                                        │
│   ├── 2. LOAD TEST DATA (DataService)                                      │
│   │   ├── Read models/artifacts/test_agg.parquet                          │
│   │   ├── Extract windows [N, 48, 9] and labels [N]                       │
│   │   └── Extract feature_cols and metadata                               │
│   │                                                                        │
│   ├── 3. PREPROCESS ALL WINDOWS                                            │
│   │   ├── Scale using training scaler (vectorized)                        │
│   │   └── Convert to tensor [N, 48, 9]                                    │
│   │                                                                        │
│   ├── 4. BATCH INFERENCE                                                   │
│   │   ├── Model forward pass on entire dataset                            │
│   │   │   logits = model(xb)  // [N, 48]                                  │
│   │   ├── Extract last timestep: logits[:, -1]  // [N]                    │
│   │   ├── Sigmoid + threshold                                              │
│   │   └── Generate individual PredictionResponse objects                  │
│   │                                                                        │
│   ├── 5. COMPUTE METRICS                                                   │
│   │   ├── Compare preds vs ground truth labels                            │
│   │   ├── Calculate: accuracy, precision, recall, F1, AUC                 │
│   │   ├── Confusion matrix                                                │
│   │   └── Per-meter breakdown                                             │
│   │                                                                        │
│   └── 6. RETURN AGGREGATED RESPONSE                                        │
│       {                                                                     │
│         "predictions": [...],  // Per-window results                      │
│         "metrics": {...},      // Aggregate metrics                       │
│         "meter_breakdown": [...]  // Per-meter stats                      │
│       }                                                                    │
│                                                                             │
│   ▼                                                                        │
│                                                                             │
│  CLIENT                                                                    │
│   │                                                                        │
│   │  {                                                                    │
│   │    "predictions": [                                                   │
│   │      {"probs": [0.12], "preds": [0], "thr": 0.68},                  │
│   │      {"probs": [0.91], "preds": [1], "thr": 0.68},                  │
│   │      ...                                                              │
│   │    ],                                                                 │
│   │    "metrics": {                                                       │
│   │      "accuracy": 0.924,                                               │
│   │      "precision": 0.895,                                              │
│   │      "recall": 0.862,                                                 │
│   │      "f1": 0.878,                                                     │
│   │      "confusion_matrix": [[950, 50], [75, 425]]                      │
│   │    },                                                                 │
│   │    "meter_breakdown": [                                               │
│   │      {"meter_id": "1000647", "accuracy": 0.94, "f1": 0.90,           │
│   │       "n_windows": 1240},                                             │
│   │      ...                                                              │
│   │    ]                                                                  │
│   │  }                                                                    │
│   ▼                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Batch Implementation Details

```python
# backend/main.py - predict_batch endpoint
@app.post("/api/v1/predict/batch", response_model=BatchPredictionResponse)
async def predict_batch(request: BatchPredictionRequest):
    loader = get_model_loader()
    data_service = request.app.state.data_service
    
    # 1. Load test data
    X_test, feature_cols = data_service.get_batch_windows()
    # X_test: [N, 48, 9], feature_cols: list[str]
    
    # Get ground truth labels
    test_df = data_service._load_test_data()
    y_true = test_df['label'].values  # [N]
    
    # 2. Run prediction (uses loader.predict internally)
    probs, preds, thr = loader.predict(X_test, thr=request.thr)
    
    # 3. Build individual responses
    predictions = [
        PredictionResponse(probs=[p], preds=[int(pred)], thr=thr)
        for p, pred in zip(probs, preds)
    ]
    
    # 4. Compute aggregate metrics
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
    
    metrics = {
        "accuracy": accuracy_score(y_true, preds),
        "precision": precision_score(y_true, preds),
        "recall": recall_score(y_true, preds),
        "f1": f1_score(y_true, preds),
        "auc": roc_auc_score(y_true, probs),
        "confusion_matrix": confusion_matrix(y_true, preds).tolist(),
    }
    
    # 5. Per-meter breakdown
    meter_breakdown = []
    test_df = test_df.copy()
    test_df['pred'] = preds
    test_df['prob'] = probs
    
    for meter_id in test_df['meter_id'].unique():
        m_df = test_df[test_df['meter_id'] == meter_id]
        meter_breakdown.append({
            "meter_id": meter_id,
            "accuracy": accuracy_score(m_df['label'], m_df['pred']),
            "f1": f1_score(m_df['label'], m_df['pred']),
            "n_windows": len(m_df),
        })
    
    return BatchPredictionResponse(
        predictions=predictions,
        metrics=metrics,
        meter_breakdown=meter_breakdown,
    )
```

---

## 🎨 Frontend Integration Flow

### Predict Page Flow (`src/pages/Predict.tsx`)

```typescript
// 1. STATE MANAGEMENT
const [inputMethod, setInputMethod] = useState<'manual' | 'sample' | 'json' | 'csv'>('sample')
const [windows, setWindows] = useState<number[][][]>([])
const [featureCols, setFeatureCols] = useState<string[]>(DEFAULT_FEATURE_COLS)
const [threshold, setThreshold] = useState(0.68)
const [result, setResult] = useState<PredictionResponse | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

// 2. HOOKS
const predictMutation = usePredict({
  onSuccess: (data) => {
    setResult(data)
    setLoading(false)
  },
  onError: (err) => {
    setError(err.message)
    setLoading(false)
  },
})

const { data: sampleData } = useSampleData({ n: 1 })

// 3. HANDLERS
const handlePredict = async () => {
  setLoading(true)
  setError(null)
  
  const payload: PredictionRequest = {
    windows,
    feature_cols: featureCols,
    thr: threshold,
  }
  
  predictMutation.mutate(payload)
}

const handleSampleLoad = () => {
  if (sampleData) {
    setWindows(sampleData.windows)
    setFeatureCols(sampleData.feature_cols)
  }
}

// 4. RENDER
return (
  <div>
    {/* Input Method Tabs */}
    <Tabs defaultValue="sample" onValueChange={setInputMethod}>
      <TabsList>
        <TabsTrigger value="sample">Sample Data</TabsTrigger>
        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        <TabsTrigger value="json">JSON Input</TabsTrigger>
        <TabsTrigger value="csv">CSV Upload</TabsTrigger>
      </TabsList>
      
      {/* Sample Tab */}
      <TabsContent value="sample">
        <Button onClick={handleSampleLoad} disabled={loading}>
          Load Sample Window
        </Button>
        {sampleData && (
          <WindowEditor 
            windows={sampleData.windows} 
            featureCols={sampleData.feature_cols}
            onChange={setWindows}
          />
        )}
      </TabsContent>
      
      {/* Other tabs... */}
    </Tabs>
    
    {/* Threshold Slider */}
    <ThresholdSlider value={threshold} onChange={setThreshold} />
    
    {/* Predict Button */}
    <Button onClick={handlePredict} loading={loading}>
      Run Prediction
    </Button>
    
    {/* Results */}
    {result && (
      <PredictionResult 
        prob={result.probs[0]} 
        pred={result.preds[0]} 
        thr={result.thr}
      />
    )}
    
    {error && <Alert variant="destructive">{error}</Alert>}
  </div>
)
```

### Prediction Result Display

```typescript
// src/components/PredictionResult.tsx
interface PredictionResultProps {
  prob: number
  pred: number
  thr: number
}

export function PredictionResult({ prob, pred, thr }: PredictionResultProps) {
  const isLeak = pred === 1
  const confidence = isLeak ? prob : 1 - prob
  
  return (
    <Card className="mt-6">
      <CardHeader>
        <h3 className="text-lg font-semibold">Prediction Result</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Binary Result Badge */}
        <div className="text-center">
          <Badge 
            variant={isLeak ? 'destructive' : 'success'} 
            className="text-lg px-4 py-2"
          >
            {isLeak ? '🚨 LEAK DETECTED' : '✅ NO LEAK'}
          </Badge>
        </div>
        
        {/* Probability Gauge */}
        <div className="text-center">
          <div className="text-4xl font-bold text-primary-600">
            {(prob * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            Leak Probability (threshold: {thr})
          </div>
          <Progress value={prob * 100} className="mt-2 h-4" />
        </div>
        
        {/* Confidence Interpretation */}
        <ConfidenceInterpretation confidence={confidence} />
        
        {/* Raw Values */}
        <details className="text-sm text-gray-500">
          <summary>Raw Output</summary>
          <pre className="mt-2 p-2 bg-gray-50 rounded">
            {{"probs": [prob], "preds": [pred], "thr": thr}}
          </pre>
        </details>
      </CardContent>
    </Card>
  )
}
```

---

## ⚡ Performance Characteristics

### Latency Breakdown (Typical)

| Stage | Time (ms) | Notes |
|-------|-----------|-------|
| Request parsing | 1-2 | Pydantic validation |
| Input validation | 1-2 | Shape/order checks |
| Preprocessing (scaling) | 5-15 | Pandas + scaler transform |
| Model inference | 10-30 | PyTorch GRU forward pass |
| Post-processing | 1-2 | Sigmoid + threshold |
| Response serialization | 1-2 | JSON encoding |
| **Total** | **20-50** | Single window, CPU |

### Batch Prediction Latency

| Dataset Size | Time (s) | Throughput |
|--------------|----------|------------|
| 1,000 windows | 0.5-1.0 | ~1,500 windows/s |
| 10,000 windows | 3-5 | ~2,500 windows/s |
| 50,000 windows | 15-25 | ~2,500 windows/s |

### Memory Usage

| Component | Memory |
|-----------|--------|
| Model (GRU) | ~2 MB |
| Scaler | ~1 KB |
| Input batch (1000 windows) | ~1.4 MB |
| Intermediate tensors | ~3 MB |
| **Total** | **< 10 MB** |

---

## 🔒 Error Handling in Flow

### Client-Side Errors (4xx)

| Error | HTTP Code | Client Action |
|-------|-----------|---------------|
| Invalid JSON | 400 | Fix request format |
| Window shape mismatch | 400 | Ensure [B, 48, 9] |
| Feature count mismatch | 400 | Provide 9 features |
| Feature order mismatch | 400 | Match training order |
| NaN in input | 400 | Clean input data |
| Threshold out of range | 400 | Use 0.0-1.0 |

### Server-Side Errors (5xx)

| Error | HTTP Code | Resolution |
|-------|-----------|------------|
| Model not loaded | 500 | Check model artifacts exist |
| Inference failed | 500 | Check PyTorch, input data |
| Data file missing | 500 | Verify test_agg.parquet |

### Retry Logic (Frontend)

```typescript
// In usePredict hook
const predictMutation = usePredict({
  retry: 1,
  retryDelay: 1000,
  onError: (err) => {
    if (err.message.includes('500')) {
      // Server error - maybe model reload needed
      toast.error('Server error. Please try again.')
    } else {
      // Client error - show validation message
      toast.error(err.message)
    }
  },
})
```

---

## 📋 Quick Reference

### Request Format
```json
{
  "windows": [[[f1,f2,f3,f4,f5,f6,f7,f8,f9]] * 48],
  "feature_cols": ["Hour","DayOfWeek","Month","roll6_mean","roll24_mean","roll6_std","roll24_std","rel_to_roll24","Delta_Volume"],
  "thr": 0.68
}
```

### Response Format
```json
{
  "probs": [0.847],
  "preds": [1],
  "thr": 0.68
}
```

### Feature Order (Critical!)
```
1. Hour              (0-23)
2. DayOfWeek         (0-6)
3. Month             (1-12)
4. roll6_mean        (float)
5. roll24_mean       (float)
6. roll6_std         (float >= 0)
7. roll24_std        (float >= 0)
8. rel_to_roll24     (float, ~1.0)
9. Delta_Volume      (float, can be negative)
```

### cURL Template
```bash
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d @payload.json
```

### Python Template
```python
import requests
import numpy as np

# Generate or load windows [B, 48, 9]
windows = np.random.randn(1, 48, 9).tolist()

response = requests.post(
    "http://localhost:8000/api/v1/predict",
    json={
        "windows": windows,
        "feature_cols": DEFAULT_FEATURE_COLS,
        "thr": 0.68
    }
)

result = response.json()
print(f"Leak probability: {result['probs'][0]:.3f}")
print(f"Prediction: {'LEAK' if result['preds'][0] else 'NO LEAK'}")
```