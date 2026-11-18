# PIPER - Documentation Directory

This directory contains all documentation for the PIPER Water Leakage Detection System, including setup instructions, command references, architecture details, and execution flows.

## 📁 Directory Structure

```
document/
├── README.md                      # This file - documentation index
├── api_documentation.md           # Complete REST API documentation
├── setup/
│   ├── prerequisites.md           # System requirements
│   ├── installation.md            # Step-by-step installation guide
│   ├── environment.md             # Environment configuration
│   └── troubleshooting.md         # Common issues and fixes
├── commands/
│   ├── backend-commands.md        # Backend server commands
│   ├── frontend-commands.md       # Frontend development commands
│   ├── training-commands.md       # Model training commands
│   ├── deployment-commands.md     # Deployment commands
│   └── utility-commands.md        # Utility and maintenance commands
├── architecture/
│   ├── system-overview.md         # High-level architecture
│   ├── backend-architecture.md    # Backend components
│   ├── frontend-architecture.md   # Frontend components
│   ├── data-pipeline.md           # Data processing pipeline
│   ├── model-architecture.md      # GRU/LSTM model details
│   └── api-reference.md           # API endpoints reference
└── flow/
    ├── startup-flow.md            # Application startup sequence
    ├── prediction-flow.md         # Prediction request flow
    ├── training-flow.md           # Model training flow
    └── data-flow.md               # Data processing flow
```

## 🚀 Quick Navigation

| Category | Document | Description |
|----------|----------|-------------|
| **API Docs** | [API Documentation](api_documentation.md) | Complete REST API reference with examples |
| **Setup** | [Prerequisites](setup/prerequisites.md) | System requirements (Python, Node.js, etc.) |
| | [Installation](setup/installation.md) | Complete installation guide |
| | [Environment](setup/environment.md) | Configuration via `.env` |
| | [Troubleshooting](setup/troubleshooting.md) | Common issues and solutions |
| **Commands** | [Backend](commands/backend-commands.md) | Backend server management |
| | [Frontend](commands/frontend-commands.md) | Frontend development |
| | [Training](commands/training-commands.md) | Model training & tuning |
| | [Deployment](commands/deployment-commands.md) | Production deployment |
| | [Utilities](commands/utility-commands.md) | Maintenance commands |
| **Architecture** | [System Overview](architecture/system-overview.md) | High-level architecture |
| | [Backend](architecture/backend-architecture.md) | FastAPI backend structure |
| | [Frontend](architecture/frontend-architecture.md) | React + TypeScript frontend |
| | [Data Pipeline](architecture/data-pipeline.md) | ETL and feature engineering |
| | [Model](architecture/model-architecture.md) | GRU/LSTM neural network details |
| | [API Reference](architecture/api-reference.md) | All REST endpoints |
| **Flow** | [Startup](flow/startup-flow.md) | Application initialization |
| | [Prediction](flow/prediction-flow.md) | Inference request lifecycle |
| | [Training](flow/training-flow.md) | Model training pipeline |
| | [Data](flow/data-flow.md) | Data processing pipeline |

## 📋 Project Summary

**PIPER** (Pipeline Intelligence for Pipeline Event Recognition) is a complete, locally runnable application for detecting water leakages in public utility networks using IoT sensor data and machine learning.

### Key Components
- **Backend**: FastAPI (Python) - REST API serving GRU & LSTM model predictions with actionable recommendations
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS - Interactive dashboard
- **Models**: 
  - GRU (Gated Recurrent Unit) - 2-layer, 64 hidden units, binary classification
  - LSTM (Long Short-Term Memory) - 2-layer, 96 hidden units, binary classification
- **Action Engine**: Configurable rule-based action recommendations based on leak probability and degradation
- **Data**: Hourly water meter readings with 9 engineered features

### Quick Start
```cmd
# Automated (Windows)
start_piper.bat

# Manual
# Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs
- **API Docs (ReDoc)**: http://localhost:8000/redoc

---

*Last updated: November 2026*