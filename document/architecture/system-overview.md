# System Overview Architecture

High-level architecture of the PIPER Water Leakage Detection System.

## 🏗️ Overall Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PIPER SYSTEM ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│  │   FRONTEND   │────▶│   BACKEND    │────▶│    MODELS    │               │
│  │  (React/TS)  │     │  (FastAPI)   │     │   (GRU)      │               │
│  │  Port: 3000  │     │  Port: 8000  │     │              │               │
│  └──────────────┘     └──────────────┘     └──────────────┘               │
│         │                     │                     │                       │
│         ▼                     ▼                     ▼                       │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                        DATA LAYER                                 │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │      │
│  │  │ LeakageData │  │  Models/    │  │  Models/    │              │      │
│  │  │  (CSV)      │  │  artifacts  │  │  (.pt, etc) │              │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Summary

```
Raw CSV Data (LeakageData/)
        │
        ▼
Data Processing (utils/)
        │
        ▼
Feature Engineering (9 features)
        │
        ▼
Model Training (Algorithms/)
        │
        ▼
Model Artifacts (models/)
        │
        ▼
┌─────────────────┐     ┌─────────────────┐
│   BACKEND API   │     │   FRONTEND UI   │
│  (FastAPI)      │◀───▶│  (React/Vite)   │
│  Port: 8000     │     │  Port: 3000     │
└─────────────────┘     └─────────────────┘
```

## 🧩 Component Overview

### Frontend (React + TypeScript + Vite)
| Aspect | Details |
|--------|---------|
| **Framework** | React 18 with TypeScript |
| **Build Tool** | Vite 5 |
| **Styling** | Tailwind CSS |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **State** | React Hooks + Context |
| **API Client** | Axios |
| **Routing** | React Router v6 |

**Pages:**
- Dashboard (`/`) - Overview, stats, recent predictions
- Predict (`/predict`) - Live prediction interface
- Performance (`/performance`) - Model metrics, confusion matrix
- Data Explorer (`/data`) - Browse meters, view windows
- Settings (`/settings`) - Configuration
- Help (`/help`) - Documentation, API reference

### Backend (FastAPI)
| Aspect | Details |
|--------|---------|
| **Framework** | FastAPI 0.109+ |
| **Server** | Uvicorn (ASGI) |
| **Validation** | Pydantic v2 |
| **Config** | python-dotenv |
| **ML Runtime** | PyTorch CPU |
| **Data** | Pandas, NumPy, Scikit-learn |

**Endpoints:**
- `GET /api/v1/health` - Health check
- `GET /api/v1/model/info` - Model metadata
- `POST /api/v1/predict` - Single/batch prediction
- `POST /api/v1/predict/batch` - Full test set prediction
- `GET /api/v1/meters` - List available meters
- `GET /api/v1/data/sample` - Get sample test windows

### Model (GRU Neural Network)
| Aspect | Details |
|--------|---------|
| **Architecture** | GRUHead: 2-layer GRU, 64 hidden units |
| **Input** | [Batch, 48, 9] - 48 hours × 9 features |
| **Output** | Binary classification (leak/no leak) |
| **Threshold** | ~0.68 (F1-optimal from CV) |
| **Training** | Synthetic leaks, forward-chaining CV |
| **Artifacts** | `.pt`, `.joblib`, `.json`, `.txt` |

### Data Pipeline
```
CSV Files (LeakageData/)
    │
    ▼
Gap Imputation (conservative, step-preserving)
    │
    ▼
Feature Engineering (9 features)
    ├── Calendar: Hour, DayOfWeek, Month
    ├── Rolling: roll6_mean, roll24_mean, roll6_std, roll24_std
    ├── Relative: rel_to_roll24
    └── Delta: Delta_Volume
    │
    ▼
Leak Synthesis (progressive, realistic)
    │
    ▼
Time-Aware Split (per-meter forward-chaining)
    │
    ▼
Scaling (StandardScaler fit on train only)
    │
    ▼
Windowing (sliding windows for sequences)
    │
    ▼
Cross-Validation (10-fold, F1-optimal threshold)
```

## 🌐 Network Architecture

```
                    ┌─────────────────┐
                    │   CLIENT        │
                    │  (Browser)      │
                    └────────┬────────┘
                             │ HTTP/HTTPS
                             ▼
                    ┌─────────────────┐
                    │   FRONTEND      │
                    │  (Nginx/Vite)   │
                    │   Port: 3000    │
                    └────────┬────────┘
                             │ API Calls
                             ▼
                    ┌─────────────────┐
                    │   BACKEND       │
                    │  (FastAPI)      │
                    │   Port: 8000    │
                    └────────┬────────┘
                             │ Internal
                    ┌────────┴────────┐
                    ▼                 ▼
            ┌───────────────┐ ┌───────────────┐
            │   MODELS      │ │   DATA        │
            │  (File System)│ │  (File System)│
            └───────────────┘ └───────────────┘
```

## 🔒 Security Boundaries

| Boundary | Protection |
|----------|------------|
| **Client ↔ Frontend** | HTTPS, CSP headers |
| **Frontend ↔ Backend** | CORS policy, input validation (Pydantic) |
| **Backed ↔ Models** | File system permissions, read-only mounts |
| **Backend ↔ Data** | File system permissions, read-only mounts |
| **External Access** | Firewall/SG, rate limiting (optional) |

## 📦 Deployment Architectures

### Development
```
Local Machine
├── Terminal 1: uvicorn backend.main:app --reload (port 8000)
├── Terminal 2: npm run dev -- --port 3000 (port 3000)
└── Browser: http://localhost:3000
```

### Production (Docker Compose)
```
Server
├── docker-compose.yml
│   ├── piper-backend (port 8000)
│   ├── piper-frontend (port 80)
│   └── (optional) redis, postgres
├── Nginx Reverse Proxy (ports 80/443)
│   ├── / → frontend
│   └── /api/ → backend
└── SSL: Let's Encrypt / Certbot
```

### Production (Kubernetes)
```
Cluster
├── Namespace: piper
├── Deployment: piper-backend (3 replicas)
├── Deployment: piper-frontend (2 replicas)
├── Service: piper-backend (ClusterIP)
├── Service: piper-frontend (ClusterIP)
├── Ingress: piper-ingress (TLS)
├── PVC: piper-models-pvc (ReadOnlyMany)
├── PVC: piper-data-pvc (ReadOnlyMany)
└── ConfigMap/Secret: environment variables
```

### Cloud (AWS Example)
```
AWS Account
├── ECR: piper-backend, piper-frontend images
├── ECS Fargate: piper-backend service, piper-frontend service
├── ALB: piper-alb (HTTPS, path-based routing)
│   ├── /api/* → backend target group
│   └── /* → frontend target group
├── EFS: models/, LeakageData/ (shared storage)
├── Secrets Manager: THR_OVERRIDE, API keys
└── CloudWatch: Logs, Metrics, Alarms
```

## 🔄 Request Flow Example

### Prediction Request
```
1. User opens /predict page (Frontend)
2. User submits sensor data (JSON/CSV/manual)
3. Frontend validates & sends POST /api/v1/predict
4. Backend receives request
   ├── Validates with Pydantic schema
   ├── Loads model (singleton, cached)
   ├── Scales features (StandardScaler)
   ├── Runs GRU inference (PyTorch)
   ├── Applies threshold (0.68)
   └── Returns {probs, preds, thr}
5. Frontend displays results
   ├── Probability gauge
   ├── Binary prediction badge
   └── Confidence interpretation
```

### Batch Prediction Request
```
1. User clicks "Run Batch Prediction" (Frontend)
2. Frontend sends POST /api/v1/predict/batch
3. Backend loads frozen test set (test_agg.parquet)
4. For each window in test set:
   ├── Scale features
   ├── GRU inference
   └── Apply threshold
5. Backend returns aggregated metrics
   ├── Accuracy, Precision, Recall, F1
   ├── Confusion matrix
   └── Per-meter breakdown
6. Frontend renders charts & tables
```

## 📈 Scalability Considerations

| Component | Scaling Strategy |
|-----------|-----------------|
| **Frontend** | Static files → CDN, multiple replicas |
| **Backend** | Stateless → Horizontal (add replicas) |
| **Model** | Read-only → Shared volume / model server |
| **Data** | Read-only → Shared volume / object storage |
| **Inference** | Batch → Queue (Celery/RQ) for async |

## 🎯 Design Principles

1. **Separation of Concerns**: Frontend/UI separate from Backend/ML
2. **Stateless Backend**: Easy horizontal scaling
3. **Model as Artifact**: Versioned, immutable files
4. **Data Immutability**: Frozen test set for reproducibility
5. **Configuration via Environment**: 12-factor app principles
6. **Observability**: Health checks, structured logging
7. **Developer Experience**: Hot reload, TypeScript, auto-docs