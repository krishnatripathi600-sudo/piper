# PIPER Repository - Functionality Audit

## Executive Summary
This repository contains a **water leakage detection system** for public utility networks using IoT sensor data and machine learning. The core functionality is **leak classification** (binary: leak vs no-leak) using time-series sensor data from water meters.

---

## 1. IMPLEMENTED AND WORKING (Category 1)

### 1.1 Trained Models with Artifacts
| Model | Status | Artifacts |
|-------|--------|-----------|
| **GRU Classifier** | ✅ Fully trained & deployable | `models/gru_cls.pt`, `models/gru_cls_scaler.joblib`, `models/gru_cls_meta.json`, `models/gru_cls_thr.txt` |
| **LSTM Classifier** | ✅ Trained (no serving code) | `models/lstm_cls.pt`, `models/lstm_cls_scaler.joblib` |

### 1.2 Training Algorithms (All Implemented)
- **GRU** (`Algorithms/Gru.py`) - PyTorch GRU with forward-chaining CV threshold selection
- **LSTM** (`Algorithms/Lstm.py`) - PyTorch LSTM with forward-chaining CV threshold selection
- **MLP** (`Algorithms/Mlp.py`) - PyTorch feed-forward network
- **Random Forest** (`Algorithms/RandomForest.py`) - sklearn RF with CV threshold
- **SVM** (`Algorithms/Svm.py`) - sklearn SVM (linear, RBF, RBF approx)
- **XGBoost** (`Algorithms/XGBoost.py`) - XGBoost with early stopping & CV threshold

### 1.3 Data Pipeline (Complete)
- **CSV Loading** - Multi-meter CSV loading with datetime parsing (`DataAggregation.load_and_merge`)
- **Gap Imputation** - Conservative step-preserving imputation (`DataAggregation.impute_gaps_step_preserve`)
- **Feature Engineering** - Calendar (Hour, DayOfWeek, Month), Rolling stats (6h, 24h mean/std), Delta volume, Relative features
- **Leak Synthesis** - Realistic persistent leak injection with progressive ramp-up (`DataAggregation.inject_random_leak_segments`)
- **Time-Aware Split** - Per-meter forward-chaining train/test split (`DataAggregation.time_based_group_split`)
- **Feature Scaling** - StandardScaler fit on train only (`DataAggregation.scale_on_train`)

### 1.4 Cross-Validation & Threshold Selection
- **Forward-Chaining CV** - Per-meter, time-ordered folds (`CvkFold._make_group_forward_time_folds`)
- **F_beta-optimal Threshold** - Per-fold threshold selection via PR curve (`CvkFold._choose_threshold_fbeta`)
- **Robust Median Threshold** - Median across folds for final deployment (`CvkFold.get_cv_threshold_on_train`)

### 1.5 SageMaker Deployment (Production-Ready)
- **Inference Server** (`server/inference.py`) - GRU model with `model_fn`, `input_fn`, `predict_fn`, `output_fn`
- **Deployment Script** (`tools/sm_deploy_endpoint.py`) - S3 upload + SageMaker endpoint creation (provisioned/serverless)
- **Validation Script** (`tools/sm_invoke_demo.py`) - End-to-end endpoint testing with frozen test data

### 1.6 Hyperparameter Optimization
- **Optuna Integration** (`tools/tune_optuna.py`) - F1-maximization for all 6 algorithms

### 1.7 Data Assets
- **11 CSV files** in `LeakageData/` - Real meter readings (Meter_ID, Timestamp, Volume)
- **Frozen test set** - `models/artifacts/test_agg.parquet` for consistent evaluation

---

## 2. IMPLEMENTED BUT NOT WORKING / PARTIAL (Category 2 & 3)

| Component | Status | Notes |
|-----------|--------|-------|
| **MLP Training** | ⚠️ Code complete | No saved model artifacts in `models/` |
| **Random Forest Training** | ⚠️ Code complete | No saved model artifacts in `models/` |
| **SVM Training** | ⚠️ Code complete | No saved model artifacts in `models/` |
| **XGBoost Training** | ⚠️ Code complete | No saved model artifacts in `models/` |
| **LSTM Serving** | ⚠️ Trained but no `inference.py` | Only GRU has SageMaker inference code |
| **Local REST API** | ❌ Missing | Only SageMaker `inference.py` exists; no FastAPI/Flask server |

---

## 3. NOT IMPLEMENTED (Category 4) - DO NOT BUILD

| Feature | Reason |
|---------|--------|
| SHAP Explainability | No implementation exists |
| Decision-Gating/Response Mechanism | No implementation exists |
| MLOps Pipeline (retraining, drift detection) | Only Optuna tuning exists |
| Real-time Sensor Ingestion | No streaming/data ingestion code |
| Telemetry/Monitoring Dashboard | No backend for this |
| Multi-model Ensemble/Serving | Only single-model (GRU) serving code |
| User Authentication/Management | Not in scope |
| Leak Localization (spatial) | Only temporal classification exists |

---

## 4. Frontend Scope - What to Build

Based on **only Category 1** functionality:

### Backend API Needed (to be created)
- **POST `/predict`** - Accept sensor windows, return leak probability & prediction (GRU model)
- **GET `/model/info`** - Return model metadata (features, window, threshold, metrics)
- **GET `/health`** - Health check
- **GET `/meters`** - List available meter IDs from data
- **GET `/data/sample`** - Get sample windows for testing (from frozen test parquet)

### Frontend Pages
1. **Dashboard/Overview** - System status, model info, quick prediction test
2. **Live Prediction** - Input sensor data window → get leak probability
3. **Model Performance** - Display stored metrics (accuracy, F1, precision, recall, confusion matrix)
4. **Data Explorer** - View meter readings, feature distributions, leak segments
5. **Batch Prediction** - Upload CSV / use frozen test set → batch predictions

---

## 5. Technical Stack Decisions

### Backend (New - Minimal Addition)
- **FastAPI** - Lightweight, async, auto-docs
- **PyTorch** - Load GRU model (existing `server/inference.py` logic adapted)
- **joblib** - Load scaler
- **pandas/numpy** - Data handling

### Frontend (New)
- **React 18 + TypeScript + Vite**
- **Tailwind CSS** - Styling
- **Recharts** - Visualizations
- **Lucide React** - Icons
- **Axios** - API client

---

## 6. Files to Create/Modify

### Backend (New)
```
piperApp/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── model_loader.py      # Load GRU model + scaler + meta
│   ├── schemas.py           # Pydantic request/response models
│   ├── data_service.py      # Load test data, meter listings
│   └── requirements.txt     # Backend dependencies
```

### Frontend (New)
```
piperApp/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/client.ts
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types/
│   └── .env.example
```

### Root
```
piperApp/
├── start_piper.bat          # Windows startup script
├── .env.example
├── README.md                # Updated with run instructions
└── AUDIT.md                 # This file
```