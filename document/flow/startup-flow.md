# Startup Flow

Application initialization sequence for PIPER Water Leakage Detection System.

## 🔄 Overall Startup Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PIPER STARTUP FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER                                                                        │
│   │                                                                         │
│   ▼                                                                         │
│  start_piper.bat (Windows) OR Manual Commands                              │
│   │                                                                         │
│   ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. ENVIRONMENT SETUP                                                │   │
│  │    ├── Check Python/Node versions                                  │   │
│  │    ├── Create/Activate .venv                                       │   │
│  │    ├── Install backend deps (pip)                                  │   │
│  │    └── Install frontend deps (npm)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│   │                                                                         │
│   ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2. BACKEND STARTUP (Terminal 1)                                     │   │
│  │    ├── Load .env configuration                                     │   │
│  │    ├── Initialize FastAPI app                                      │   │
│  │    ├── Load GRU Model (model_loader.py)                            │   │
│  │    │   ├── Read gru_cls_meta.json                                  │   │
│  │    │   ├── Initialize GRUHead architecture                         │   │
│  │    │   ├── Load weights from gru_cls.pt                            │   │
│  │    │   ├── Load scaler from gru_cls_scaler.joblib                  │   │
│  │    │   └── Load threshold from gru_cls_thr.txt                     │   │
│  │    ├── Initialize DataService                                      │   │
│  │    │   ├── Scan LeakageData/ for meters                           │   │
│  │    │   └── Load test_agg.parquet metadata                         │   │
│  │    ├── Configure CORS, middleware                                 │   │
│  │    └── Start Uvicorn on 0.0.0.0:8000                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│   │                                                                         │
│   ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3. FRONTEND STARTUP (Terminal 2)                                    │   │
│  │    ├── Load .env.local / .env                                      │   │
│  │    ├── Vite dev server startup                                    │   │
│  │    ├── TypeScript compilation check                               │   │
│  │    ├── Tailwind CSS processing                                    │   │
│  │    ├── HMR (Hot Module Replacement) setup                         │   │
│  │    └── Start on http://localhost:3000                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│   │                                                                         │
│   ▼                                                                         │
│  READY: Frontend at http://localhost:3000, Backend at http://localhost:8000│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Automated Startup (Windows)

### `start_piper.bat` Execution Flow

```batch
@echo off
REM =====================================================================
REM 1. VALIDATE ENVIRONMENT
REM =====================================================================
- Check backend\main.py exists
- Check frontend\package.json exists
- Warn if models\gru_cls.pt missing

REM =====================================================================
REM 2. PYTHON VIRTUAL ENVIRONMENT
REM =====================================================================
IF NOT EXIST .venv\Scripts\activate.bat (
    python -m venv .venv
)
CALL .venv\Scripts\activate.bat

REM =====================================================================
REM 3. BACKEND DEPENDENCIES
REM =====================================================================
pip install -q -r backend/requirements.txt
REM Installs: fastapi, uvicorn, pydantic, python-dotenv, numpy, pandas, 
REM           scikit-learn, joblib, torch (CPU)

REM =====================================================================
REM 4. FRONTEND DEPENDENCIES
REM =====================================================================
CD frontend
IF NOT EXIST node_modules (
    npm install
)
CD ..

REM =====================================================================
REM 5. START BACKEND (New Window)
REM =====================================================================
START "PIPER Backend" CMD /K "
    CD /D %SCRIPT_DIR%
    CALL .venv\Scripts\activate.bat
    python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"

REM =====================================================================
REM 6. WAIT FOR BACKEND
REM =====================================================================
TIMEOUT /T 3 /NOBREAK >NUL

REM =====================================================================
REM 7. START FRONTEND (New Window)
REM =====================================================================
START "PIPER Frontend" CMD /K "
    CD /D %SCRIPT_DIR%\frontend
    npm run dev
"

REM =====================================================================
REM 8. DISPLAY ACCESS INFO
REM =====================================================================
ECHO Backend API:  http://localhost:8000
ECHO API Docs:     http://localhost:8000/docs
ECHO Frontend:     http://localhost:3000
```

---

## 🐍 Backend Startup Details

### `backend/main.py` Initialization

```python
# 1. IMPORTS & CONFIG
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.model_loader import load_model, get_model_loader
from backend.data_service import DataService
from backend.schemas import *
import os
from pathlib import Path

# 2. LIFESPAN MANAGER (Startup/Shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    print("[Startup] Loading model...")
    model_loaded = load_model()  # Blocking load
    if not model_loaded:
        print("[Startup] WARNING: Model failed to load!")
    else:
        print("[Startup] Model loaded successfully")
    
    print("[Startup] Initializing data service...")
    app.state.data_service = DataService(
        data_dir=Path(os.environ.get("DATA_DIR", "../LeakageData")),
        models_dir=Path(os.environ.get("MODELS_DIR", "../models"))
    )
    
    yield  # Application runs here
    
    # SHUTDOWN (cleanup if needed)
    print("[Shutdown] Cleaning up...")

# 3. APP CREATION
app = FastAPI(
    title="PIPER API",
    description="Water Leakage Detection API",
    version="1.0.0",
    lifespan=lifespan,
)

# 4. MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. ROUTES REGISTRATION
# ... all @app.get/@app.post decorators

# 6. ENTRY POINT (when run directly)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        reload=True,
    )
```

### Model Loading Sequence (`model_loader.py`)

```python
def load(self) -> bool:
    """Load model artifacts from disk."""
    
    # 1. DEFINE PATHS
    meta_path = self.models_dir / "gru_cls_meta.json"
    scaler_path = self.models_dir / "gru_cls_scaler.joblib"
    state_path = self.models_dir / "gru_cls.pt"
    
    # 2. VALIDATE FILES EXIST
    if not all(p.exists() for p in [meta_path, scaler_path, state_path]):
        raise FileNotFoundError("Missing model artifacts")
    
    # 3. LOAD METADATA
    with open(meta_path, "r", encoding="utf-8") as f:
        self.meta = json.load(f)
    
    self.feature_cols = list(self.meta["feature_cols"])
    in_dim = int(self.meta.get("in_dim", len(self.feature_cols)))
    hidden = int(self.meta["hidden"])
    num_layers = int(self.meta["num_layers"])
    bidirectional = bool(self.meta["bidirectional"])
    dropout = float(self.meta["dropout"])
    
    # 4. LOAD THRESHOLD (with env override)
    thr_env = os.environ.get("THR_OVERRIDE", "")
    self.thr = float(thr_env) if thr_env else float(self.meta.get("thr", 0.5))
    
    # 5. INITIALIZE ARCHITECTURE
    self.model = GRUHead(
        in_dim=in_dim,
        hidden=hidden,
        num_layers=num_layers,
        bidirectional=bidirectional,
        dropout=dropout,
    )
    
    # 6. LOAD WEIGHTS
    state = torch.load(state_path, map_location="cpu")
    self.model.load_state_dict(state)
    self.model.eval()  # Critical: inference mode
    
    # 7. LOAD SCALER
    self.scaler = joblib.load(scaler_path)
    
    # 8. MARK LOADED
    self._loaded = True
    return True
```

### Data Service Initialization (`data_service.py`)

```python
class DataService:
    def __init__(self, data_dir: Path, models_dir: Path):
        self.data_dir = data_dir
        self.models_dir = models_dir
        self._test_data: Optional[pd.DataFrame] = None
        self._meters: Optional[list[str]] = None
    
    def get_meters(self) -> list[str]:
        """Lazy load: scan CSV files on first call."""
        if self._meters is None:
            csv_files = list(self.data_dir.glob("*_with_leakages.csv"))
            self._meters = sorted([f.stem.replace("_with_leakages", "") for f in csv_files])
        return self._meters
    
    def _load_test_data(self) -> pd.DataFrame:
        """Lazy load: read parquet on first call."""
        if self._test_data is None:
            parquet_path = self.models_dir / "artifacts" / "test_agg.parquet"
            if not parquet_path.exists():
                raise FileNotFoundError(f"Test data not found: {parquet_path}")
            self._test_data = pd.read_parquet(parquet_path)
        return self._test_data
```

---

## ⚛️ Frontend Startup Details

### Vite Dev Server Initialization

```typescript
// 1. ENTRY POINT: src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)

// 2. ROOT COMPONENT: src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Predict } from './pages/Predict'
import { Performance } from './pages/Performance'
import { DataExplorer } from './pages/DataExplorer'
import { Settings } from './pages/Settings'
import { Help } from './pages/Help'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/predict" element={<Predict />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/data" element={<DataExplorer />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

// 3. VITE CONFIG: vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

### Development Server Startup

```bash
# Command: npm run dev (in frontend/)
# Equivalent to: npx vite

# Startup sequence:
1. Read vite.config.ts
2. Initialize plugin: @vitejs/plugin-react
3. Set up alias resolution (@/* → src/*)
4. Configure proxy: /api/* → http://localhost:8000
5. Start dev server on port 3000
6. Initialize HMR (Hot Module Replacement)
7. TypeScript check (incremental)
8. CSS processing: Tailwind + PostCSS
9. Serve index.html with injected modules
10. WebSocket connection for HMR
```

---

## ✅ Startup Verification

### Health Checks

```bash
# 1. Backend Health
curl http://localhost:8000/api/v1/health
# Expected: {"status":"ok","model_loaded":true,"timestamp":"..."}

# 2. Model Loaded
curl http://localhost:8000/api/v1/model/info
# Expected: Full model metadata with metrics

# 3. Frontend Accessible
curl -I http://localhost:3000
# Expected: 200 OK, HTML content

# 4. API Proxy Working
curl http://localhost:3000/api/v1/health
# Expected: Same as backend (proxied via Vite)

# 5. Test Prediction
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{"windows": [[[0,0,0,0,0,0,0,0,0]] * 48]}'
# Expected: {"probs":[...],"preds":[...],"thr":0.68}
```

### Startup Logs

#### Backend (Terminal 1)
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
[Startup] Loading model...
[Startup] Model loaded successfully
[Startup] Initializing data service...
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

#### Frontend (Terminal 2)
```
  VITE v5.1.0  ready in 347 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.50:3000/
  ➜  press h + enter to show help

  LATEST VERSION: 5.1.0
  LOCAL PACKAGES: 312
```

---

## 🔧 Troubleshooting Startup

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Port 8000 in use | `Address already in use` | Kill existing process or change PORT in .env |
| Port 3000 in use | Vite shows different port | Vite auto-picks next port; update frontend proxy |
| Model not found | `Missing model artifacts` | Ensure models/gru_cls.pt exists |
| Module not found | `No module named 'backend'` | Run from project root, not backend/ |
| CORS error | Frontend can't call API | Check CORS origins in main.py |
| Proxy not working | 404 on /api/* from frontend | Check vite.config.ts proxy config |

### Manual Startup Commands

```bash
# Terminal 1: Backend
cd /path/to/piper
.venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd /path/to/piper/frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

---

## 📋 Quick Reference

| Step | Command | Output |
|------|---------|--------|
| 1. Create venv | `python -m venv .venv` | `.venv/` directory |
| 2. Activate venv | `.venv\Scripts\activate` | Prompt shows `(.venv)` |
| 3. Install backend | `pip install -r backend/requirements.txt` | Packages installed |
| 4. Install torch | `pip install torch --index-url https://download.pytorch.org/whl/cpu` | PyTorch CPU |
| 5. Install frontend | `cd frontend && npm install` | `node_modules/` |
| 6. Start backend | `uvicorn backend.main:app --reload` | http://localhost:8000 |
| 7. Start frontend | `npm run dev -- --port 3000` | http://localhost:3000 |
| 8. Verify | `curl localhost:8000/api/v1/health` | `{"status":"ok"}` |