# API Reference

Complete REST API reference for the PIPER Backend.

## 📋 Base Information

| Property | Value |
|----------|-------|
| **Base URL** | `http://localhost:8000/api/v1` |
| **Protocol** | HTTP/1.1, HTTPS (production) |
| **Content-Type** | `application/json` |
| **Authentication** | None (local development) |
| **Rate Limiting** | None (configure in production) |

## 🏥 Health Check

### GET /health

Check service health and model status.

**Response**
```json
{
  "status": "ok",
  "model_loaded": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Status Codes**
- `200` - Healthy
- `503` - Model not loaded (degraded)

---

## 🤖 Model Information

### GET /model/info

Get model metadata, configuration, and performance metrics.

**Response**
```json
{
  "model": "GRUHead",
  "task": "cls",
  "window": 48,
  "stride": 1,
  "in_dim": 9,
  "feature_cols": [
    "Hour", "DayOfWeek", "Month",
    "roll6_mean", "roll24_mean",
    "roll6_std", "roll24_std",
    "rel_to_roll24", "Delta_Volume"
  ],
  "hidden": 64,
  "num_layers": 2,
  "bidirectional": false,
  "dropout": 0.2,
  "thr": 0.68,
  "metrics": {
    "accuracy": 0.924,
    "precision": 0.895,
    "recall": 0.862,
    "f1": 0.878,
    "auc": 0.954,
    "confusion_matrix": [[950, 50], [75, 425]]
  }
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
| `hidden` | integer | GRU hidden units |
| `num_layers` | integer | Number of GRU layers |
| `bidirectional` | boolean | Bidirectional RNN |
| `dropout` | number | Dropout rate |
| `thr` | number | Classification threshold |
| `metrics` | object | CV performance metrics |

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

---

### GET /model/{model_name}/info

Get model metadata for a specific model.

**Path Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `model_name` | string | "gru" or "lstm" |

**Response** - Same as `GET /model/info`

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

**Window Format**
- **Shape**: `[B, 48, 9]` where:
  - `B` = batch size (number of windows)
  - `48` = 48 hourly timesteps
  - `9` = 9 features per timestep
- **Order**: Must match `feature_cols` exactly

**Response**
```json
{
  "probs": [0.847, 0.123],
  "preds": [1, 0],
  "thr": 0.68
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `probs` | array[number] | Leak probability per window [0, 1] |
| `preds` | array[integer] | Binary prediction (0=no leak, 1=leak) |
| `thr` | number | Threshold used |

**Status Codes**
- `200` - Success
- `400` - Invalid input (wrong shape, feature mismatch, NaN)
- `500` - Model not loaded

**Error Response**
```json
{
  "detail": "Feature count mismatch: got F=8, expected 9",
  "type": "validation_error"
}
```

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

**Response**
```json
{
  "predictions": [
    {"probs": [0.12], "preds": [0], "thr": 0.68},
    {"probs": [0.91], "preds": [1], "thr": 0.68},
    ...
  ],
  "metrics": {
    "accuracy": 0.924,
    "precision": 0.895,
    "recall": 0.862,
    "f1": 0.878,
    "confusion_matrix": [[950, 50], [75, 425]]
  },
  "meter_breakdown": [
    {"meter_id": "1000647", "accuracy": 0.942, "f1": 0.901, "n_windows": 1240},
    {"meter_id": "1000644", "accuracy": 0.918, "f1": 0.865, "n_windows": 1180},
    ...
  ]
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `predictions` | array[object] | Individual predictions |
| `metrics` | object | Aggregate metrics on test set |
| `meter_breakdown` | array[object] | Per-meter performance |

---

## 📊 Data Access

### GET /meters

List available meter IDs in the dataset.

**Response**
```json
{
  "meters": [
    "1000647", "1000644", "1000642", "1000640",
    "1000636", "1000634", "1000632", "1000630",
    "1000628", "1000626"
  ]
}
```

---

### GET /data/sample

Get sample test windows for testing/exploration.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `n` | integer | 10 | Number of samples |
| `meter_id` | string | - | Filter by meter |

**Example Requests**
```
GET /api/v1/data/sample
GET /api/v1/data/sample?n=5
GET /api/v1/data/sample?meter_id=1000647
GET /api/v1/data/sample?n=3&meter_id=1000644
```

**Response**
```json
{
  "windows": [
    [[12.0, 3.0, 1.0, 125.4, 125.1, 2.1, 3.4, 1.002, -0.5], ...],
    [[13.0, 3.0, 1.0, 124.8, 124.9, 2.0, 3.3, 1.001, -0.3], ...]
  ],
  "feature_cols": [
    "Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean",
    "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"
  ],
  "metadata": [
    {
      "meter_id": "1000647",
      "window_idx": 10,
      "timestamp": "2023-06-15T14:00:00",
      "label": 0
    },
    {
      "meter_id": "1000647",
      "window_idx": 11,
      "timestamp": "2023-06-15T15:00:00",
      "label": 1
    }
  ]
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `windows` | array[array[array[number]]] | Sample windows [N, 48, 9] |
| `feature_cols` | array[string] | Feature names |
| `metadata` | array[object] | Window metadata |

**Metadata Fields**
| Field | Type | Description |
|-------|------|-------------|
| `meter_id` | string | Meter identifier |
| `window_idx` | integer | Window index in sequence |
| `timestamp` | string | Window end timestamp (ISO 8601) |
| `label` | integer | Ground truth (0/1) |

---

## 📝 Request/Response Schemas

### PredictionRequest
```json
{
  "windows": [[[number]]],
  "feature_cols": ["string"],
  "thr": number
}
```

### BatchPredictionRequest
```json
{
  "thr": number
}
```

### PredictionResponse
```json
{
  "probs": [number],
  "preds": [integer],
  "thr": number
}
```

### BatchPredictionResponse
```json
{
  "predictions": [PredictionResponse],
  "metrics": {
    "accuracy": number,
    "precision": number,
    "recall": number,
    "f1": number,
    "auc": number,
    "confusion_matrix": [[integer]]
  },
  "meter_breakdown": [
    {"meter_id": "string", "accuracy": number, "f1": number, "n_windows": integer}
  ]
}
```

### ModelInfoResponse
```json
{
  "model": "string",
  "task": "string",
  "window": integer,
  "stride": integer,
  "in_dim": integer,
  "feature_cols": ["string"],
  "hidden": integer,
  "num_layers": integer,
  "bidirectional": boolean,
  "dropout": number,
  "thr": number,
  "metrics": {}
}
```

### HealthResponse
```json
{
  "status": "string",
  "model_loaded": boolean,
  "timestamp": "string"
}
```

### MetersResponse
```json
{
  "meters": ["string"]
}
```

### SampleDataResponse
```json
{
  "windows": [[[number]]],
  "feature_cols": ["string"],
  "metadata": [
    {"meter_id": "string", "window_idx": integer, "timestamp": "string", "label": integer}
  ]
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
    "http://localhost:5173",  # Vite default
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

#### Model Info
```bash
curl http://localhost:8000/api/v1/model/info | jq
```

#### List All Models
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

#### Batch Prediction (GRU - default)
```bash
curl -X POST http://localhost:8000/api/v1/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"thr": 0.68}'
```

#### Batch Prediction (LSTM)
```bash
curl -X POST "http://localhost:8000/api/v1/predict/batch?model=lstm" \
  -H "Content-Type: application/json" \
  -d '{"thr": 0.68}'
```

#### Get Meters
```bash
curl http://localhost:8000/api/v1/meters
```

#### Get Sample Data
```bash
curl "http://localhost:8000/api/v1/data/sample?n=3&meter_id=1000647"
```

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

# Batch with GRU (default)
r = requests.post(f"{BASE}/predict/batch", json={"thr": 0.68})
batch = r.json()
print(f"GRU Test Accuracy: {batch['summary']['accuracy']:.4f}")

# Batch with LSTM
r = requests.post(f"{BASE}/predict/batch?model=lstm", json={"thr": 0.68})
batch = r.json()
print(f"LSTM Test Accuracy: {batch['summary']['accuracy']:.4f}")
```

#### Using the sample endpoint
```python
# Get sample for testing
r = requests.get(f"{BASE}/data/sample", params={"n": 1})
sample = r.json()

# Use sample directly for prediction
payload = {
    "windows": sample["windows"],
    "feature_cols": sample["feature_cols"]
}
r = requests.post(f"{BASE}/predict", json=payload)
print(r.json())
```

### JavaScript/Fetch Examples

```javascript
const BASE = 'http://localhost:8000/api/v1';

// Health
const health = await fetch(`${BASE}/health`).then(r => r.json());
console.log(health);

// Prediction
const windows = Array(48).fill([12, 3, 1, 125.4, 125.1, 2.1, 3.4, 1.002, -0.5]);
const response = await fetch(`${BASE}/predict`, {
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