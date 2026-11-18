# Training Flow

Complete model training pipeline for PIPER Water Leakage Detection System.

## 🔄 Training Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PIPER TRAINING FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RAW DATA                                                                   │
│  LeakageData/*.csv (10 meters, hourly readings)                            │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. DATA LOADING & IMPUTATION                                        │   │
│  │    ├── Parse CSV files (ParserCreator.py)                           │   │
│  │    ├── Combine multi-meter data                                     │   │
│  │    ├── Resample to hourly frequency                                 │   │
│  │    └── Impute gaps (conservative step-preserving)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2. FEATURE ENGINEERING (DataAggregation.py)                         │   │
│  │    ├── Calendar: Hour, DayOfWeek, Month                             │   │
│  │    ├── Rolling: roll6_mean, roll24_mean, roll6_std, roll24_std     │   │
│  │    ├── Relative: rel_to_roll24                                      │   │
│  │    └── Delta: Delta_Volume                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3. LEAK SYNTHESIS (DataAggregation.py)                              │   │
│  │    ├── Random leak start times per meter                            │   │
│  │    ├── Duration: 24-168 hours                                       │   │
│  │    ├── Rate: 0.5-5.0 m³/h additional                                │   │
│  │    ├── Progressive ramp-up (6 hours)                                │   │
│  │    └── Binary labels (leak_label)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 4. TIME-AWARE SPLITTING (CvkFold.py)                                │   │
│  │    ├── Per-meter forward-chaining CV (10 folds)                     │   │
│  │    ├── Train: expanding window, Val: next period                    │   │
│  │    ├── 24-hour gap between train/val                                │   │
│  │    └── No data leakage across time                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 5. SCALING (StandardScaler)                                         │   │
│  │    ├── Fit on TRAIN fold only                                       │   │
│  │    ├── Transform train, val, test                                   │   │
│  │    └── Save scaler (gru_cls_scaler.joblib)                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 6. WINDOWING                                                        │   │
│  │    ├── Sliding windows: 48 hours × 9 features                       │   │
│  │    ├── Stride: 1 hour                                               │   │
│  │    ├── Label: last timestep                                         │   │
│  │    └── Output: [B, 48, 9] windows, [B] labels                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 7. MODEL TRAINING (Algorithms/Gru.py)                               │   │
│  │    ├── Initialize GRUHead (2-layer, 64 hidden)                      │   │
│  │    ├── BCEWithLogitsLoss + AdamW optimizer                          │   │
│  │    ├── Train on each CV fold                                        │   │
│  │    ├── Early stopping on val F1 (patience=10)                       │   │
│  │    ├── Save best model per fold                                     │   │
│  │    └── Aggregate metrics across folds                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 8. THRESHOLD OPTIMIZATION                                           │   │
│  │    ├── Per-fold: find F1-optimal threshold                          │   │
│  │    ├── Final: median of fold thresholds                             │   │
│  │    └── Save: gru_cls_thr.txt                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 9. FINAL MODEL RETRAINING                                           │   │
│  │    ├── Retrain on ALL data (train + val)                            │   │
│  │    ├── Same architecture, best hyperparameters                      │   │
│  │    ├── Save final: gru_cls.pt, gru_cls_meta.json                    │   │
│  │    └── Generate frozen test set: test_agg.parquet                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  MODEL ARTIFACTS                                                            │
│  models/                                                                    │
│  ├── gru_cls.pt                    # Weights                               │
│  ├── gru_cls_scaler.joblib         # Scaler                                │
│  ├── gru_cls_meta.json             # Config                                │
│  ├── gru_cls_thr.txt               # Threshold                             │
│  ├── gru_cls_metrics.json          # CV metrics                            │
│  └── artifacts/                                                              │
│       └── test_agg.parquet         # Frozen test set                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Step-by-Step Implementation

### 1. Data Loading (`utils/ParserCreator.py`)

```python
def load_leakage_data(data_dir: Path) -> pd.DataFrame:
    """Load and combine all meter CSV files."""
    dfs = []
    for csv_file in data_dir.glob("*_with_leakages.csv"):
        df = pd.read_csv(csv_file)
        df['meter_id'] = csv_file.stem.replace("_with_leakages", "")
        dfs.append(df)
    
    combined = pd.concat(dfs, ignore_index=True)
    combined['timestamp'] = pd.to_datetime(combined['timestamp'])
    combined = combined.sort_values(['meter_id', 'timestamp']).reset_index(drop=True)
    
    return combined
```

### 2. Gap Imputation (`utils/DataAggregation.py`)

```python
def impute_gaps(df: pd.DataFrame, max_gap_hours: int = 24) -> pd.DataFrame:
    """Conservative step-preserving gap filling."""
    # Process per meter
    result_dfs = []
    for meter_id in df['meter_id'].unique():
        m_df = df[df['meter_id'] == meter_id].set_index('timestamp').resample('H').asfreq()
        
        # Identify gaps
        gaps = m_df['volume'].isna()
        gap_groups = (gaps != gaps.shift()).cumsum()
        gap_sizes = gaps.groupby(gap_groups).transform('sum')
        
        # Small gaps: interpolate
        small_gap_mask = gaps & (gap_sizes <= max_gap_hours)
        m_df.loc[small_gap_mask, 'volume'] = m_df['volume'].interpolate(method='time')
        
        # Large gaps: forward fill (conservative)
        large_gap_mask = gaps & (gap_sizes > max_gap_hours)
        m_df.loc[large_gap_mask, 'volume'] = m_df['volume'].ffill()
        
        m_df['meter_id'] = meter_id
        result_dfs.append(m_df.reset_index())
    
    return pd.concat(result_dfs, ignore_index=True)
```

### 3. Feature Engineering (`utils/DataAggregation.py`)

```python
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Generate 9 features per timestep."""
    df = df.copy()
    df = df.sort_values(['meter_id', 'timestamp'])
    
    feature_cols = [
        'Hour', 'DayOfWeek', 'Month',
        'roll6_mean', 'roll24_mean',
        'roll6_std', 'roll24_std',
        'rel_to_roll24', 'Delta_Volume'
    ]
    
    for meter_id in df['meter_id'].unique():
        mask = df['meter_id'] == meter_id
        vol = df.loc[mask, 'volume']
        
        # Calendar
        df.loc[mask, 'Hour'] = df.loc[mask, 'timestamp'].dt.hour
        df.loc[mask, 'DayOfWeek'] = df.loc[mask, 'timestamp'].dt.dayofweek
        df.loc[mask, 'Month'] = df.loc[mask, 'timestamp'].dt.month
        
        # Rolling statistics
        df.loc[mask, 'roll6_mean'] = vol.rolling(6, min_periods=1).mean()
        df.loc[mask, 'roll24_mean'] = vol.rolling(24, min_periods=1).mean()
        df.loc[mask, 'roll6_std'] = vol.rolling(6, min_periods=1).std().fillna(0)
        df.loc[mask, 'roll24_std'] = vol.rolling(24, min_periods=1).std().fillna(0)
        
        # Relative & delta
        df.loc[mask, 'rel_to_roll24'] = vol / df.loc[mask, 'roll24_mean'].replace(0, np.nan)
        df.loc[mask, 'Delta_Volume'] = vol.diff().fillna(0)
    
    # Drop rows with NaN from rolling (first 23 hours per meter)
    df = df.dropna(subset=feature_cols).reset_index(drop=True)
    
    return df
```

### 4. Leak Synthesis (`utils/DataAggregation.py`)

```python
def inject_synthetic_leaks(
    df: pd.DataFrame,
    leak_prob: float = 0.02,
    duration_range: tuple = (24, 168),
    rate_range: tuple = (0.5, 5.0),
    ramp_hours: int = 6,
) -> pd.DataFrame:
    """Inject realistic progressive leaks."""
    df = df.copy()
    df['leak_label'] = 0
    df['leak_volume'] = 0.0
    
    for meter_id in df['meter_id'].unique():
        mask = df['meter_id'] == meter_id
        m_df = df[mask]
        n = len(m_df)
        
        # Generate leak events
        n_leaks = np.random.binomial(n, leak_prob)
        starts = np.random.choice(n, n_leaks, replace=False)
        
        for start in starts:
            duration = np.random.randint(*duration_range)
            rate = np.random.uniform(*rate_range)
            end = min(start + duration, n)
            
            # Progressive ramp-up
            ramp = min(ramp_hours, end - start)
            leak_profile = np.linspace(0, rate, ramp)
            if end - start > ramp:
                leak_profile = np.concatenate([
                    leak_profile,
                    np.full(end - start - ramp, rate)
                ])
            
            # Apply
            idx = m_df.iloc[start:end].index
            df.loc[idx, 'leak_volume'] += leak_profile
            df.loc[idx, 'leak_label'] = 1
    
    df['volume_with_leak'] = df['volume'] + df['leak_volume']
    return df
```

### 5. CV Splitting (`utils/CvkFold.py`)

```python
class CvkFold:
    """Per-meter forward-chaining cross-validation."""
    
    def __init__(self, n_splits: int = 10, gap_hours: int = 24):
        self.n_splits = n_splits
        self.gap_hours = gap_hours
    
    def split(self, df: pd.DataFrame, meter_col='meter_id', time_col='timestamp'):
        df = df.sort_values([meter_col, time_col])
        
        for meter_id in df[meter_col].unique():
            m_df = df[df[meter_col] == meter_id].reset_index(drop=True)
            n = len(m_df)
            
            # Expanding window with gap
            fold_size = n // (self.n_splits + 1)
            
            for fold in range(self.n_splits):
                train_end = (fold + 1) * fold_size
                val_start = train_end + self.gap_hours
                val_end = min(val_start + fold_size, n)
                
                if val_start >= val_end:
                    continue
                
                train_idx = m_df.index[:train_end]
                val_idx = m_df.index[val_start:val_end]
                
                yield train_idx, val_idx
```

### 6. Scaling & Windowing (`Algorithms/Gru.py`)

```python
def prepare_fold_data(
    train_idx, val_idx,
    features: np.ndarray,  # [N, 9]
    labels: np.ndarray,    # [N]
    window: int = 48,
    stride: int = 1,
):
    """Scale and window for a single CV fold."""
    
    # 1. Split raw data
    X_train_raw = features[train_idx]
    y_train = labels[train_idx]
    X_val_raw = features[val_idx]
    y_val = labels[val_idx]
    
    # 2. Scale (fit on train only!)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_raw)
    X_val_scaled = scaler.transform(X_val_raw)
    
    # 3. Create windows
    def create_windows(X, y):
        n_windows = (len(X) - window) // stride + 1
        windows = np.zeros((n_windows, window, X.shape[1]), dtype=np.float32)
        window_labels = np.zeros(n_windows, dtype=np.int32)
        
        for i in range(n_windows):
            start = i * stride
            end = start + window
            windows[i] = X[start:end]
            window_labels[i] = y[end - 1]  # Label at window end
        
        return windows, window_labels
    
    X_train_w, y_train_w = create_windows(X_train_scaled, y_train)
    X_val_w, y_val_w = create_windows(X_val_scaled, y_val)
    
    return X_train_w, y_train_w, X_val_w, y_val_w, scaler
```

### 7. Model Training (`Algorithms/Gru.py`)

```python
def train_gru(
    X_train, y_train, X_val, y_val,
    window: int = 48,
    hidden: int = 64,
    num_layers: int = 2,
    dropout: float = 0.2,
    lr: float = 1e-3,
    max_epochs: int = 50,
    patience: int = 10,
    batch_size: int = 256,
    device: str = 'cpu',
):
    """Train GRU with early stopping."""
    
    # DataLoaders
    train_ds = TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train))
    val_ds = TensorDataset(torch.FloatTensor(X_val), torch.FloatTensor(y_val))
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    
    # Model
    model = GRUHead(
        in_dim=X_train.shape[2],
        hidden=hidden,
        num_layers=num_layers,
        dropout=dropout,
    ).to(device)
    
    # Loss & Optimizer
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='max', factor=0.5, patience=5
    )
    
    # Training loop
    best_f1 = 0
    best_state = None
    epochs_no_improve = 0
    
    for epoch in range(max_epochs):
        # Train
        model.train()
        train_losses = []
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            logits = model(xb)[:, -1]  # Last timestep
            loss = criterion(logits, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(loss.item())
        
        # Validate
        model.eval()
        val_probs = []
        val_true = []
        with torch.no_grad():
            for xb, yb in val_loader:
                xb = xb.to(device)
                logits = model(xb)[:, -1]
                probs = torch.sigmoid(logits).cpu().numpy()
                val_probs.extend(probs)
                val_true.extend(yb.numpy())
        
        # Find optimal threshold for this epoch
        val_probs = np.array(val_probs)
        val_true = np.array(val_true)
        thresholds = np.linspace(0.01, 0.99, 99)
        f1_scores = [f1_score(val_true, (val_probs >= t).astype(int)) for t in thresholds]
        best_thr_idx = np.argmax(f1_scores)
        epoch_f1 = f1_scores[best_thr_idx]
        epoch_thr = thresholds[best_thr_idx]
        
        scheduler.step(epoch_f1)
        
        # Early stopping
        if epoch_f1 > best_f1:
            best_f1 = epoch_f1
            best_state = model.state_dict().copy()
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                break
    
    # Restore best weights
    model.load_state_dict(best_state)
    
    return model, best_f1, epoch_thr
```

### 8. Cross-Validation Loop (`Algorithms/Gru.py`)

```python
def run_cv_training(
    features: np.ndarray,
    labels: np.ndarray,
    n_folds: int = 10,
    **train_kwargs
):
    """Run full CV training and collect metrics."""
    
    cv = CvkFold(n_splits=n_folds)
    fold_metrics = []
    fold_thresholds = []
    fold_models = []
    
    for fold, (train_idx, val_idx) in enumerate(cv.split(df)):
        print(f"\n=== Fold {fold + 1}/{n_folds} ===")
        
        # Prepare data
        X_tr_w, y_tr_w, X_val_w, y_val_w, scaler = prepare_fold_data(
            train_idx, val_idx, features, labels
        )
        
        # Train
        model, fold_f1, fold_thr = train_gru(
            X_tr_w, y_tr_w, X_val_w, y_val_w,
            **train_kwargs
        )
        
        # Evaluate on validation set
        val_probs, val_preds = predict_model(model, X_val_w, fold_thr)
        
        metrics = {
            'accuracy': accuracy_score(y_val_w, val_preds),
            'precision': precision_score(y_val_w, val_preds),
            'recall': recall_score(y_val_w, val_preds),
            'f1': f1_score(y_val_w, val_preds),
            'auc': roc_auc_score(y_val_w, val_probs),
        }
        
        fold_metrics.append(metrics)
        fold_thresholds.append(fold_thr)
        fold_models.append((model, scaler))
        
        print(f"Fold {fold+1}: F1={fold_f1:.4f}, Thr={fold_thr:.3f}")
    
    # Aggregate
    mean_metrics = {k: np.mean([m[k] for m in fold_metrics]) for k in fold_metrics[0]}
    std_metrics = {k: np.std([m[k] for m in fold_metrics]) for k in fold_metrics[0]}
    final_threshold = np.median(fold_thresholds)
    
    return {
        'fold_metrics': fold_metrics,
        'mean_metrics': mean_metrics,
        'std_metrics': std_metrics,
        'fold_thresholds': fold_thresholds,
        'final_threshold': final_threshold,
        'fold_models': fold_models,
    }
```

### 9. Final Retraining (`Algorithms/Gru.py`)

```python
def train_final_model(
    features: np.ndarray,
    labels: np.ndarray,
    scaler: StandardScaler,
    threshold: float,
    **train_kwargs
):
    """Retrain on all data for final model."""
    
    # Scale all data
    X_scaled = scaler.transform(features)
    
    # Create windows
    X_windows, y_windows = create_windows(X_scaled, labels)
    
    # Train on full dataset (no validation split for final)
    model = GRUHead(
        in_dim=features.shape[1],
        hidden=train_kwargs.get('hidden', 64),
        num_layers=train_kwargs.get('num_layers', 2),
        dropout=train_kwargs.get('dropout', 0.2),
    )
    
    # ... training loop similar to CV but on all data ...
    
    return model
```

### 10. Artifact Saving

```python
def save_artifacts(
    model: GRUHead,
    scaler: StandardScaler,
    threshold: float,
    metrics: dict,
    feature_cols: list,
    train_config: dict,
    models_dir: Path,
):
    """Save all model artifacts."""
    models_dir = Path(models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Model weights
    torch.save(model.state_dict(), models_dir / "gru_cls.pt")
    
    # 2. Scaler
    joblib.dump(scaler, models_dir / "gru_cls_scaler.joblib")
    
    # 3. Metadata
    meta = {
        "model": "GRUHead",
        "task": "cls",
        "window": train_config['window'],
        "stride": train_config['stride'],
        "in_dim": len(feature_cols),
        "feature_cols": feature_cols,
        "hidden": train_config['hidden'],
        "num_layers": train_config['num_layers'],
        "bidirectional": train_config.get('bidirectional', False),
        "dropout": train_config['dropout'],
        "thr": threshold,
        "train_date": datetime.utcnow().isoformat() + 'Z',
        "cv_folds": train_config.get('cv_folds', 10),
        "cv_metrics": metrics,
    }
    with open(models_dir / "gru_cls_meta.json", 'w') as f:
        json.dump(meta, f, indent=2)
    
    # 4. Threshold
    with open(models_dir / "gru_cls_thr.txt", 'w') as f:
        f.write(str(threshold))
    
    # 5. Metrics
    with open(models_dir / "gru_cls_metrics.json", 'w') as f:
        json.dump(metrics, f, indent=2)
```

---

## 🎯 Hyperparameter Tuning (Optuna)

### Optuna Integration (`tools/tune_optuna.py`)

```python
def objective_gru(trial, features, labels, cv_folds=5):
    """Optuna objective for GRU hyperparameters."""
    
    # Sample hyperparameters
    hidden = trial.suggest_categorical('hidden', [32, 64, 128, 256])
    num_layers = trial.suggest_int('num_layers', 1, 3)
    dropout = trial.suggest_float('dropout', 0.1, 0.5)
    lr = trial.suggest_float('lr', 1e-4, 1e-2, log=True)
    batch_size = trial.suggest_categorical('batch_size', [128, 256, 512])
    window = trial.suggest_categorical('window', [24, 48, 72])
    
    # Run CV training
    cv_results = run_cv_training(
        features, labels,
        n_folds=cv_folds,
        hidden=hidden,
        num_layers=num_layers,
        dropout=dropout,
        lr=lr,
        batch_size=batch_size,
        window=window,
    )
    
    # Return mean F1 (to maximize)
    return cv_results['mean_metrics']['f1']

# Run optimization
study = optuna.create_study(direction='maximize', sampler=TPESampler())
study.optimize(
    lambda trial: objective_gru(trial, features, labels),
    n_trials=100,
    timeout=7200,  # 2 hours
)
```

---

## 📊 Training Monitoring

### Key Metrics to Track

| Metric | Target | Description |
|--------|--------|-------------|
| Train Loss | Decreasing | BCEWithLogitsLoss |
| Val F1 | Maximizing | Primary optimization target |
| Val AUC | > 0.9 | Discrimination ability |
| Threshold Stability | Low variance | Consistent across folds |
| Training Time | < 2 hrs | Practical constraint |

### Logging (TensorBoard)

```python
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter(f'logs/tensorboard/gru_{datetime.now():%Y%m%d_%H%M%S}')

for epoch in range(max_epochs):
    # ... training ...
    
    writer.add_scalar('Loss/train', np.mean(train_losses), epoch)
    writer.add_scalar('F1/val', epoch_f1, epoch)
    writer.add_scalar('Threshold/val', epoch_thr, epoch)
    writer.add_scalar('LR', optimizer.param_groups[0]['lr'], epoch)

writer.close()
```

### View Logs
```bash
tensorboard --logdir logs/tensorboard --port 6006
```

---

## 🔄 Complete Training Commands

### Basic Training
```bash
# Activate environment
.venv\Scripts\activate

# Train GRU (default params)
python -m Algorithms.Gru

# Train with custom params
python -m Algorithms.Gru --window 48 --hidden 128 --num_layers 3 --max_epochs 100

# Train other algorithms
python -m Algorithms.Lstm --hidden 64 --num_layers 2
python -m Algorithms.Mlp --hidden 512 --num_layers 4
python -m Algorithms.RandomForest --n_estimators 500
python -m Algorithms.XGBoost --n_estimators 500 --max_depth 8
```

### Hyperparameter Tuning
```bash
# Tune GRU only (50 trials)
python -m tools.tune_optuna --algos gru --trials 50

# Tune multiple algorithms (100 trials each)
python -m tools.tune_optuna --algos gru,lstm,mlp,rf,xgb --trials 100

# Resume previous study
python -m tools.tune_optuna --algos gru --trials 50 --study-name gru-tuning --storage sqlite:///optuna.db
```

### Full Pipeline (Clean Retrain)
```bash
# 1. Backup current model
mv models models_backup_$(date +%Y%m%d)

# 2. Run full training
python -m Algorithms.Gru --window 48 --hidden 64 --num_layers 2 --max_epochs 50

# 3. Verify new model
python -c "
from backend.model_loader import load_model
ok = load_model()
print(f'Model loaded: {ok}')
"

# 4. Test prediction
curl -X POST http://localhost:8000/api/v1/predict -d @sample_request.json
```

---

## 📋 Quick Reference

| Step | Script | Key Parameters |
|------|--------|----------------|
| Load Data | `utils/ParserCreator.py` | `data_dir` |
| Impute Gaps | `utils/DataAggregation.py` | `max_gap_hours=24` |
| Features | `utils/DataAggregation.py` | 9 features |
| Leaks | `utils/DataAggregation.py` | `prob=0.02, duration=24-168h` |
| CV Split | `utils/CvkFold.py` | `n_splits=10, gap=24h` |
| Scale | `Algorithms/Gru.py` | `StandardScaler` |
| Window | `Algorithms/Gru.py` | `window=48, stride=1` |
| Train | `Algorithms/Gru.py` | `hidden=64, layers=2, dropout=0.2` |
| Threshold | `Algorithms/Gru.py` | Median F1-optimal |
| Save | `Algorithms/Gru.py` | `.pt, .joblib, .json, .txt` |

### Key Files
| File | Purpose |
|------|---------|
| `Algorithms/Gru.py` | Main GRU training script |
| `Algorithms/Lstm.py` | LSTM training |
| `Algorithms/Mlp.py` | MLP training |
| `Algorithms/RandomForest.py` | RF training |
| `Algorithms/XGBoost.py` | XGBoost training |
| `Algorithms/Svm.py` | SVM training |
| `utils/ParserCreator.py` | CSV loading |
| `utils/DataAggregation.py` | Features, leaks, aggregation |
| `utils/CvkFold.py` | Time-aware CV splits |
| `tools/tune_optuna.py` | Hyperparameter optimization |

### Output Artifacts
```
models/
├── gru_cls.pt                 # Model weights
├── gru_cls_scaler.joblib      # Feature scaler
├── gru_cls_meta.json          # Architecture config
├── gru_cls_thr.txt            # Optimal threshold
├── gru_cls_metrics.json       # CV metrics
└── artifacts/
    └── test_agg.parquet       # Frozen test set
```