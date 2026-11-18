# Troubleshooting Guide

Common issues and solutions for PIPER Water Leakage Detection System.

## 🚨 Quick Diagnostics

### Check System Status
```cmd
# Backend health
curl http://localhost:8000/api/v1/health

# Model loaded?
curl http://localhost:8000/api/v1/model/info

# Frontend accessible?
curl -I http://localhost:3000
```

---

## 🐍 Backend Issues

### 1. Virtual Environment Issues

| Error | Solution |
|-------|----------|
| `No module named 'venv'` | Install: `sudo apt-get install python3-venv` (Ubuntu) |
| `activate.bat not found` | Recreate: `python -m venv .venv` |
| `Permission denied` on activate | Run terminal as Administrator (Windows) |

### 2. Dependency Installation Failures

#### PyTorch Installation Fails
```cmd
# Error: Could not find a version that satisfies the requirement torch
# Solution: Use explicit index URL
pip install torch --index-url https://download.pytorch.org/whl/cpu

# Or upgrade pip first
python -m pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

#### FastAPI/Pydantic Version Conflicts
```cmd
# Error: Cannot install fastapi>=0.109,<1.0 and pydantic>=2.5,<3.0
# Solution: Install in order, let pip resolve
pip install "pydantic>=2.5,<3.0" "fastapi>=0.109,<1.0"
```

#### NumPy/Pandas Binary Wheel Issues (Windows)
```cmd
# Error: Microsoft Visual C++ 14.0+ required
# Solution: Install Visual Studio Build Tools
# Or use pre-built wheels (default in pip 23+)
pip install --only-binary :all: numpy pandas
```

### 3. Model Loading Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `FileNotFoundError: gru_cls.pt` | Model files missing | Check `models/` directory exists with all 3 files |
| `RuntimeError: size mismatch` | Architecture mismatch | Ensure `gru_cls_meta.json` matches `.pt` weights |
| `ModuleNotFoundError: torch` | PyTorch not installed | `pip install torch --index-url https://download.pytorch.org/whl/cpu` |
| `KeyError: 'hidden'` in meta | Corrupted meta.json | Re-download or retrain model |

#### Verify Model Artifacts
```cmd
.venv\Scripts\activate
python -c "
from pathlib import Path
models = Path('models')
for f in ['gru_cls.pt', 'gru_cls_scaler.joblib', 'gru_cls_meta.json', 'gru_cls_thr.txt']:
    p = models / f
    print(f'{f}: {\"EXISTS\" if p.exists() else \"MISSING\"} ({p.stat().st_size if p.exists() else 0} bytes)')
"
```

### 4. Server Startup Issues

#### Port Already in Use
```cmd
# Windows: Find and kill process
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :8000
kill -9 <PID>

# Or change port in .env
PORT=8001
```

#### Import Errors on Startup
```cmd
# Error: ModuleNotFoundError: No module named 'backend'
# Solution: Run from project root, not backend/
cd /path/to/piper
.venv\Scripts\activate
python -m uvicorn backend.main:app --reload
```

#### CORS Errors (Frontend → Backend)
```python
# backend/main.py - Check CORS middleware allows frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 5. Runtime Errors

#### Prediction Fails: Feature Count Mismatch
```json
// Error: "Feature count mismatch: got F=8, expected 9"
// Cause: Client sending wrong number of features
// Fix: Ensure feature_cols matches exactly 9 features in order
```

#### Prediction Fails: NaN Values
```python
# Check input data for NaN
import numpy as np
X = np.array(windows)
print(np.isnan(X).sum())  # Should be 0
```

---

## 🌐 Frontend Issues

### 1. Node.js Version Issues

| Error | Solution |
|-------|----------|
| `error:0308010C:digital envelope routines::unsupported` | Node.js 17+ with OpenSSL 3; use `NODE_OPTIONS=--openssl-legacy-provider` or upgrade Node |
| `Vite requires Node.js 18+` | Install Node.js 18+ LTS |

### 2. Dependency Installation

```cmd
# Clean install
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# If peer dependency errors
npm install --legacy-peer-deps

# If ESBuild fails (Windows)
npm install --ignore-scripts
# Then manually: npx esbuild --version
```

### 3. Build Errors

| Error | Solution |
|-------|----------|
| `TypeScript error: Cannot find module` | Run `npm install` to generate types |
| `Tailwind classes not applying` | Check `tailwind.config.js` content paths |
| `ESLint errors on build` | Run `npm run lint` to see details |

### 4. Dev Server Issues

#### Port 3000 in Use
```cmd
# Vite will auto-prompt to use another port
# Or explicitly set:
npm run dev -- --port 3001
```

#### HMR Not Working
```cmd
# Check firewall/antivirus
# Try explicit host:
npm run dev -- --host 127.0.0.1
```

#### API Calls Failing (CORS/Network)
```cmd
# Check .env.local in frontend/
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local
# Restart dev server
```

---

## 📊 Data Issues

### 1. Missing Data Files

| File | Location | Required? |
|------|----------|-----------|
| `gru_cls.pt` | `models/` | Yes |
| `gru_cls_scaler.joblib` | `models/` | Yes |
| `gru_cls_meta.json` | `models/` | Yes |
| `test_agg.parquet` | `models/artifacts/` | For batch prediction |
| CSV files | `LeakageData/` | For data explorer |

### 2. Data Loading Errors

```python
# Check parquet file
import pandas as pd
df = pd.read_parquet('models/artifacts/test_agg.parquet')
print(df.shape, df.columns.tolist())

# Check CSV files
import glob
for f in glob.glob('LeakageData/*.csv'):
    df = pd.read_csv(f)
    print(f, df.shape)
```

---

## 🐳 Docker Issues

| Error | Solution |
|-------|----------|
| `docker: command not found` | Install Docker Desktop |
| `Permission denied` (Linux) | `sudo usermod -aG docker $USER` then relogin |
| `Port binding failed` | Check host ports free: `docker ps` |
| `Model files not found in container` | Check volume mounts in docker-compose.yml |

---

## 🔧 Performance Issues

### Backend Slow
```cmd
# Check CPU/memory
# Windows: Task Manager
# Linux: htop

# Enable profiling
# Add to backend/main.py temporarily:
# import cProfile, pstats
# profiler = cProfile.Profile()
# profiler.enable()
# ... after request ...
# profiler.disable()
# profiler.print_stats(sort='cumulative')
```

### Frontend Slow
```cmd
# Check bundle size
cd frontend
npm run build
# Check dist/ size

# Analyze bundle
npx vite-bundle-analyzer
```

---

## 📝 Log Locations

| Component | Log Location |
|-----------|--------------|
| Backend (dev) | Terminal stdout |
| Backend (prod) | `logs/piper.log` (if configured) |
| Frontend (dev) | Browser DevTools Console |
| Frontend (prod) | Nginx access/error logs |
| Docker | `docker logs <container>` |

---

## 🆘 Getting Help

1. **Check this guide** for your error
2. **Search existing issues**: https://github.com/ApoErch/Water-Leakage-Detection/issues
3. **Create new issue** with:
   - OS, Python, Node versions
   - Full error traceback
   - Steps to reproduce
   - Output of diagnostics commands above

---

## ✅ Health Check Commands

```cmd
# Full system check
.venv\Scripts\activate
python -c "
import sys, torch, fastapi, uvicorn, numpy, pandas, sklearn, joblib
print(f'Python: {sys.version.split()[0]}')
print(f'PyTorch: {torch.__version__}')
print(f'FastAPI: {fastapi.__version__}')
print(f'NumPy: {numpy.__version__}')
print(f'Pandas: {pandas.__version__}')
print(f'Sklearn: {sklearn.__version__}')
print('All OK!')
"

# Model load test
python -c "
from backend.model_loader import load_model
ok = load_model()
print(f'Model loaded: {ok}')
"

# Frontend build test
cd frontend && npm run build && echo 'Build OK'
```