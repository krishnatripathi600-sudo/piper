# Utility Commands Reference

Maintenance, debugging, and utility commands for PIPER.

## 🧹 Cleanup Commands

### Python Cache Cleanup
```cmd
# Remove __pycache__ directories
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# Windows PowerShell
Get-ChildItem -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

# Remove .pyc files
find . -name "*.pyc" -delete

# Remove pytest cache
find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null

# Remove mypy cache
find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null

# Remove ruff cache
find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null
```

### Frontend Cache Cleanup
```cmd
cd frontend

# Vite cache
rm -rf node_modules/.vite

# TypeScript cache
rm -rf node_modules/.cache

# ESLint cache
rm -f .eslintcache

# Build output
rm -rf dist

# Package lock (will regenerate)
rm -f package-lock.json
```

### Docker Cleanup
```cmd
# Remove stopped containers
docker container prune -f

# Remove unused images
docker image prune -f

# Remove unused volumes
docker volume prune -f

# Remove unused networks
docker network prune -f

# Full system prune (careful!)
docker system prune -a -f --volumes

# Remove specific project containers
docker rm -f $(docker ps -aq --filter "name=piper")
```

### Complete Project Clean
```cmd
# Clean everything (run from project root)
rm -rf .venv
rm -rf frontend/node_modules
rm -rf frontend/dist
rm -rf frontend/.vite
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -name "*.pyc" -delete
docker system prune -f
```

---

## 🔍 Debugging Commands

### Backend Debugging

#### Inspect Model Loading
```cmd
.venv\Scripts\activate
python -c "
from backend.model_loader import load_model, get_model_loader
import traceback

try:
    ok = load_model()
    print(f'Load result: {ok}')
    if ok:
        loader = get_model_loader()
        info = loader.get_model_info()
        print(f'Model: {info.model}')
        print(f'Window: {info.window}')
        print(f'Features: {info.feature_cols}')
        print(f'Threshold: {info.thr}')
        print(f'Metrics: {info.metrics}')
except Exception as e:
    traceback.print_exc()
"
```

#### Test Prediction Directly
```cmd
.venv\Scripts\activate
python -c "
import numpy as np
from backend.model_loader import load_model, get_model_loader

load_model()
loader = get_model_loader()

# Create dummy input matching feature count
B, W, F = 1, 48, 9
X = np.random.randn(B, W, F).astype(np.float32)

probs, preds, thr = loader.predict(X)
print(f'Input shape: {X.shape}')
print(f'Probability: {probs}')
print(f'Prediction: {preds}')
print(f'Threshold used: {thr}')
"
```

#### Profile API Endpoint
```cmd
# Install: pip install py-spy
# Run backend, then in another terminal:
py-spy record -o profile.svg --pid $(pgrep -f "uvicorn backend.main:app")

# Or profile specific request
py-spy top --pid $(pgrep -f "uvicorn backend.main:app")
```

#### Check Memory Usage
```cmd
.venv\Scripts\activate
python -c "
import tracemalloc
tracemalloc.start()

from backend.model_loader import load_model, get_model_loader
import numpy as np

load_model()
loader = get_model_loader()
X = np.random.randn(10, 48, 9).astype(np.float32)
probs, preds, thr = loader.predict(X)

current, peak = tracemalloc.get_traced_memory()
print(f'Current memory: {current / 1024 / 1024:.1f} MB')
print(f'Peak memory: {peak / 1024 / 1024:.1f} MB')
tracemalloc.stop()
"
```

### Frontend Debugging

#### Check Bundle Size
```cmd
cd frontend
npm run build
ls -la dist/assets/
# Look for large .js/.css files
```

#### Analyze Dependencies
```cmd
cd frontend
npx npm-check-updates
npx depcheck
```

#### Check TypeScript Errors
```cmd
cd frontend
npx tsc --noEmit --pretty
```

---

## 📊 Data Utilities

### Inspect Data Files
```cmd
.venv\Scripts\activate
python -c "
import pandas as pd
from pathlib import Path

# LeakageData CSVs
data_dir = Path('LeakageData')
csv_files = list(data_dir.glob('*.csv'))
print(f'Found {len(csv_files)} CSV files')

for f in csv_files[:3]:
    df = pd.read_csv(f)
    print(f'\n{f.name}:')
    print(f'  Shape: {df.shape}')
    print(f'  Columns: {df.columns.tolist()}')
    print(f'  Dtypes:\n{df.dtypes}')
    print(f'  Head:\n{df.head()}')
    print(f'  Nulls: {df.isnull().sum().sum()}')
"
```

### Inspect Test Artifacts
```cmd
.venv\Scripts\activate
python -c "
import pandas as pd
from pathlib import Path

# Test aggregated data
p = Path('models/artifacts/test_agg.parquet')
if p.exists():
    df = pd.read_parquet(p)
    print(f'Shape: {df.shape}')
    print(f'Columns: {df.columns.tolist()}')
    print(f'Dtypes:\n{df.dtypes}')
    print(f'Memory: {df.memory_usage(deep=True).sum() / 1024 / 1024:.1f} MB')
    print(f'Head:\n{df.head()}')
    print(f'Describe:\n{df.describe()}')
else:
    print('test_agg.parquet not found')
"
```

### Generate Sample Data
```cmd
.venv\Scripts\activate
python -c "
import numpy as np
import json

# Generate sample prediction request
np.random.seed(42)
B, W, F = 3, 48, 9
windows = np.random.randn(B, W, F).tolist()

request = {
    'windows': windows,
    'feature_cols': ['Hour','DayOfWeek','Month','roll6_mean','roll24_mean','roll6_std','roll24_std','rel_to_roll24','Delta_Volume'],
    'thr': 0.68
}

with open('sample_request.json', 'w') as f:
    json.dump(request, f, indent=2)

print('Created sample_request.json')
print(json.dumps(request, indent=2)[:500] + '...')
"
```

---

## 🔧 System Utilities

### Port Management
```cmd
# Check port usage
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# Linux/macOS
lsof -i :8000
lsof -i :3000

# Kill process on port
# Windows
taskkill /PID <PID> /F

# Linux/macOS
kill -9 <PID>
```

### Process Management
```cmd
# Find Python processes
# Windows
tasklist | findstr python

# Linux/macOS
ps aux | grep python

# Find Node processes
# Windows
tasklist | findstr node

# Linux/macOS
ps aux | grep node
```

### Disk Usage
```cmd
# Project size
# Windows PowerShell
Get-ChildItem -Recurse | Measure-Object -Property Length -Sum | ForEach-Object { "Total: {0:N2} MB" -f ($_.Sum / 1MB) }

# Linux/macOS
du -sh .
du -sh .venv frontend/node_modules models LeakageData

# Find large files
find . -type f -size +100M -exec ls -lh {} \;
```

---

## 📝 Log Management

### View Logs
```cmd
# Backend (if running in background)
# Windows: Check the command window titled "PIPER Backend"
# Linux/macOS: Check terminal or use nohup

# Docker
docker logs piper-backend -f
docker logs piper-frontend -f

# Systemd (if configured)
journalctl -u piper-backend -f
journalctl -u piper-frontend -f
```

### Rotate Logs
```cmd
# Linux logrotate config (/etc/logrotate.d/piper)
/var/log/piper/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 piper piper
}
```

---

## 🔐 Security Utilities

### Check for Vulnerabilities
```cmd
# Backend
.venv\Scripts\activate
pip-audit
# Or: pip install pip-audit && pip-audit

# Frontend
cd frontend
npm audit
npm audit fix
```

### Check Secrets in Code
```cmd
# Install: pip install detect-secrets
detect-secrets scan --all-files

# Or use truffleHog
trufflehog filesystem .
```

### Generate Secure Keys
```cmd
# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# OpenSSL
openssl rand -base64 32
```

---

## 📋 Quick Reference Card

| Task | Command |
|------|---------|
| Clean Python cache | `find . -name "__pycache__" -exec rm -rf {} +` |
| Clean frontend cache | `cd frontend && rm -rf node_modules/.vite dist .eslintcache` |
| Clean Docker | `docker system prune -a -f --volumes` |
| Full project clean | `rm -rf .venv frontend/node_modules frontend/dist` |
| Test model load | `python -c "from backend.model_loader import load_model; print(load_model())"` |
| Test prediction | `python -c "from backend.model_loader import load_model, get_model_loader; import numpy as np; load_model(); l=get_model_loader(); X=np.random.randn(1,48,9).astype(np.float32); print(l.predict(X))"` |
| Inspect data | `python -c "import pandas as pd; df=pd.read_parquet('models/artifacts/test_agg.parquet'); print(df.shape, df.columns.tolist())"` |
| Check ports | `netstat -ano \| findstr :8000` (Windows) / `lsof -i :8000` (Linux) |
| View Docker logs | `docker logs piper-backend -f` |
| Security audit (Python) | `pip-audit` |
| Security audit (Node) | `npm audit` |
| Disk usage | `du -sh .` (Linux) / `Get-ChildItem -Recurse \| Measure-Object -Property Length -Sum` (PowerShell) |