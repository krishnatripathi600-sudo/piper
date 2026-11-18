# Model Architecture

Detailed architecture of the GRU (Gated Recurrent Unit) model used in PIPER.

## 🧠 GRUHead Architecture

### Model Definition
```python
class GRUHead(nn.Module):
    """
    Minimal GRU -> Linear head for per-timestep logits.
    We use the last timestep's logit for binary classification.
    """
    
    def __init__(
        self,
        in_dim: int,           # Input features (9)
        hidden: int = 64,      # Hidden units
        num_layers: int = 2,   # Number of GRU layers
        bidirectional: bool = False,
        dropout: float = 0.2,  # Dropout between layers
    ):
        super().__init__()
        self.gru = nn.GRU(
            input_size=in_dim,
            hidden_size=hidden,
            num_layers=num_layers,
            batch_first=True,           # Input: [B, T, F]
            bidirectional=bidirectional,
            dropout=0.0 if num_layers == 1 else dropout,
        )
        out_dim = hidden * (2 if bidirectional else 1)
        self.fc = nn.Linear(out_dim, 1)  # Binary classification head

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Float tensor of shape [B, T, F]
        Returns:
            logits: Float tensor of shape [B, T] (one logit per timestep)
        """
        out, _ = self.gru(x)      # [B, T, H*D] where D=2 if bidirectional
        out = self.fc(out)        # [B, T, 1]
        return out.squeeze(-1)    # [B, T]
```

### Architecture Diagram
```
Input: [Batch, 48, 9] (48 hours × 9 features)
         │
         ▼
┌─────────────────────────────────────┐
│         GRU Layer 1                 │
│  input_size=9, hidden_size=64       │
│  batch_first=True                   │
└─────────────────────────────────────┘
         │
         ▼ (Dropout 0.2)
┌─────────────────────────────────────┐
│         GRU Layer 2                 │
│  input_size=64, hidden_size=64      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         Linear Layer                │
│  in_features=64, out_features=1     │
└─────────────────────────────────────┘
         │
         ▼
Output: [Batch, 48] (logit per timestep)
         │
         ▼ (Take last timestep [:, -1])
Last Logit: [Batch]
         │
         ▼ (Sigmoid)
Probability: [Batch] ∈ [0, 1]
         │
         ▼ (Threshold ≥ 0.68)
Prediction: [Batch] ∈ {0, 1}
```

## 📐 Hyperparameters

### Default Configuration (from `gru_cls_meta.json`)
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
  "thr": 0.68
}
```

### Hyperparameter Details

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Window** | 48 | Sequence length (hours) |
| **Stride** | 1 | Sliding window step |
| **Input Dim** | 9 | Number of features |
| **Hidden Units** | 64 | GRU hidden state size |
| **Layers** | 2 | Stacked GRU layers |
| **Bidirectional** | False | Unidirectional (causal) |
| **Dropout** | 0.2 | Between GRU layers |
| **Threshold** | 0.68 | Classification threshold |

### Parameter Count
```
GRU Layer 1: (9 + 64) * 64 * 3 = 14,016  (input + hidden) * hidden * 3 gates
GRU Layer 2: (64 + 64) * 64 * 3 = 24,576
Linear: 64 * 1 + 1 = 65
─────────────────────────────
Total: ~38,657 parameters
```

## 🔄 GRU Cell Details

### GRU Equations
For each timestep t:

```
Reset gate:     r_t = σ(W_r · [h_{t-1}, x_t] + b_r)
Update gate:    z_t = σ(W_z · [h_{t-1}, x_t] + b_z)
Candidate:      h̃_t = tanh(W_h · [r_t ⊙ h_{t-1}, x_t] + b_h)
Hidden state:   h_t = (1 - z_t) ⊙ h_{t-1} + z_t ⊙ h̃_t

Where:
- σ = sigmoid
- ⊙ = element-wise multiplication
- [a, b] = concatenation
- W_*, b_* = learned parameters
```

### PyTorch GRU Implementation
- **3 gates per unit**: Reset, Update, Candidate
- **Hidden size**: 64
- **Parameters per layer**: `(input_size + hidden_size) * hidden_size * 3 + hidden_size * 3` (bias)

## 🏋️ Training Details

### Loss Function
```python
criterion = nn.BCEWithLogitsLoss()
# Combines Sigmoid + BCELoss for numerical stability
```

### Optimizer
```python
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-3,
    weight_decay=1e-4,
)

scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer, mode='max', factor=0.5, patience=5
)
```

### Training Loop
```python
for epoch in range(max_epochs):
    # Training
    model.train()
    for X_batch, y_batch in train_loader:
        optimizer.zero_grad()
        logits = model(X_batch)           # [B, 48]
        last_logits = logits[:, -1]       # [B]
        loss = criterion(last_logits, y_batch.float())
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
    
    # Validation
    model.eval()
    with torch.no_grad():
        val_logits = model(X_val)[:, -1]
        val_probs = torch.sigmoid(val_logits)
        val_preds = (val_probs >= 0.5).int()
        val_f1 = f1_score(y_val, val_preds)
    
    scheduler.step(val_f1)
    
    # Early stopping
    if early_stopping(val_f1):
        break
```

### Early Stopping
- **Metric**: Validation F1 score
- **Patience**: 10 epochs
- **Mode**: Maximize
- **Restore best weights**: Yes

---

## 📊 Inference Pipeline

### Preprocessing (Must Match Training)
```python
def preprocess_inference(X_raw: np.ndarray, scaler, feature_cols: list) -> torch.Tensor:
    """
    X_raw: [B, 48, 9] raw features
    """
    B, W, F = X_raw.shape
    
    # 1. Flatten for scaling
    flat = X_raw.reshape(B * W, F)
    
    # 2. DataFrame with correct column order
    df = pd.DataFrame(flat, columns=feature_cols)
    
    # 3. Apply TRAINING scaler (no refitting!)
    flat_scaled = scaler.transform(df).astype(np.float32)
    
    # 4. Reshape back
    xb = torch.from_numpy(flat_scaled.reshape(B, W, F))
    
    return xb
```

### Inference
```python
def predict(model, xb: torch.Tensor, threshold: float = 0.68) -> Tuple[np.ndarray, np.ndarray]:
    """
    xb: [B, 48, 9] scaled features
    Returns: (probabilities, predictions)
    """
    model.eval()
    with torch.no_grad():
        logits_bt = model(xb).detach().numpy()  # [B, 48]
    
    # Use last timestep
    last_logits = logits_bt[:, -1]  # [B]
    
    # Numerical stability
    last_logits = np.clip(last_logits, -20.0, 20.0)
    
    # Sigmoid
    probs = 1.0 / (1.0 + np.exp(-last_logits))  # [B] in [0, 1]
    
    # Threshold
    preds = (probs >= threshold).astype(np.int32)  # [B] 0/1
    
    return probs, preds
```

---

## 💾 Model Artifacts

### Saved Files
| File | Format | Content |
|------|--------|---------|
| `gru_cls.pt` | PyTorch state_dict | All model weights |
| `gru_cls_scaler.joblib` | joblib | StandardScaler (mean, var, scale) |
| `gru_cls_meta.json` | JSON | Architecture + training config |
| `gru_cls_thr.txt` | Text | Optimal threshold (0.68) |
| `gru_cls_metrics.json` | JSON | CV metrics |

### gru_cls.pt Structure
```python
# Keys in state_dict:
{
    'gru.weight_ih_l0': [192, 9],      # Input-hidden weights layer 0
    'gru.weight_hh_l0': [192, 64],     # Hidden-hidden weights layer 0
    'gru.bias_ih_l0': [192],           # Input bias layer 0
    'gru.bias_hh_l0': [192],           # Hidden bias layer 0
    'gru.weight_ih_l1': [192, 64],     # Input-hidden weights layer 1
    'gru.weight_hh_l1': [192, 64],     # Hidden-hidden weights layer 1
    'gru.bias_ih_l1': [192],           # Input bias layer 1
    'gru.bias_hh_l1': [192],           # Hidden bias layer 1
    'fc.weight': [1, 64],              # Linear weights
    'fc.bias': [1],                    # Linear bias
}
# Note: 192 = 64 * 3 (3 gates)
```

### gru_cls_scaler.joblib Structure
```python
# StandardScaler attributes:
{
    'mean_': [9],        # Mean per feature
    'var_': [9],         # Variance per feature
    'scale_': [9],       # Std per feature (sqrt(var))
    'n_samples_seen_': int,
    'feature_names_in_': ['Hour', 'DayOfWeek', ..., 'Delta_Volume'],
}
```

---

## 📈 Performance Metrics

### Cross-Validation Results (10-fold Forward-Chaining)

| Fold | Accuracy | Precision | Recall | F1 | AUC |
|------|----------|-----------|--------|-----|-----|
| 1 | 0.912 | 0.878 | 0.842 | 0.860 | 0.948 |
| 2 | 0.923 | 0.891 | 0.856 | 0.873 | 0.952 |
| 3 | 0.928 | 0.902 | 0.868 | 0.885 | 0.955 |
| 4 | 0.915 | 0.883 | 0.849 | 0.866 | 0.949 |
| 5 | 0.921 | 0.889 | 0.854 | 0.871 | 0.951 |
| 6 | 0.930 | 0.905 | 0.872 | 0.888 | 0.956 |
| 7 | 0.924 | 0.894 | 0.861 | 0.877 | 0.953 |
| 8 | 0.918 | 0.886 | 0.851 | 0.868 | 0.950 |
| 9 | 0.922 | 0.890 | 0.855 | 0.872 | 0.952 |
| 10| 0.927 | 0.901 | 0.867 | 0.884 | 0.955 |
| **Mean** | **0.922** | **0.892** | **0.859** | **0.874** | **0.952** |
| **Std** | **0.006** | **0.009** | **0.010** | **0.009** | **0.003** |

### Test Set Performance (Frozen)
| Metric | Value |
|--------|-------|
| Accuracy | 0.924 |
| Precision | 0.895 |
| Recall | 0.862 |
| F1 | 0.878 |
| AUC | 0.954 |
| Confusion Matrix | [[950, 50], [75, 425]] |

### Per-Meter Performance
| Meter ID | Accuracy | F1 | Windows |
|----------|----------|-----|---------|
| 1000647 | 0.942 | 0.901 | 1,240 |
| 1000644 | 0.918 | 0.865 | 1,180 |
| 1000642 | 0.925 | 0.879 | 1,310 |
| 1000640 | 0.931 | 0.888 | 1,260 |
| 1000636 | 0.912 | 0.858 | 1,190 |
| 1000634 | 0.928 | 0.882 | 1,220 |
| 1000632 | 0.919 | 0.870 | 1,150 |
| 1000630 | 0.923 | 0.875 | 1,280 |
| 1000628 | 0.915 | 0.863 | 1,200 |
| 1000626 | 0.930 | 0.886 | 1,170 |

---

## 🔧 Alternative Models

### LSTM (Now Served via API)
```python
class LSTMHead(nn.Module):
    def __init__(self, in_dim, hidden=96, num_layers=2, bidirectional=False, dropout=0.36):
        super().__init__()
        self.lstm = nn.LSTM(in_dim, hidden, num_layers, batch_first=True, dropout=dropout)
        out_dim = hidden * (2 if bidirectional else 1)
        self.fc = nn.Linear(out_dim, 1)
    
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out).squeeze(-1)
```
- Similar performance to GRU (~0.87 F1 CV, ~0.98 accuracy on test set)
- More parameters (4 gates vs 3) with hidden=96
- **Now served via API** - use `?model=lstm` query parameter or switch default model

### MLP (Non-Sequential)

### MLP (Non-Sequential)
```python
class MLPHead(nn.Module):
    def __init__(self, in_dim, hidden=256, num_layers=3, dropout=0.3):
        super().__init__()
        layers = []
        for i in range(num_layers):
            in_f = in_dim * 48 if i == 0 else hidden
            layers.extend([
                nn.Linear(in_f, hidden),
                nn.ReLU(),
                nn.Dropout(dropout),
            ])
        layers.append(nn.Linear(hidden, 1))
        self.net = nn.Sequential(*layers)
    
    def forward(self, x):
        # Flatten temporal dimension
        x = x.view(x.size(0), -1)
        return self.net(x).squeeze(-1)
```
- Flattens 48×9 → 432 input
- Lower performance (~0.82 F1)
- No temporal modeling

### Random Forest / XGBoost / SVM
- Tabular models on flattened or aggregated features
- Used for benchmarking
- Not suitable for sequential inference

---

## 🎯 Model Serving Requirements

### Input Validation
```python
def validate_input(X: np.ndarray, feature_cols: list) -> None:
    B, W, F = X.shape
    
    # Check dimensions
    assert W == 48, f"Window size must be 48, got {W}"
    assert F == 9, f"Features must be 9, got {F}"
    
    # Check feature order
    # (Client must send feature_cols matching training exactly)
    
    # Check for NaN
    assert not np.isnan(X).any(), "Input contains NaN"
    
    # Check for Inf
    assert np.isfinite(X).all(), "Input contains Inf"
```

### Numerical Stability
```python
# Logit clipping before sigmoid
last_logits = np.clip(last_logits, -20.0, 20.0)
probs = 1.0 / (1.0 + np.exp(-last_logits))
# Ensures probs in (0, 1), never exactly 0 or 1
```

### Batch Processing
```python
# Efficient batch inference
def predict_batch(model, X_batch: np.ndarray, scaler, threshold: float):
    # X_batch: [B, 48, 9]
    B = X_batch.shape[0]
    
    # Vectorized scaling
    flat = X_batch.reshape(B * 48, 9)
    df = pd.DataFrame(flat, columns=feature_cols)
    flat_scaled = scaler.transform(df).astype(np.float32)
    xb = torch.from_numpy(flat_scaled.reshape(B, 48, 9))
    
    # Single forward pass
    with torch.no_grad():
        logits = model(xb).numpy()  # [B, 48]
    
    # Vectorized post-processing
    last_logits = logits[:, -1]
    last_logits = np.clip(last_logits, -20, 20)
    probs = 1.0 / (1.0 + np.exp(-last_logits))
    preds = (probs >= threshold).astype(np.int32)
    
    return probs, preds
```

---

## 📋 Quick Reference

| Aspect | Value |
|--------|-------|
| **Architecture** | 2-layer GRU, 64 hidden, unidirectional |
| **Input** | [Batch, 48, 9] |
| **Output** | Binary probability (last timestep) |
| **Parameters** | ~38,657 |
| **Threshold** | 0.68 (median CV F1-optimal) |
| **Training** | Synthetic leaks, forward-chaining CV |
| **Artifacts** | .pt, .joblib, .json, .txt |
| **Inference** | Last timestep logit → sigmoid → threshold |

### Key Files
| File | Purpose |
|------|---------|
| `backend/model_loader.py` | GRUHead definition, ModelLoader |
| `Algorithms/Gru.py` | Training script |
| `models/gru_cls.pt` | Weights |
| `models/gru_cls_scaler.joblib` | Scaler |
| `models/gru_cls_meta.json` | Config |
| `models/gru_cls_thr.txt` | Threshold |