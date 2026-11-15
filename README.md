# PIPER - Water Leakage Detection System

A complete, locally runnable application for detecting water leakages in public utility networks using IoT sensor data and machine learning.

## 🎯 Overview

PIPER (Pipeline Intelligence for Pipeline Event Recognition) provides a professional dashboard for monitoring and predicting water leaks in utility networks. The system uses a GRU (Gated Recurrent Unit) neural network trained on hourly water meter readings to classify whether a leak exists.

### Key Features

- **Live Prediction** - Test the GRU model with sensor data windows
- **Model Performance** - View cross-validated metrics (accuracy, precision, recall, F1, confusion matrix)
- **Data Explorer** - Browse meter data and frozen test windows
- **Batch Prediction** - Run predictions on the full test set
- **Professional Dashboard** - Modern, responsive UI built with React + Tailwind CSS

## 🏗️ Architecture

```
piperApp/
├── backend/                 # FastAPI backend server
│   ├── main.py             # FastAPI app with REST endpoints
│   ├── model_loader.py     # GRU model loading & inference
│   ├── data_service.py     # Test data access
│   ├── schemas.py          # Pydantic request/response models
│   └── requirements.txt    # Python dependencies
├── frontend/               # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── api/            # API client
│   │   └── types/          # TypeScript types
│   └── package.json
├── models/                 # Trained model artifacts
│   ├── gru_cls.pt          # GRU model weights
│   ├── gru_cls_scaler.joblib  # Feature scaler
│   ├── gru_cls_meta.json   # Model metadata
│   └── artifacts/
│       └── test_agg.parquet # Frozen test set
├── LeakageData/            # Raw meter CSV data
├── Algorithms/             # Training scripts (GRU, LSTM, MLP, RF, SVM, XGBoost)
├── utils/                  # Data processing utilities
├── start_piper.bat         # Windows startup script
└── .env.example            # Environment configuration template
```

## 🚀 Quick Start (Windows)

### Prerequisites

- **Python 3.10+** with `venv` module
- **Node.js 18+** with `npm`
- **Git** (for cloning)

### Option 1: Automated Startup (Recommended)

```cmd
# Clone the repository
git clone https://github.com/ApoErch/Water-Leakage-Detection.git
cd Water-Leakage-Detection

# Run the startup script (installs deps, starts both servers)
start_piper.bat
```

This will:
1. Create a Python virtual environment (`.venv`)
2. Install backend dependencies
3. Install frontend dependencies
4. Start the backend on `http://localhost:8000`
5. Start the frontend on `http://localhost:3000`

### Option 2: Manual Setup

**Backend:**
```cmd
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend (in a new terminal):**
```cmd
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/model/info` | Model metadata & configuration |
| POST | `/api/v1/predict` | Single/multi-window prediction |
| POST | `/api/v1/predict/batch` | Batch prediction on test set |
| GET | `/api/v1/meters` | List available meters |
| GET | `/api/v1/data/sample` | Get sample test windows |

### Prediction Request Format

```json
{
  "windows": [[[f1, f2, ..., f9], ... 48 steps ...]],  // [B, 48, 9]
  "feature_cols": ["Hour", "DayOfWeek", "Month", "roll6_mean", "roll24_mean", "roll6_std", "roll24_std", "rel_to_roll24", "Delta_Volume"],
  "thr": 0.68
}
```

### Prediction Response

```json
{
  "probs": [0.847],      // Leak probability per window
  "preds": [1],          // Binary prediction (0=no leak, 1=leak)
  "thr": 0.68            // Threshold used
}
```

## 🎨 Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | System overview, quick stats, recent predictions |
| Live Prediction | `/predict` | Test model with manual/sample/JSON input |
| Model Performance | `/performance` | Metrics, confusion matrix, feature list |
| Data Explorer | `/data` | Browse meters, view test windows |
| Settings | `/settings` | System configuration |
| Help | `/help` | FAQs, API reference, quick guides |

## 🔬 Model Details

- **Architecture**: GRUHead (2-layer GRU, 64 hidden units, unidirectional)
- **Input**: 48-hour windows × 9 features
- **Features**: Hour, DayOfWeek, Month, roll6_mean, roll24_mean, roll6_std, roll24_std, rel_to_roll24, Delta_Volume
- **Threshold**: ~0.68 (F1-optimal via 10-fold forward-chaining CV)
- **Training**: Synthetic leak injection, per-meter time-aware splits
- **Artifacts**: `gru_cls.pt`, `gru_cls_scaler.joblib`, `gru_cls_meta.json`

## 🛠️ Development

### Backend Development

```cmd
# Activate venv
.venv\Scripts\activate

# Run with auto-reload
python -m uvicorn backend.main:app --reload

# API docs available at http://localhost:8000/docs
```

### Frontend Development

```cmd
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000   # Development server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint check
```

### Training Models

The repository includes training scripts for multiple algorithms:

```cmd
# Activate venv
.venv\Scripts\activate

# Train GRU (default params)
python -m Algorithms.Gru

# Train with custom params
python -m Algorithms.Gru --window 48 --hidden 128 --num_layers 2 --max_epochs 20

# Hyperparameter tuning with Optuna
python -m tools.tune_optuna --algos gru,lstm,rf --trials 50
```

## 📦 Deployment

### Production Build

```cmd
# Build frontend
cd frontend
npm run build

# The dist/ folder contains production-ready static files
# Serve with nginx, Apache, or any static file server
```

### Docker (Optional)

```dockerfile
# Backend
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Frontend (multi-stage)
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

## 📊 Data Pipeline

The system uses a sophisticated data pipeline:

1. **CSV Loading** - Multi-meter hourly readings
2. **Gap Imputation** - Conservative step-preserving fill
3. **Feature Engineering** - Calendar, rolling stats, deltas
4. **Leak Synthesis** - Realistic progressive leak injection
5. **Time-Aware Split** - Per-meter forward-chaining
6. **Scaling** - StandardScaler fit on train only
7. **Windowing** - Sliding windows for sequence models
8. **CV Threshold** - F1-optimal per fold, median across folds

## ⚙️ Configuration

Copy `.env.example` to `.env` and adjust:

```env
VITE_API_URL=http://localhost:8000/api/v1
MODELS_DIR=../models
DATA_DIR=../LeakageData
THR_OVERRIDE=0.68
HOST=0.0.0.0
PORT=8000
FRONTEND_PORT=3000
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📚 References

- Original research: Leak Detection in Public Utility Networks using IoT and Machine Learning
- Repository: https://github.com/ApoErch/Water-Leakage-Detection
- SageMaker Deployment Guide: See README section on AWS SageMaker

## ⚠️ Important Notes

- **Only the GRU model is served** via the API (LSTM trained but no serving code)
- **Synthetic leaks** are used for training (no real leak labels in raw data)
- **Frozen test set** ensures reproducible batch predictions
- **No SHAP/explainability** implemented in current version
- **No real-time ingestion** - this is a batch prediction system

---

**Built with**: FastAPI, React 18, TypeScript, Vite, Tailwind CSS, Recharts, PyTorch