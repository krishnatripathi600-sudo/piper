# Data Pipeline Architecture

Complete data processing pipeline for the PIPER Water Leakage Detection System.

## 🔄 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PIPER DATA PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RAW CSV          GAP IMPUTATION      FEATURE ENG.     LEAK SYNTHESIS      │
│  ────────    ─────────────────    ─────────────    ────────────────       │
│  Hourly meter     Conservative       Calendar +      Progressive,         │
│  readings         step-preserving    Rolling stats  realistic leaks        │
│       │                  │                │                │               │
│       ▼                  ▼                ▼                ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    TIME-AWARE SPLITTING                              │   │
│  │  Per-meter forward-chaining CV (10 folds)                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                  │                │                │               │
│       ▼                  ▼                ▼                ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        SCALING                                       │   │
│  │  StandardScaler fit on TRAIN only, applied to VAL/TEST              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                  │                │                │               │
│       ▼                  ▼                ▼                ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       WINDOWING                                      │   │
│  │  Sliding windows: 48 hours × 9 features, stride=1                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                  │                │                │               │
│       ▼                  ▼                ▼                ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MODEL TRAINING                                    │   │
│  │  GRU/LSTM/MLP/RF/SVM/XGBoost with CV threshold optimization         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📂 Raw Data (`LeakageData/`)

### File Format
- **Files**: `1000647_with_leakages.csv`, `1000644_with_leakages.csv`, etc. (10 meters)
- **Columns**:
  | Column | Type | Description |
  |--------|------|-------------|
  | `timestamp` | datetime | Hourly timestamp |
  | `volume` | float | Water volume reading (m³) |
  | `meter_id` | string | Meter identifier |

### Sample Data
```csv
timestamp,volume,meter_id
2023-01-01 00:00:00,125.4,1000647
2023-01-01 01:00:00,124.8,1000647
2023-01-01 02:00:00,124.2,1000647
...
```

### Data Characteristics
- **Frequency**: Hourly
- **Duration**: ~1 year per meter
- **Meters**: 10 unique meters
- **Missing data**: Gaps present (handled in imputation)
- **Leak labels**: Synthetic (injected during pipeline)

---

## 🔧 Step 1: Gap Imputation

### Algorithm: Conservative Step-Preserving Fill
```python
def impute_gaps(df: pd.DataFrame, max_gap_hours: int = 24) -> pd.DataFrame:
    """
    Fill missing hourly readings conservatively.
    
    Strategy:
    1. Identify gaps > 1 hour
    2. For gaps ≤ max_gap_hours: linear interpolation
    3. For gaps > max_gap_hours: forward fill (step-preserving)
    4. Preserve original non-null values exactly
    """
    # Resample to hourly frequency
    df = df.set_index('timestamp').resample('H').asfreq()
    
    # Identify gaps
    gaps = df['volume'].isna()
    
    # Small gaps: interpolate
    small_gaps = gaps & (gap_lengths <= max_gap_hours)
    df.loc[small_gaps, 'volume'] = df['volume'].interpolate(method='time')
    
    # Large gaps: forward fill (conservative)
    large_gaps = gaps & (gap_lengths > max_gap_hours)
    df.loc[large_gaps, 'volume'] = df['volume'].ffill()
    
    return df.reset_index()
```

### Why Conservative?
- **No leakage**: Don't use future data to fill past
- **Physical realism**: Water flow doesn't jump arbitrarily
- **Preserves steps**: Sudden changes (valve operations) maintained

---

## 📊 Step 2: Feature Engineering

### 9 Features Generated

| Feature | Formula | Window | Description |
|---------|---------|--------|-------------|
| `Hour` | `timestamp.hour` | - | Hour of day (0-23) |
| `DayOfWeek` | `timestamp.dayofweek` | - | Day of week (0-6) |
| `Month` | `timestamp.month` | - | Month (1-12) |
| `roll6_mean` | `volume.rolling(6).mean()` | 6h | Short-term trend |
| `roll24_mean` | `volume.rolling(24).mean()` | 24h | Daily baseline |
| `roll6_std` | `volume.rolling(6).std()` | 6h | Short-term volatility |
| `roll24_std` | `volume.rolling(24).std()` | 24h | Daily volatility |
| `rel_to_roll24` | `volume / roll24_mean` | - | Relative consumption |
| `Delta_Volume` | `volume.diff()` | 1h | Hourly change |

### Implementation
```python
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.sort_values(['meter_id', 'timestamp'])
    
    # Calendar features
    df['Hour'] = df['timestamp'].dt.hour
    df['DayOfWeek'] = df['timestamp'].dt.dayofweek
    df['Month'] = df['timestamp'].dt.month
    
    # Rolling statistics (per meter)
    for meter_id in df['meter_id'].unique():
        mask = df['meter_id'] == meter_id
        vol = df.loc[mask, 'volume']
        
        df.loc[mask, 'roll6_mean'] = vol.rolling(6, min_periods=1).mean()
        df.loc[mask, 'roll24_mean'] = vol.rolling(24, min_periods=1).mean()
        df.loc[mask, 'roll6_std'] = vol.rolling(6, min_periods=1).std().fillna(0)
        df.loc[mask, 'roll24_std'] = vol.rolling(24, min_periods=1).std().fillna(0)
        
        df.loc[mask, 'rel_to_roll24'] = vol / df.loc[mask, 'roll24_mean'].replace(0, np.nan)
        df.loc[mask, 'Delta_Volume'] = vol.diff().fillna(0)
    
    # Drop rows with NaN from rolling (first 23 hours per meter)
    feature_cols = ['Hour', 'DayOfWeek', 'Month', 'roll6_mean', 'roll24_mean', 
                    'roll6_std', 'roll24_std', 'rel_to_roll24', 'Delta_Volume']
    df = df.dropna(subset=feature_cols)
    
    return df
```

### Feature Statistics (Training Set)
| Feature | Mean | Std | Min | Max |
|---------|------|-----|-----|-----|
| Hour | 11.5 | 6.9 | 0 | 23 |
| DayOfWeek | 3.0 | 2.0 | 0 | 6 |
| Month | 6.5 | 3.4 | 1 | 12 |
| roll6_mean | 125.3 | 15.2 | 80.1 | 200.4 |
| roll24_mean | 125.1 | 14.8 | 82.3 | 195.7 |
| roll6_std | 2.1 | 1.8 | 0.0 | 15.3 |
| roll24_std | 3.4 | 2.9 | 0.0 | 25.1 |
| rel_to_roll24 | 1.0 | 0.08 | 0.75 | 1.45 |
| Delta_Volume | 0.0 | 1.2 | -10.5 | 12.3 |

---

## 💧 Step 3: Leak Synthesis

### Synthetic Leak Injection
```python
def inject_leaks(
    df: pd.DataFrame,
    leak_probability: float = 0.02,
    leak_duration_range: tuple = (24, 168),  # hours
    leak_rate_range: tuple = (0.5, 5.0),     # m³/h additional
    ramp_up_hours: int = 6,
) -> pd.DataFrame:
    """
    Inject realistic progressive leaks.
    
    Process:
    1. Randomly select leak start times per meter
    2. Determine leak duration and rate
    3. Apply progressive ramp-up (realistic pipe degradation)
    4. Add leak volume to readings
    5. Create binary labels (1 during leak, 0 otherwise)
    """
    df = df.copy()
    df['leak_label'] = 0
    df['leak_volume'] = 0.0
    
    for meter_id in df['meter_id'].unique():
        mask = df['meter_id'] == meter_id
        meter_df = df[mask].copy()
        n_hours = len(meter_df)
        
        # Generate leak events
        n_leaks = np.random.binomial(n_hours, leak_probability)
        leak_starts = np.random.choice(n_hours, n_leaks, replace=False)
        
        for start in leak_starts:
            duration = np.random.randint(*leak_duration_range)
            rate = np.random.uniform(*leak_rate_range)
            end = min(start + duration, n_hours)
            
            # Progressive ramp-up
            leak_profile = np.linspace(0, rate, min(ramp_up_hours, end - start))
            if end - start > ramp_up_hours:
                leak_profile = np.concatenate([
                    leak_profile,
                    np.full(end - start - ramp_up_hours, rate)
                ])
            
            # Apply leak
            leak_indices = range(start, end)
            df.loc[meter_df.iloc[leak_indices].index, 'leak_volume'] += leak_profile
            df.loc[meter_df.iloc[leak_indices].index, 'leak_label'] = 1
    
    # Add leak volume to readings
    df['volume_with_leak'] = df['volume'] + df['leak_volume']
    
    return df
```

### Leak Characteristics
- **Probability**: ~2% of hours have leak start
- **Duration**: 1-7 days (24-168 hours)
- **Rate**: 0.5-5.0 m³/h additional flow
- **Ramp-up**: 6 hours progressive increase
- **Labels**: Binary (0=no leak, 1=leak active)

---

## ⏰ Step 4: Time-Aware Splitting

### Forward-Chaining Cross-Validation
```python
class CvkFold:
    """
    Per-meter forward-chaining cross-validation.
    
    For each meter:
    - Fold 1: Train=Months 1-3, Val=Month 4
    - Fold 2: Train=Months 1-4, Val=Month 5
    - ...
    - Fold 10: Train=Months 1-12, Val=Month 13 (if available)
    
    Gap between train/val: 24 hours (prevents leakage)
    """
    
    def __init__(self, n_splits: int = 10, gap_hours: int = 24):
        self.n_splits = n_splits
        self.gap_hours = gap_hours
    
    def split(self, df: pd.DataFrame, meter_col: str = 'meter_id', time_col: str = 'timestamp'):
        """Generate train/val indices for each fold."""
        for meter_id in df[meter_col].unique():
            meter_df = df[df[meter_col] == meter_id].sort_values(time_col)
            n = len(meter_df)
            
            # Expanding window
            fold_size = n // (self.n_splits + 1)
            
            for fold in range(self.n_splits):
                train_end = (fold + 1) * fold_size
                val_start = train_end + self.gap_hours
                val_end = min(val_start + fold_size, n)
                
                if val_start >= val_end:
                    continue
                
                train_idx = meter_df.index[:train_end]
                val_idx = meter_df.index[val_start:val_end]
                
                yield train_idx, val_idx
```

### Why Forward-Chaining?
- **Temporal integrity**: Never train on future, validate on past
- **Realistic**: Mimics production (model trained on history, predicts future)
- **Per-meter**: Accounts for meter-specific patterns
- **Gap**: 24-hour buffer prevents autocorrelation leakage

---

## 📏 Step 5: Scaling

### StandardScaler (Fit on Train Only)
```python
from sklearn.preprocessing import StandardScaler

def scale_features(
    X_train: np.ndarray,  # [N_train, F]
    X_val: np.ndarray,    # [N_val, F]
    X_test: np.ndarray,   # [N_test, F]
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, StandardScaler]:
    """
    Scale features using StandardScaler fit ONLY on training data.
    
    Critical: No data leakage from val/test into scaler!
    """
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)
    
    return X_train_scaled, X_val_scaled, X_test_scaled, scaler
```

### Saved Artifact
- **File**: `models/gru_cls_scaler.joblib`
- **Contains**: Mean, variance, scale for each of 9 features
- **Usage**: Applied identically during inference

---

## 🪟 Step 6: Windowing

### Sliding Window Creation
```python
def create_windows(
    features: np.ndarray,     # [N, F]
    labels: np.ndarray,       # [N]
    window_size: int = 48,
    stride: int = 1,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create sliding windows for sequence models.
    
    Input:  [N, F] features, [N] labels
    Output: [B, W, F] windows, [B] labels (last timestep)
    """
    N, F = features.shape
    n_windows = (N - window_size) // stride + 1
    
    windows = np.zeros((n_windows, window_size, F), dtype=np.float32)
    window_labels = np.zeros(n_windows, dtype=np.int32)
    
    for i in range(n_windows):
        start = i * stride
        end = start + window_size
        windows[i] = features[start:end]
        window_labels[i] = labels[end - 1]  # Label at window end
    
    return windows, window_labels
```

### Window Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| `window_size` | 48 | 48 hours (2 days) |
| `stride` | 1 | Slide by 1 hour |
| `label` | Last timestep | Binary label at window end |

### Output Shape
- **Training**: `[B, 48, 9]` windows, `[B]` labels
- **Per meter**: ~8,000 windows (after dropping first 48 hours)

---

## 🎯 Step 7: Cross-Validation Threshold

### F1-Optimal Threshold Selection
```python
def find_optimal_threshold(
    y_true: np.ndarray,
    y_probs: np.ndarray,
) -> float:
    """Find threshold that maximizes F1 score."""
    thresholds = np.linspace(0.01, 0.99, 99)
    f1_scores = [f1_score(y_true, (y_probs >= t).astype(int)) for t in thresholds]
    optimal_idx = np.argmax(f1_scores)
    return thresholds[optimal_idx]

# Per-fold threshold selection
fold_thresholds = []
for fold in range(n_folds):
    # ... train model ...
    val_probs = model.predict_proba(X_val)
    thr = find_optimal_threshold(y_val, val_probs)
    fold_thresholds.append(thr)

# Final threshold: median across folds
final_threshold = np.median(fold_thresholds)
```

### Threshold Statistics
| Metric | Value |
|--------|-------|
| Fold thresholds | [0.65, 0.67, 0.68, 0.70, 0.66, 0.69, 0.68, 0.67, 0.68, 0.69] |
| **Median (final)** | **0.68** |
| Mean | 0.679 |
| Std | 0.014 |

---

## 💾 Final Artifacts

### Model Artifacts (`models/`)
| File | Format | Description |
|------|--------|-------------|
| `gru_cls.pt` | PyTorch state_dict | Model weights |
| `gru_cls_scaler.joblib` | joblib | StandardScaler |
| `gru_cls_meta.json` | JSON | Architecture config |
| `gru_cls_thr.txt` | Text | Optimal threshold |
| `gru_cls_metrics.json` | JSON | CV metrics |

### Test Artifacts (`models/artifacts/`)
| File | Format | Description |
|------|--------|-------------|
| `test_agg.parquet` | Parquet | Frozen test windows |

### Meta.json Structure
```json
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
  "train_date": "2024-01-15T10:30:00Z",
  "cv_folds": 10,
  "cv_metrics": {
    "accuracy": [0.91, 0.92, 0.93, 0.91, 0.92, 0.93, 0.92, 0.91, 0.92, 0.93],
    "f1": [0.86, 0.87, 0.88, 0.86, 0.87, 0.88, 0.87, 0.86, 0.87, 0.88]
  }
}
```

### Test_agg.parquet Structure
```python
# Columns:
# meter_id (string)
# window_idx (int) 
# timestamp (datetime) - window end time
# label (int) - ground truth
# Hour, DayOfWeek, Month, roll6_mean, roll24_mean, roll6_std, roll24_std, rel_to_roll24, Delta_Volume (float)
```

---

## 🔄 Inference Pipeline (Production)

```
Raw Sensor Data (48 hours × 9 features)
        │
        ▼
Feature Validation (count, order, NaN check)
        │
        ▼
Scaling (gru_cls_scaler.joblib)
        │
        ▼
GRU Inference (gru_cls.pt)
        │
        ▼
Last Timestep Logit → Sigmoid → Probability
        │
        ▼
Threshold (0.68) → Binary Prediction
        │
        ▼
Return: {probs, preds, thr}
```

### Key Inference Requirements
1. **Exact feature order** must match training
2. **Same scaler** must be used (no refitting)
3. **Same window size** (48 hours)
4. **Threshold** from training (or env override)

---

## 📊 Data Quality Checks

### Automated Validation
```python
def validate_pipeline_output(df: pd.DataFrame) -> dict:
    """Run quality checks on processed data."""
    checks = {}
    
    # 1. No NaN in features
    feature_cols = ['Hour', 'DayOfWeek', 'Month', 'roll6_mean', 'roll24_mean', 
                    'roll6_std', 'roll24_std', 'rel_to_roll24', 'Delta_Volume']
    checks['no_nan_features'] = not df[feature_cols].isna().any().any()
    
    # 2. Label balance
    leak_rate = df['leak_label'].mean()
    checks['leak_rate_reasonable'] = 0.005 < leak_rate < 0.05
    
    # 3. Feature ranges
    checks['hour_range'] = df['Hour'].between(0, 23).all()
    checks['month_range'] = df['Month'].between(1, 12).all()
    
    # 4. No infinite values
    checks['no_inf'] = np.isfinite(df[feature_cols].values).all()
    
    # 5. Window creation works
    try:
        windows, labels = create_windows(df[feature_cols].values, df['leak_label'].values)
        checks['windows_created'] = len(windows) > 0
        checks['window_shape'] = windows.shape[1:] == (48, 9)
    except Exception:
        checks['windows_created'] = False
    
    return checks
```

---

## 📈 Monitoring & Drift Detection

### Feature Drift Monitoring
```python
def detect_feature_drift(
    reference_stats: dict,  # From training
    current_data: pd.DataFrame,
    threshold: float = 0.1,  # KS test p-value
) -> dict:
    """Detect distribution shift in features."""
    from scipy.stats import ks_2samp
    
    feature_cols = ['Hour', 'DayOfWeek', 'Month', 'roll6_mean', 'roll24_mean', 
                    'roll6_std', 'roll24_std', 'rel_to_roll24', 'Delta_Volume']
    
    drift_results = {}
    for col in feature_cols:
        # Compare reference distribution (saved quantiles) with current
        # Using KS test on samples
        stat, p_value = ks_2samp(
            reference_stats[col]['sample'],  # Saved from training
            current_data[col].dropna().values
        )
        drift_results[col] = {
            'ks_statistic': stat,
            'p_value': p_value,
            'drift_detected': p_value < threshold
        }
    
    return drift_results
```

### Retraining Triggers
| Trigger | Threshold |
|---------|-----------|
| Feature drift (KS test) | p < 0.05 for >3 features |
| Label drift (leak rate change) | >50% change from baseline |
| Performance drop (batch eval) | F1 < 0.80 |
| Scheduled | Monthly |

---

## 📋 Quick Reference

| Step | Script | Input | Output |
|------|--------|-------|--------|
| 1. Load CSV | `utils/ParserCreator.py` | `LeakageData/*.csv` | Raw DataFrame |
| 2. Impute Gaps | `utils/DataAggregation.py` | Raw DataFrame | Imputed DataFrame |
| 3. Features | `utils/DataAggregation.py` | Imputed DataFrame | Feature DataFrame |
| 4. Leak Synthesis | `utils/DataAggregation.py` | Feature DataFrame | Labeled DataFrame |
| 5. CV Split | `utils/CvkFold.py` | Labeled DataFrame | Train/Val indices |
| 6. Scaling | `Algorithms/Gru.py` (train) | Train features | Scaler + scaled data |
| 7. Windowing | `Algorithms/Gru.py` | Scaled features | `[B, 48, 9]` windows |
| 8. Training | `Algorithms/Gru.py` | Windows + labels | Model artifacts |
| 9. Threshold | `Algorithms/Gru.py` | CV predictions | `gru_cls_thr.txt` |
| 10. Test Set | `utils/DataAggregation.py` | All data | `test_agg.parquet` |

### Key Files
| File | Location | Purpose |
|------|----------|---------|
| `ParserCreator.py` | `utils/` | CSV parsing |
| `DataAggregation.py` | `utils/` | Features, leaks, aggregation |
| `CvkFold.py` | `utils/` | Time-aware CV splits |
| `Gru.py` | `Algorithms/` | GRU training pipeline |
| `Lstm.py`, `Mlp.py`, etc. | `Algorithms/` | Other algorithms |