# Data Flow

Complete data processing flow for PIPER Water Leakage Detection System.

## 🔄 End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PIPER DATA FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SOURCE DATA                    PROCESSING                    ARTIFACTS     │
│  ───────────                    ───────────                    ─────────    │
│                                                                             │
│  LeakageData/                                                            │
│  1000647_with_leakages.csv   ──┐                                         │
│  1000644_with_leakages.csv     │                                         │
│  1000642_with_leakages.csv     │  1. LOAD & COMBINE                      │
│  ... (10 files)                │  (ParserCreator.py)                     │
│                                ▼                                         │
│                         ┌─────────────────┐                             │
│                         │ Combined DataFrame│                            │
│                         │ [N_total, 3]     │                             │
│                         │ timestamp,      │                             │
│                         │ volume, meter_id│                             │
│                         └─────────────────┘                             │
│                                │                                         │
│                                ▼                                         │
│                         ┌─────────────────┐                             │
│                         │ 2. RESAMPLE     │                             │
│                         │ Hourly freq     │                             │
│                         │ (fill gaps)     │                             │
│                         └─────────────────┘                             │
│                                │                                         │
│                                ▼                                         │
│                         ┌─────────────────┐                             │
│                         │ 3. IMPUTE GAPS  │                             │
│                         │ Conservative    │                             │
│                         │ step-preserving │                             │
│                         └─────────────────┘                             │
│                                │                                         │
│                                ▼                                         │
│                         ┌─────────────────┐                             │
│                         │ 4. FEATURES     │                             │
│                         │ 9 features/tstep│                             │
│                         │ (DataAggregation)│                            │
│                         └─────────────────┘                             │
│                                │                                         │
│                                ▼                                         │
│                         ┌─────────────────┐                             │
│                         │ 5. LEAK SYNTHESIS│                            │
│                         │ Progressive     │                             │
│                         │ realistic leaks │                             │
│                         └─────────────────┘                             │
│                                │                                         │
│                                ▼                                         │
│                         ┌─────────────────┐                             │
│                         │ 6. CV SPLIT     │                             │
│                         │ Per-meter       │                             │
│                         │ Forward-chaining│                             │
│                         │ 10 folds        │                             │
│                         └─────────────────┘                             │
│                                │                                         │
│                    ┌───────────┴───────────┐                            │
│                    ▼                       ▼                            │
│            ┌───────────────┐       ┌───────────────┐                   │
│            │ TRAIN FOLD    │       │ VAL FOLD      │                   │
│            │ (expanding)   │       │ (next period) │                   │
│            └───────────────┘       └───────────────┘                   │
│                    │                       │                            │
│                    ▼                       ▼                            │
│            ┌───────────────┐       ┌───────────────┐                   │
│            │ 7. SCALE      │       │ 7. SCALE      │                   │
│            │ Fit scaler    │       │ Transform     │                   │
│            │ Transform     │       │ (same scaler) │                   │
│            └───────────────┘       └───────────────┘                   │
│                    │                       │                            │
│                    ▼                       ▼                            │
│            ┌───────────────┐       ┌───────────────┐                   │
│            │ 8. WINDOW     │       │ 8. WINDOW     │                   │
│            │ [B, 48, 9]    │       │ [B, 48, 9]    │                   │
│            └───────────────┘       └───────────────┘                   │
│                    │                       │                            │
│                    ▼                       ▼                            │
│            ┌─────────────────────────────────────────┐                 │
│            │ 9. MODEL TRAINING (per fold)            │                 │
│            │ GRU: 2-layer, 64 hidden, dropout=0.2    │                 │
│            │ Loss: BCEWithLogitsLoss                 │                 │
│            │ Opt: AdamW, lr=1e-3                     │                 │
│            │ Early stop: val F1, patience=10         │                 │
│            └─────────────────────────────────────────┘                 │
│                    │                                                     │
│                    ▼                                                     │
│            ┌─────────────────────────────────────────┐                 │
│            │ 10. THRESHOLD OPTIMIZATION              │                 │
│            │ Per-fold F1-optimal threshold           │                 │
│            │ Final: median across folds              │                 │
│            └─────────────────────────────────────────┘                 │
│                    │                                                     │
│                    ▼                                                     │
│            ┌─────────────────────────────────────────┐                 │
│            │ 11. FINAL RETRAIN ON ALL DATA           │                 │
│            │ Retrain best model on train+val         │                 │
│            └─────────────────────────────────────────┘                 │
│                    │                                                     │
│                    ▼                                                     │
│            ┌─────────────────────────────────────────┐                 │
│            │ 12. SAVE ARTIFACTS                      │                 │
│            │ models/                                 │                 │
│            │ ├── gru_cls.pt                          │                 │
│            │ ├── gru_cls_scaler.joblib               │                 │
│            │ ├── gru_cls_meta.json                   │                 │
│            │ ├── gru_cls_thr.txt                     │                 │
│            │ ├── gru_cls_metrics.json                │                 │
│            │ └── artifacts/                          │                 │
│            │     └── test_agg.parquet                │                 │
│            └─────────────────────────────────────────┘                 │
│                    │                                                     │
│                    ▼                                                     │
│            INFERENCE PIPELINE                                           │
│            ┌─────────────────────────────────────────┐                 │
│            │ Raw Input [B, 48, 9]                    │                 │
│            │     │                                   │                 │
│            │     ▼                                   │                 │
│            │ Validate shape, order, NaN              │                 │
│            │     │                                   │                 │
│            │     ▼                                   │                 │
│            │ Scale (gru_cls_scaler.joblib)           │                 │
│            │     │                                   │                 │
│            │     ▼                                   │                 │
│            │ GRU Inference (gru_cls.pt)              │                 │
│            │     │                                   │                 │
│            │     ▼                                   │                 │
│            │ Last timestep logit                     │                 │
│            │     │                                   │                 │
│            │     ▼                                   │                 │
│            │ Sigmoid → Probability                   │                 │
│            │     │                                   │                 │
│            │     ▼                                   │                 │
│            │ Threshold (0.68) → Binary               │                 │
│            │     │                                   │                 │
│            │     ▼                                   │                 │
│            │ {probs, preds, thr}                     │                 │
│            └─────────────────────────────────────────┘                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Formats at Each Stage

### Stage 1: Raw CSV (`LeakageData/`)
```csv
# 1000647_with_leakages.csv
timestamp,volume,meter_id
2023-01-01 00:00:00,125.4,1000647
2023-01-01 01:00:00,124.8,1000647
2023-01-01 02:00:00,124.2,1000647
...
# ~8,760 rows per meter (1 year hourly)
```

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | datetime64[ns] | Hourly timestamp |
| `volume` | float64 | Water volume (m³) |
| `meter_id` | string | Meter identifier |

---

### Stage 2: Combined & Resampled
```python
# Combined DataFrame
# Shape: [~87,600, 3] (10 meters × ~8,760 hours)
# Index: RangeIndex
# Columns: timestamp, volume, meter_id
# Sorted by: meter_id, timestamp
```

---

### Stage 3: After Imputation
```python
# No missing timestamps
# No NaN in volume
# Continuous hourly frequency per meter
# Gaps filled conservatively
```

---

### Stage 4: After Feature Engineering
```python
# Shape: [~87,600, 12] (added 9 features)
# Columns:
# - timestamp, volume, meter_id (original)
# - Hour (0-23), DayOfWeek (0-6), Month (1-12)
# - roll6_mean, roll24_mean, roll6_std, roll24_std
# - rel_to_roll24, Delta_Volume
# - leak_label (0/1), leak_volume (added in stage 5)

# First 23 rows per meter dropped (rolling NaN)
# Effective shape: [~85,000, 12]
```

---

### Stage 5: After Leak Synthesis
```python
# Added columns:
# - leak_label: 0 (no leak) or 1 (leak active)
# - leak_volume: additional volume from synthetic leak
# - volume_with_leak: volume + leak_volume

# Leak statistics (typical):
# - Leak rate: ~1-2% of hours
# - Average leak duration: ~48 hours
# - Leaks per meter: ~10-20 per year
```

---

### Stage 6: CV Splits (Per Fold)
```python
# Fold 0 (example):
# Train: meter 1000647, months 1-3 (~2,160 hours) → ~2,112 windows
# Gap: 24 hours
# Val: meter 1000647, month 4 (~720 hours) → ~672 windows

# Per fold:
# - 10 meters × expanding train windows
# - Train grows, val moves forward
# - No temporal leakage
```

---

### Stage 7: After Scaling (Per Fold)
```python
# Train fold:
# X_train_scaled = scaler.fit_transform(X_train_raw)  # [N_train, 9]
# scaler.mean_, scaler.var_ learned from TRAIN ONLY

# Val fold:
# X_val_scaled = scaler.transform(X_val_raw)  # [N_val, 9]
# SAME scaler, no refitting!
```

---

### Stage 8: After Windowing (Per Fold)
```python
# Train windows:
# X_train_w: [~15,000, 48, 9] float32
# y_train_w: [~15,000] int32 (0/1)

# Val windows:
# X_val_w: [~6,000, 48, 9] float32
# y_val_w: [~6,000] int32

# Window creation:
# For i in range(0, N-48+1, 1):
#   window = X[i:i+48]  # 48 hours
#   label = y[i+47]     # Last timestep label
```

---

### Stage 11: Final Artifacts

#### `gru_cls.pt` (PyTorch State Dict)
```python
# Keys:
# gru.weight_ih_l0: [192, 9]
# gru.weight_hh_l0: [192, 64]
# gru.bias_ih_l0: [192]
# gru.bias_hh_l0: [192]
# gru.weight_ih_l1: [192, 64]
# gru.weight_hh_l1: [192, 64]
# gru.bias_ih_l1: [192]
# gru.bias_hh_l1: [192]
# fc.weight: [1, 64]
# fc.bias: [1]
```

#### `gru_cls_scaler.joblib` (StandardScaler)
```python
# Attributes:
# mean_: [9] - mean per feature
# var_: [9] - variance per feature
# scale_: [9] - std per feature
# n_samples_seen_: int
# feature_names_in_: ['Hour', 'DayOfWeek', ..., 'Delta_Volume']
```

#### `gru_cls_meta.json`
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
  "train_date": "2024-01-15T10:30:00Z",
  "cv_folds": 10,
  "cv_metrics": {
    "accuracy": [0.91, 0.92, ...],
    "f1": [0.86, 0.87, ...]
  }
}
```

#### `gru_cls_thr.txt`
```
0.68
```

#### `gru_cls_metrics.json`
```json
{
  "accuracy": 0.924,
  "precision": 0.895,
  "recall": 0.862,
  "f1": 0.878,
  "auc": 0.954,
  "confusion_matrix": [[950, 50], [75, 425]],
  "per_fold": {
    "accuracy": [0.912, 0.923, ...],
    "f1": [0.860, 0.873, ...],
    "thresholds": [0.65, 0.67, ...]
  }
}
```

#### `test_agg.parquet` (Frozen Test Set)
```python
# Columns:
# meter_id: string
# window_idx: int
# timestamp: datetime64[ns]  # Window end time
# label: int (0/1)           # Ground truth
# Hour, DayOfWeek, Month, roll6_mean, roll24_mean,
# roll6_std, roll24_std, rel_to_roll24, Delta_Volume: float

# Shape: [~40,000, 13]
# All test windows from all meters
# Used for batch prediction evaluation
```

---

## 🔄 Inference Data Flow

### Input Validation
```python
def validate_inference_input(X: np.ndarray, feature_cols: list) -> None:
    """Validate inference input matches training expectations."""
    
    B, W, F = X.shape
    
    # 1. Dimensions
    assert W == 48, f"Window size {W} != 48"
    assert F == 9, f"Features {F} != 9"
    
    # 2. Feature order
    expected = [
        'Hour', 'DayOfWeek', 'Month',
        'roll6_mean', 'roll24_mean',
        'roll6_std', 'roll24_std',
        'rel_to_roll24', 'Delta_Volume'
    ]
    assert feature_cols == expected, f"Order mismatch: {feature_cols} vs {expected}"
    
    # 3. No NaN/Inf
    assert not np.isnan(X).any(), "NaN in input"
    assert np.isfinite(X).all(), "Inf in input"
    
    # 4. Reasonable ranges
    assert X[:, :, 0].min() >= 0 and X[:, :, 0].max() <= 23, "Hour out of range"
    assert X[:, :, 1].min() >= 0 and X[:, :, 1].max() <= 6, "DayOfWeek out of range"
    assert X[:, :, 2].min() >= 1 and X[:, :, 2].max() <= 12, "Month out of range"
```

### Scaling (Inference)
```python
def scale_inference(X: np.ndarray, scaler, feature_cols: list) -> torch.Tensor:
    """Apply training scaler to inference input."""
    B, W, F = X.shape
    
    # Flatten for scaler
    flat = X.reshape(B * W, F)
    df = pd.DataFrame(flat, columns=feature_cols)
    
    # Transform ONLY (no fit!)
    flat_scaled = scaler.transform(df).astype(np.float32)
    
    # Reshape
    return torch.from_numpy(flat_scaled.reshape(B, W, F))
```

### Model Inference
```python
def infer(model, xb: torch.Tensor, threshold: float = 0.68):
    """Run inference on preprocessed batch."""
    model.eval()
    with torch.no_grad():
        logits = model(xb).numpy()  # [B, 48]
    
    # Last timestep
    last_logits = logits[:, -1]
    
    # Clip for numerical stability
    last_logits = np.clip(last_logits, -20.0, 20.0)
    
    # Sigmoid
    probs = 1.0 / (1.0 + np.exp(-last_logits))
    
    # Threshold
    preds = (probs >= threshold).astype(np.int32)
    
    return probs, preds
```

---

## 📈 Data Quality Checks

### Automated Validation Pipeline
```python
def run_data_quality_checks(df: pd.DataFrame) -> dict:
    """Run comprehensive data quality checks."""
    checks = {}
    
    # 1. Completeness
    checks['no_missing_timestamps'] = (
        df.groupby('meter_id')['timestamp']
        .apply(lambda x: x.diff().dt.total_seconds().dropna().eq(3600).all())
        .all()
    )
    
    # 2. Volume plausibility
    checks['volume_positive'] = (df['volume'] >= 0).all()
    checks['volume_reasonable'] = (df['volume'] < 10000).all()
    
    # 3. Feature ranges
    feature_cols = ['Hour', 'DayOfWeek', 'Month', 'roll6_mean', 'roll24_mean',
                    'roll6_std', 'roll24_std', 'rel_to_roll24', 'Delta_Volume']
    
    checks['no_nan_features'] = not df[feature_cols].isna().any().any()
    checks['no_inf_features'] = np.isfinite(df[feature_cols].values).all()
    
    # 4. Label balance
    leak_rate = df['leak_label'].mean()
    checks['leak_rate_reasonable'] = 0.005 < leak_rate < 0.05
    
    # 5. Per-meter stats
    meter_stats = df.groupby('meter_id').agg({
        'volume': ['mean', 'std', 'min', 'max'],
        'leak_label': 'mean'
    })
    checks['meter_stats'] = meter_stats.to_dict()
    
    return checks
```

### Drift Detection (Production)
```python
def detect_data_drift(reference_df: pd.DataFrame, current_df: pd.DataFrame) -> dict:
    """Detect distribution shift using KS test."""
    from scipy.stats import ks_2samp
    
    feature_cols = ['Hour', 'DayOfWeek', 'Month', 'roll6_mean', 'roll24_mean',
                    'roll6_std', 'roll24_std', 'rel_to_roll24', 'Delta_Volume']
    
    drift_results = {}
    for col in feature_cols:
        stat, p_value = ks_2samp(
            reference_df[col].dropna().values,
            current_df[col].dropna().values
        )
        drift_results[col] = {
            'ks_statistic': float(stat),
            'p_value': float(p_value),
            'drift_detected': p_value < 0.05
        }
    
    # Overall drift
    drift_count = sum(1 for v in drift_results.values() if v['drift_detected'])
    drift_results['overall'] = {
        'features_with_drift': drift_count,
        'drift_ratio': drift_count / len(feature_cols),
        'alert': drift_count > 3
    }
    
    return drift_results
```

---

## 📋 Quick Reference

### Data Shapes Summary
| Stage | Shape | Description |
|-------|-------|-------------|
| Raw CSV | [~8,760, 3] per meter | timestamp, volume, meter_id |
| Combined | [~87,600, 3] | All meters |
| Features | [~85,000, 12] | +9 features |
| With Leaks | [~85,000, 14] | +leak_label, leak_volume |
| Train Fold | [~15,000, 48, 9] | Windows |
| Val Fold | [~6,000, 48, 9] | Windows |
| Test Set | [~40,000, 48, 9] | Frozen windows |
| Inference | [B, 48, 9] | Batch prediction |

### Feature Order (Critical!)
```
1. Hour              → int (0-23)
2. DayOfWeek         → int (0-6)
3. Month             → int (1-12)
4. roll6_mean        → float
5. roll24_mean       → float
6. roll6_std         → float (≥0)
7. roll24_std        → float (≥0)
8. rel_to_roll24     → float (~1.0)
9. Delta_Volume      → float (can be negative)
```

### Key Files
| File | Stage | Purpose |
|------|-------|---------|
| `LeakageData/*.csv` | 1 | Raw meter readings |
| `utils/ParserCreator.py` | 1-2 | Load & combine |
| `utils/DataAggregation.py` | 3-5 | Impute, features, leaks |
| `utils/CvkFold.py` | 6 | Time-aware CV splits |
| `Algorithms/Gru.py` | 7-12 | Scale, window, train, save |
| `models/gru_cls_scaler.joblib` | 7 | Saved scaler |
| `models/gru_cls.pt` | 12 | Model weights |
| `models/artifacts/test_agg.parquet` | 12 | Frozen test set |

### Inference Requirements
| Requirement | Specification |
|-------------|---------------|
| Input shape | [Batch, 48, 9] |
| Feature order | Must match training exactly |
| Scaling | Use `gru_cls_scaler.joblib` only |
| Model | `gru_cls.pt` with GRUHead architecture |
| Threshold | 0.68 (from `gru_cls_thr.txt`) |
| Output | Probability + binary prediction |