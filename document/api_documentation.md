# PIPER API Documentation

Complete REST API reference for the PIPER Water Leakage Detection System.

---

## 📋 Base Information

| Property | Value |
|----------|-------|
| **Base URL** | `http://localhost:8000/api/v1` |
| **Protocol** | HTTP/1.1, HTTPS (production) |
| **Content-Type** | `application/json` |
| **Authentication** | None (local development) |
| **Rate Limiting** | None (configure in production) |

---

## 🏥 Health Check

### GET /health

Check service health and model status.

**Response**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_type": "GRU"
}
```

**Fields**
| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Service status ("healthy" or "degraded") |
| `model_loaded` | boolean | Whether the default model is loaded |
| `model_type` | string | Currently active model ("GRU" or "LSTM") |

**Status Codes**
- `200` - Healthy
- `503` - Model not loaded (degraded)

---

## 🤖 Model Management

### GET /models

List all available models and their load status.

**Response**
```json
{
  "models": [
    {"name": "gru", "loaded": true, "type": "GRUHead"},
    {"name": "lstm", "loaded": true, "type": "LSTMHead"}
  ],
  "default": "gru"
}
```

**Fields**
| Field | Type | Description |
|-------|------|-------------|
| `models` | array[object] | List of available models |
| `models[].name` | string | Model identifier ("gru" or "lstm") |
| `models[].loaded` | boolean | Whether model is loaded and ready |
| `models[].type` | string | Model architecture name |
| `default` | string | Currently default model |

---

### POST /models/switch

Switch the default model for subsequent requests.

**Request**
```json
{
  "model_name": "lstm"
}
```

**Request Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_name` | string | Yes | Model to switch to ("gru" or "lstm") |

**Response**
```json
{
  "message": "Switched to LSTM model",
  "default_model": "lstm"
}
```

**Status Codes**
- `200` - Success
- `400` - Invalid model name
- `503` - Requested model not loaded

---

### GET /model/info

Get model metadata and configuration for the current default model.

**Response**
```json
{
  "model": "GRUHead",
  "task": "cls",
  "window": 48,
  "stride": 1,
  "in_dim": 9,
  "feature_cols": [
    "Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean",
    "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"
  ],
  "hidden": 64,
  "num_layers": 2,
  "bidirectional": false,
  "dropout": 0.2,
  "thr": 0.6798978447914124,
  "metrics": null
}
```

**Fields**
| Field | Type | Description |
|-------|------|-------------|
| `model` | string | Model architecture name |
| `task` | string | Task type (cls = classification) |
| `window` | integer | Sequence window size (hours) |
| `stride` | integer | Sliding window stride |
| `in_dim` | integer | Input feature dimension |
| `feature_cols` | array[string] | Feature names in order |
| `hidden` | integer | Hidden units |
| `num_layers` | integer | Number of layers |
| `bidirectional` | boolean | Bidirectional RNN |
| `dropout` | number | Dropout rate |
| `thr` | number | Classification threshold |
| `metrics` | object | CV performance metrics (optional) |

---

### GET /model/{model_name}/info

Get model metadata for a specific model.

**Path Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `model_name` | string | "gru" or "lstm" |

**Response** - Same as `GET /model/info`

**Status Codes**
- `200` - Success
- `400` - Invalid model name
- `503` - Model not loaded

---

## 🔮 Prediction

### POST /predict

Run prediction on one or more sensor data windows.

**Request**
```json
{
  "windows": [
    [
      [12.0, 3.0, 1.0, 125.4, 125.1, 2.1, 3.4, 1.002, -0.5],
      [13.0, 3.0, 1.0, 125.2, 125.0, 2.0, 3.3, 1.001, -0.3],
      ...
    ]
  ],
  "feature_cols": [
    "Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean",
    "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"
  ],
  "thr": 0.68
}
```

**Request Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `windows` | array[array[array[number]]] | Yes | Batch of windows [B, 48, 9] |
| `feature_cols` | array[string] | No | Feature names (validated against model) |
| `thr` | number | No | Custom threshold (default: model threshold) |

**Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | No | Model to use: "gru" or "lstm" (default: current default) |
| `include_actions` | boolean | No | Include action recommendations (default: true) |

**Window Format**
- **Shape**: `[B, 48, 9]` where:
  - `B` = batch size (number of windows)
  - `48` = 48 hourly timesteps
  - `9` = 9 features per timestep
- **Order**: Must match `feature_cols` exactly

**Response (with actions)**
```json
{
  "probs": [0.7287633419036865],
  "preds": [1],
  "thr": 0.68,
  "actions": [
    {
      "immediate": [
        "Schedule inspection within 24 hours",
        "Increase monitoring to 2-hour intervals"
      ],
      "short_term": [
        "Plan investigation within 5 days",
        "Correlate with historical data"
      ],
      "notifications": [
        "Maintenance Planner (next business day)"
      ],
      "priority": "MEDIUM",
      "sla_hours": 72,
      "estimated_cost_tier": "LOW"
    }
  ],
  "metadata": [
    {
      "leak_tier": "MEDIUM",
      "leak_tier_label": "Probable Leak",
      "leak_tier_color": "yellow",
      "leak_tier_priority": 3,
      "degradation_tier": null,
      "degradation_score": null,
      "threshold_used": 0.68,
      "rule_matched": "MEDIUM_LEAK",
      "probability": 0.7287633419036865,
      "binary_prediction": 1
    }
  ]
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `probs` | array[number] | Leak probability per window [0, 1] |
| `preds` | array[integer] | Binary prediction (0=no leak, 1=leak) |
| `thr` | number | Threshold used |
| `actions` | array[object] | Recommended operational actions per window |
| `actions[].immediate` | array[string] | Immediate actions required |
| `actions[].short_term` | array[string] | Short-term follow-up actions |
| `actions[].notifications` | array[string] | Notification recipients |
| `actions[].priority` | string | EMERGENCY, URGENT, HIGH, MEDIUM, LOW, ROUTINE, UNKNOWN |
| `actions[].sla_hours` | integer | Service level agreement in hours |
| `actions[].estimated_cost_tier` | string | HIGH, MEDIUM, LOW, MINIMAL, NONE, UNKNOWN |
| `metadata` | array[object] | Additional metadata per window |
| `metadata[].leak_tier` | string | Probability tier (CRITICAL, HIGH, MEDIUM, LOW, NORMAL) |
| `metadata[].rule_matched` | string | Action rule that was triggered |

**Response (without actions - `include_actions=false`)**
```json
{
  "probs": [0.7287633419036865],
  "preds": [1],
  "thr": 0.68
}
```

**Status Codes**
- `200` - Success
- `400` - Invalid input (wrong shape, feature mismatch, NaN)
- `500` - Model not loaded or inference failed
- `503` - Requested model not loaded

---

### POST /predict/batch

Run batch prediction on the full frozen test set.

**Request**
```json
{
  "thr": 0.68
}
```

**Request Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `thr` | number | No | Custom threshold |

**Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | No | Model to use: "gru" or "lstm" (default: current default) |
| `include_actions` | boolean | No | Include action recommendations (default: true) |

**Response (with actions)**
```json
{
  "results": [
    {
      "meter_id": "mblr-2/00037896/volume",
      "timestamp_end": "2022-06-29 05:00:00",
      "y_true": 0,
      "prob": 5.82004759053234e-6,
      "pred": 0,
      "actions": {
        "immediate": ["Continue routine monitoring"],
        "short_term": [],
        "notifications": [],
        "priority": "ROUTINE",
        "sla_hours": 720,
        "estimated_cost_tier": "NONE"
      },
      "metadata": {
        "leak_tier": "NORMAL",
        "leak_tier_label": "Normal Operations",
        "leak_tier_color": "green",
        "rule_matched": "NORMAL_OPERATIONS",
        "probability": 5.82004759053234e-6,
        "binary_prediction": 0
      }
    }
  ],
  "summary": {
    "total": 110,
    "leaks_detected": 15,
    "actual_leaks": 17,
    "correct_predictions": 106,
    "accuracy": 0.9636363636363636,
    "action_priority_distribution": {
      "ROUTINE": 94,
      "URGENT": 14,
      "HIGH": 1,
      "MEDIUM": 1
    }
  },
  "thr_used": 0.68
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `results` | array[object] | Individual prediction results |
| `results[].meter_id` | string | Meter identifier |
| `results[].timestamp_end` | string | Window end timestamp |
| `results[].y_true` | integer | Ground truth label (0/1) |
| `results[].prob` | number | Leak probability |
| `results[].pred` | integer | Binary prediction (0/1) |
| `results[].actions` | object | Action recommendations (if enabled) |
| `results[].metadata` | object | Tier info and rule matched (if enabled) |
| `summary` | object | Aggregate statistics |
| `summary.total` | integer | Total windows evaluated |
| `summary.leaks_detected` | integer | Windows predicted as leak |
| `summary.actual_leaks` | integer | Actual leaks in test set |
| `summary.correct_predictions` | integer | Correct predictions |
| `summary.accuracy` | number | Overall accuracy |
| `summary.action_priority_distribution` | object | Count of windows per action priority |
| `thr_used` | number | Threshold used |

---

## 📊 Data Access

### GET /meters

List available meter IDs in the dataset.

**Response**
```json
{
  "meters": [
    "mblr-2/00037896/volume",
    "mblr-2/00037908/volume",
    "mblr-2/00038203/volume",
    "mblr-2/00038207/volume",
    "mblr-2/00038635/volume",
    "mblr-2/00082616/volume",
    "mblr-2/00082737/volume",
    "mblr-2/00082815/volume",
    "mblr-2/00082827/volume",
    "mblr-2/00082840/volume"
  ],
  "total": 10
}
```

---

### GET /data/sample

Get sample test windows for testing/exploration.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `n` | integer | 10 | Number of samples |
| `meter_ids` | string | - | Comma-separated meter IDs |
| `seed` | integer | 42 | Random seed |

**Example Requests**
```
GET /api/v1/data/sample
GET /api/v1/data/sample?n=5
GET /api/v1/data/sample?meter_ids=mblr-2/00037896/volume,mblr-2/00037908/volume
```

**Response**
```json
{
  "windows": [
    {
      "meter_id": "mblr-2/00037896/volume",
      "timestamp_end": "2022-06-29 05:00:00",
      "hour": 5,
      "y_true": 0,
      "features": [
        [5.0, 2.0, 6.0, 125.4, 125.1, 2.1, 3.4, 1.002, -0.5],
        ...
      ]
    }
  ],
  "feature_cols": [
    "Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean",
    "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"
  ],
  "window_size": 48,
  "total_available": 110
}
```

---

## 🚨 Error Handling

### Error Response Format
```json
{
  "detail": "Human-readable error message",
  "type": "error_category"
}
```

### Common Error Types
| Type | HTTP Status | Description |
|------|-------------|-------------|
| `validation_error` | 400 | Invalid request format or values |
| `model_error` | 500 | Model not loaded or inference failed |
| `data_error` | 404/500 | Data file missing or corrupt |

### Validation Errors
| Error | Cause | Solution |
|-------|-------|----------|
| `Feature count mismatch: got F=8, expected 9` | Wrong number of features | Ensure 9 features per timestep |
| `Feature order mismatch` | feature_cols order differs | Match training order exactly |
| `Window size must be 48` | Wrong timestep count | Provide exactly 48 hours |
| `Input contains NaN` | Missing values in input | Impute or remove NaN |
| `Input contains Inf` | Infinite values | Check for division by zero |

---

## 🌐 CORS Configuration

### Allowed Origins (Development)
```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

### Headers
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

---

## 📡 Example Usage

### cURL Examples

#### Health Check
```bash
curl http://localhost:8000/api/v1/health
```

#### List Models
```bash
curl http://localhost:8000/api/v1/models | jq
```

#### Get LSTM Model Info
```bash
curl http://localhost:8000/api/v1/model/lstm/info | jq
```

#### Switch to LSTM Model
```bash
curl -X POST http://localhost:8000/api/v1/models/switch \
  -H "Content-Type: application/json" \
  -d '{"model_name": "lstm"}'
```

#### Single Prediction (GRU - default)
```bash
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{
    "windows": [[[12,3,1,125.4,125.1,2.1,3.4,1.002,-0.5]] * 48],
    "feature_cols": ["Hour","DayOfWeek","Month","roll6_mean","roll24_mean","roll6_std","roll24_std","rel_to_roll24","Delta_Volume"],
    "thr": 0.68
  }'
```

#### Single Prediction (LSTM)
```bash
curl -X POST "http://localhost:8000/api/v1/predict?model=lstm" \
  -H "Content-Type: application/json" \
  -d '{
    "windows": [[[12,3,1,125.4,125.1,2.1,3.4,1.002,-0.5]] * 48],
    "feature_cols": ["Hour","DayOfWeek","Month","roll6_mean","roll24_mean","roll6_std","roll24_std","rel_to_roll24","Delta_Volume"],
    "thr": 0.68
  }'
```

#### Single Prediction with Actions
```bash
curl -X POST "http://localhost:8000/api/v1/predict?model=gru&include_actions=true" \
  -H "Content-Type: application/json" \
  -d '{
    "windows": [[[12,3,1,125.4,125.1,2.1,3.4,1.002,-0.5]] * 48],
    "feature_cols": ["Hour","DayOfWeek","Month","roll6_mean","roll24_mean","roll6_std","roll24_std","rel_to_roll24","Delta_Volume"],
    "thr": 0.68
  }'
```

#### Batch Prediction (GRU - default)
```bash
curl -X POST http://localhost:8000/api/v1/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"thr": 0.68}'
```

#### Batch Prediction (LSTM with Actions)
```bash
curl -X POST "http://localhost:8000/api/v1/predict/batch?model=lstm&include_actions=true" \
  -H "Content-Type: application/json" \
  -d '{"thr": 0.68}'
```

#### Get Meters
```bash
curl http://localhost:8000/api/v1/meters
```

#### Get Sample Data
```bash
curl "http://localhost:8000/api/v1/data/sample?n=3&meter_id=mblr-2/00037896/volume"
```

---

### Python Examples

#### Using requests
```python
import requests
import numpy as np

BASE = "http://localhost:8000/api/v1"

# Health
r = requests.get(f"{BASE}/health")
print(r.json())

# List all models
r = requests.get(f"{BASE}/models")
print(r.json())

# Model info (default)
r = requests.get(f"{BASE}/model/info")
info = r.json()
print(f"Model: {info['model']}, Threshold: {info['thr']}")

# LSTM Model info
r = requests.get(f"{BASE}/model/lstm/info")
info = r.json()
print(f"LSTM Model: {info['model']}, Threshold: {info['thr']}")

# Switch to LSTM
r = requests.post(f"{BASE}/models/switch", json={"model_name": "lstm"})
print(r.json())

# Prediction with GRU (default)
windows = np.random.randn(2, 48, 9).tolist()
payload = {
    "windows": windows,
    "feature_cols": ["Hour","DayOfWeek","Month","roll6_mean","roll24_mean","roll6_std","roll24_std","rel_to_roll24","Delta_Volume"],
    "thr": 0.68
}
r = requests.post(f"{BASE}/predict", json=payload)
result = r.json()
print(f"GRU - Probabilities: {result['probs']}")
print(f"GRU - Predictions: {result['preds']}")

# Prediction with LSTM
r = requests.post(f"{BASE}/predict?model=lstm", json=payload)
result = r.json()
print(f"LSTM - Probabilities: {result['probs']}")
print(f"LSTM - Predictions: {result['preds']}")

# Prediction with Actions
r = requests.post(f"{BASE}/predict?model=gru&include_actions=true", json=payload)
result = r.json()
print(f"Actions: {result['actions']}")
print(f"Metadata: {result['metadata']}")

# Batch with GRU (default)
r = requests.post(f"{BASE}/predict/batch", json={"thr": 0.68})
batch = r.json()
print(f"GRU Test Accuracy: {batch['summary']['accuracy']:.4f}")

# Batch with LSTM
r = requests.post(f"{BASE}/predict/batch?model=lstm", json={"thr": 0.68})
batch = r.json()
print(f"LSTM Test Accuracy: {batch['summary']['accuracy']:.4f}")

# Batch with Actions
r = requests.post(f"{BASE}/predict/batch?model=lstm&include_actions=true", json={"thr": 0.68})
batch = r.json()
print(f"Action distribution: {batch['summary']['action_priority_distribution']}")
```

---

### JavaScript/Fetch Examples

```javascript
const BASE = 'http://localhost:8000/api/v1';

// Health
const health = await fetch(`${BASE}/health`).then(r => r.json());
console.log(health);

// List models
const models = await fetch(`${BASE}/models`).then(r => r.json());
console.log(models);

// Prediction with LSTM and actions
const windows = Array(48).fill([12, 3, 1, 125.4, 125.1, 2.1, 3.4, 1.002, -0.5]);
const response = await fetch(`${BASE}/predict?model=lstm&include_actions=true`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    windows: [windows],
    feature_cols: ["Hour","DayOfWeek","Month","roll6_mean","roll24_mean","roll6_std","roll24_std","rel_to_roll24","Delta_Volume"],
    thr: 0.68
  })
});
const result = await response.json();
console.log('Leak probability:', result.probs[0]);
console.log('Prediction:', result.preds[0] === 1 ? 'LEAK' : 'NO LEAK');
console.log('Actions:', result.actions);
console.log('Metadata:', result.metadata);
```

---

## 📚 OpenAPI/Swagger

### Interactive Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Export OpenAPI Spec
```bash
curl http://localhost:8000/openapi.json > openapi.json
```

---

## 📋 Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/model/info` | Model metadata & metrics (default model) |
| GET | `/model/{model_name}/info` | Model metadata for specific model |
| GET | `/models` | List all available models |
| POST | `/models/switch` | Switch default model |
| POST | `/predict` | Single/multi-window prediction |
| POST | `/predict/batch` | Full test set prediction |
| GET | `/meters` | List available meters |
| GET | `/data/sample` | Get sample test windows |

### Required Feature Order (9 features)
```
1. Hour
2. DayOfWeek
3. Month
4. roll6_mean
5. roll24_mean
6. roll6_std
7. roll24_std
8. rel_to_roll24
9. Delta_Volume
```

### Window Shape
```
[Batch_Size, 48_Timesteps, 9_Features]
```

### Action Priority Levels
| Priority | SLA | Use Case |
|----------|-----|----------|
| EMERGENCY | 2 hours | Critical leak + severe degradation |
| URGENT | 4-8 hours | Critical/High probability leaks |
| HIGH | 24-48 hours | High probability, degraded assets |
| MEDIUM | 72 hours | Medium probability leaks |
| LOW | 168 hours | Low probability / suspected |
| ROUTINE | 720 hours | Normal operations |

---

## 🔧 Action Engine Configuration

### Configuration File: `backend/action_config.yaml`

The action engine is driven by a YAML configuration file that defines:

1. **Probability Tiers** - Maps probability ranges to leak severity tiers
2. **Degradation Tiers** - Maps degradation scores to severity (for future use)
3. **Action Rules** - Conditional rules that trigger specific actions

### Example Rule Structure
```yaml
action_rules:
  - id: "CRITICAL_SEVERE"
    condition:
      leak_tier: "CRITICAL"
      degradation_tier: "SEVERE"
    actions:
      immediate:
        - "Dispatch emergency repair crew immediately"
        - "Isolate affected network segment"
      short_term:
        - "Schedule full pipe replacement within 48 hours"
      notifications:
        - "Operations Manager (immediate)"
      priority: "EMERGENCY"
      sla_hours: 2
      estimated_cost_tier: "HIGH"
```

### Hot Reload
The action engine supports configuration hot-reload:
```python
from backend.action_engine import get_action_engine
engine = get_action_engine()
engine.reload_config()  # Reloads from YAML file
```

---

## 🔒 Security Notes

- **No authentication** in development mode
- **CORS** allows all origins in development
- **Production** should restrict CORS, add authentication, rate limiting
- **HTTPS** required in production
- **Input validation** via Pydantic schemas on all endpoints

---

## 📈 Performance

| Endpoint | Latency (typical) | Throughput |
|----------|-------------------|------------|
| `/health` | < 5 ms | > 10,000 req/s |
| `/model/info` | < 10 ms | > 5,000 req/s |
| `/predict` (1 window) | 20-50 ms | ~1,500 windows/s |
| `/predict/batch` (1000 windows) | 0.5-1 s | ~2,500 windows/s |
| `/predict` (with actions) | 25-60 ms | ~1,200 windows/s |

### Memory Usage
| Component | Memory |
|-----------|--------|
| GRU Model | ~2 MB |
| LSTM Model | ~3 MB |
| Scaler | ~1 KB |
| Action Engine | < 1 MB |
| **Total** | **< 10 MB** |

---

## 🔄 Versioning

Current API version: **v1**

Future versions will be under `/api/v2/` with backward compatibility maintained for v1.

---

## 📞 Support

- **Issues**: GitHub Issues
- **API Questions**: Check Swagger UI at `/docs`
- **Configuration**: See `backend/action_config.yaml` for action rules