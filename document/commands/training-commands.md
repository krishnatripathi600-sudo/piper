# Training Commands Reference

Complete command reference for training and tuning models in PIPER.

## 🧠 Available Algorithms

| Algorithm | Module | Description |
|-----------|--------|-------------|
| **GRU** | `Algorithms.Gru` | Gated Recurrent Unit (primary model) |
| **LSTM** | `Algorithms.Lstm` | Long Short-Term Memory |
| **MLP** | `Algorithms.Mlp` | Multi-Layer Perceptron |
| **Random Forest** | `Algorithms.RandomForest` | Ensemble tree method |
| **SVM** | `Algorithms.Svm` | Support Vector Machine |
| **XGBoost** | `Algorithms.XGBoost` | Gradient boosting |

---

## 🏃 Basic Training

### Activate Environment First
```cmd
.venv\Scripts\activate
```

### Train GRU (Default Parameters)
```cmd
python -m Algorithms.Gru
```

### Train with Custom Parameters
```cmd
# GRU with custom architecture
python -m Algorithms.Gru --window 48 --hidden 128 --num_layers 2 --max_epochs 20

# LSTM
python -m Algorithms.Lstm --window 48 --hidden 64 --num_layers 2 --max_epochs 30

# MLP
python -m Algorithms.Mlp --window 48 --hidden 256 --num_layers 3 --max_epochs 50

# Random Forest
python -m Algorithms.RandomForest --n_estimators 200 --max_depth 15

# SVM
python -m Algorithms.Svm --kernel rbf --C 1.0 --gamma scale

# XGBoost
python -m Algorithms.XGBoost --n_estimators 300 --max_depth 6 --learning_rate 0.1
```

---

## ⚙️ Common Training Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--window` | int | 48 | Sequence window size (hours) |
| `--stride` | int | 1 | Sliding window stride |
| `--hidden` | int | 64 | Hidden units (neural nets) |
| `--num_layers` | int | 2 | Number of layers (neural nets) |
| `--max_epochs` | int | 50 | Maximum training epochs |
| `--batch_size` | int | 256 | Training batch size |
| `--lr` | float | 1e-3 | Learning rate |
| `--dropout` | float | 0.2 | Dropout rate |
| `--bidirectional` | bool | False | Bidirectional RNN |
| `--patience` | int | 10 | Early stopping patience |
| `--val_split` | float | 0.2 | Validation split ratio |
| `--seed` | int | 42 | Random seed |

### Algorithm-Specific Arguments

#### GRU / LSTM
```cmd
--hidden 128 --num_layers 2 --bidirectional --dropout 0.3 --lr 1e-3
```

#### MLP
```cmd
--hidden 512 --num_layers 4 --dropout 0.3 --lr 1e-3
```

#### Random Forest
```cmd
--n_estimators 500 --max_depth 20 --min_samples_split 5 --min_samples_leaf 2
```

#### XGBoost
```cmd
--n_estimators 500 --max_depth 8 --learning_rate 0.05 --subsample 0.8 --colsample_bytree 0.8
```

---

## 🎯 Hyperparameter Tuning (Optuna)

### Basic Tuning
```cmd
# Tune GRU only
python -m tools.tune_optuna --algos gru --trials 50

# Tune multiple algorithms
python -m tools.tune_optuna --algos gru,lstm,mlp,rf,svm,xgb --trials 100
```

### Advanced Tuning
```cmd
# Custom study name and storage
python -m tools.tune_optuna \
  --algos gru,lstm \
  --trials 200 \
  --study-name piper-tuning-2024 \
  --storage sqlite:///optuna_studies.db \
  --timeout 7200

# Resume previous study
python -m tools.tune_optuna \
  --algos gru \
  --trials 100 \
  --study-name piper-tuning-2024 \
  --storage sqlite:///optuna_studies.db
```

### Optuna Arguments
| Argument | Description |
|----------|-------------|
| `--algos` | Comma-separated: gru,lstm,mlp,rf,svm,xgb |
| `--trials` | Number of Optuna trials per algorithm |
| `--study-name` | Optuna study name (default: piper-tuning) |
| `--storage` | Optuna storage URL (sqlite, postgresql, etc.) |
| `--timeout` | Max time in seconds |
| `--n-jobs` | Parallel jobs (default: 1) |
| `--sampler` | Sampler: tpe, random, cmaes |
| `--pruner` | Pruner: median, hyperband, none |

---

## 📊 Cross-Validation Training

### Forward-Chaining CV (Time-Aware)
```cmd
# Built into training scripts - uses 10-fold forward-chaining by default
python -m Algorithms.Gru --cv_folds 10
```

### Custom CV Parameters
```cmd
# In code: modify CvkFold in utils/CvkFold.py
# n_splits=10, gap=24 (hours between train/test)
```

---

## 💾 Model Artifacts

### Output Files (saved to `models/`)
| File | Description |
|------|-------------|
| `gru_cls.pt` | PyTorch model state dict |
| `gru_cls_scaler.joblib` | StandardScaler fit on training data |
| `gru_cls_meta.json` | Architecture & training config |
| `gru_cls_thr.txt` | Optimal threshold (median across CV folds) |
| `gru_cls_metrics.json` | CV metrics (accuracy, precision, recall, F1, AUC) |

### Verify Trained Model
```cmd
.venv\Scripts\activate
python -c "
import json, joblib, torch
from pathlib import Path

# Check artifacts
for f in ['gru_cls.pt', 'gru_cls_scaler.joblib', 'gru_cls_meta.json', 'gru_cls_thr.txt']:
    p = Path('models') / f
    print(f'{f}: {\"EXISTS\" if p.exists() else \"MISSING\"}')

# Load metadata
with open('models/gru_cls_meta.json') as f:
    meta = json.load(f)
print(f'Model: {meta[\"model\"]}')
print(f'Window: {meta[\"window\"]}')
print(f'Hidden: {meta[\"hidden\"]}')
print(f'Layers: {meta[\"num_layers\"]}')
print(f'Bidirectional: {meta[\"bidirectional\"]}')
print(f'Threshold: {meta[\"thr\"]}')

# Load threshold
with open('models/gru_cls_thr.txt') as f:
    print(f'Threshold (txt): {f.read().strip()}')
"
```

---

## 🔬 Experiment Tracking

### MLflow Integration (if configured)
```cmd
# Start MLflow UI
mlflow ui --port 5000

# Training with MLflow (set in code)
# MLFLOW_TRACKING_URI=http://localhost:5000 python -m Algorithms.Gru
```

### TensorBoard (for neural nets)
```cmd
# Start TensorBoard
tensorboard --logdir logs/tensorboard --port 6006

# In training code: add SummaryWriter
```

---

## 📈 Evaluation Commands

### Evaluate on Test Set
```cmd
# After training, run batch prediction via API
curl -X POST http://localhost:8000/api/v1/predict/batch \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Compare Models
```cmd
# Run all algorithms and compare
for algo in gru lstm mlp rf svm xgb; do
  echo "Training $algo..."
  python -m Algorithms.$algo 2>&1 | tail -20
done
```

### Generate Metrics Report
```cmd
.venv\Scripts\activate
python -c "
import json
from pathlib import Path

models = ['gru', 'lstm', 'mlp', 'rf', 'svm', 'xgb']
for m in models:
    metrics_file = Path(f'models/{m}_cls_metrics.json')
    if metrics_file.exists():
        with open(metrics_file) as f:
            metrics = json.load(f)
        print(f'{m.upper()}: F1={metrics.get(\"f1\", 0):.4f}, AUC={metrics.get(\"auc\", 0):.4f}')
    else:
        print(f'{m.upper()}: No metrics file')
"
```

---

## 🔄 Retraining Workflow

### Full Retrain Pipeline
```cmd
# 1. Backup current model
mkdir -p models/backup_$(date +%Y%m%d)
cp models/gru_cls.* models/backup_$(date +%Y%m%d)/

# 2. Retrain with new data / params
.venv\Scripts\activate
python -m Algorithms.Gru --window 48 --hidden 128 --num_layers 3 --max_epochs 50

# 3. Verify new model
python -c "
from backend.model_loader import load_model
ok = load_model()
print(f'Model loaded: {ok}')
"

# 4. Test API
curl -X POST http://localhost:8000/api/v1/predict -d @sample_request.json
```

### A/B Testing Setup
```cmd
# Keep multiple model versions
models/
├── gru_cls_v1.pt
├── gru_cls_v2.pt
├── gru_cls_scaler_v1.joblib
├── gru_cls_scaler_v2.joblib
└── gru_cls_meta_v1.json

# Load specific version in backend/model_loader.py
```

---

## 🖥️ GPU Training (if available)

### Check GPU Availability
```cmd
.venv\Scripts\activate
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')"
```

### Install CUDA PyTorch
```cmd
pip install torch --index-url https://download.pytorch.org/whl/cu121
# Or cu118, cu124 depending on CUDA version
```

### Train on GPU
```cmd
# Code automatically uses CUDA if available
# Force CPU: CUDA_VISIBLE_DEVICES='' python -m Algorithms.Gru
```

---

## 📋 Quick Reference Card

| Task | Command |
|------|---------|
| Train GRU (default) | `python -m Algorithms.Gru` |
| Train GRU (custom) | `python -m Algorithms.Gru --hidden 128 --num_layers 3 --max_epochs 50` |
| Train LSTM | `python -m Algorithms.Lstm --hidden 64 --num_layers 2` |
| Train RF | `python -m Algorithms.RandomForest --n_estimators 500` |
| Train XGBoost | `python -m Algorithms.XGBoost --n_estimators 500 --max_depth 8` |
| Tune GRU (Optuna) | `python -m tools.tune_optuna --algos gru --trials 50` |
| Tune all (Optuna) | `python -m tools.tune_optuna --algos gru,lstm,rf,xgb --trials 100` |
| Verify model | `python -c "from backend.model_loader import load_model; print(load_model())"` |
| View metrics | `cat models/gru_cls_metrics.json` |
| Check threshold | `cat models/gru_cls_thr.txt` |