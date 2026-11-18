# Backend Commands Reference

Complete command reference for the PIPER FastAPI backend server.

## 🚀 Server Management

### Start Development Server (Auto-reload)
```cmd
# From project root, with venv activated
.venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Short form
uvicorn backend.main:app --reload
```

### Start Production Server
```cmd
# Single process (development/production)
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Multiple workers (production)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4

# Using Gunicorn (recommended for production)
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Windows Service (NSSM)
```cmd
# Install as Windows service
nssm install PIPER-Backend
# Path: C:\path\to\.venv\Scripts\python.exe
# Arguments: -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
# Startup directory: C:\path\to\piper
```

---

## 📡 API Testing Commands

### Health Check
```cmd
# Basic health
curl http://localhost:8000/api/v1/health

# Verbose
curl -v http://localhost:8000/api/v1/health
```

### Model Information
```cmd
# Get model metadata
curl http://localhost:8000/api/v1/model/info

# Pretty print
curl -s http://localhost:8000/api/v1/model/info | python -m json.tool
```

### Single Prediction
```cmd
# Minimal request (uses defaults)
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{"windows": [[[1,2,3,4,5,6,7,8,9]] * 48]}'

# Full request with all parameters
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{
    "windows": [[[1,2,3,4,5,6,7,8,9]] * 48],
    "feature_cols": ["Hour","DayOfWeek","Month","roll6_mean","roll24_mean","roll6_std","roll24_std","rel_to_roll24","Delta_Volume"],
    "thr": 0.68
  }'

# Using JSON file
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d @sample_request.json
```

### Batch Prediction
```cmd
# Run on full test set
curl -X POST http://localhost:8000/api/v1/predict/batch \
  -H "Content-Type: application/json" \
  -d '{}'

# With custom threshold
curl -X POST http://localhost:8000/api/v1/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"thr": 0.5}'
```

### List Meters
```cmd
curl http://localhost:8000/api/v1/meters
```

### Get Sample Test Windows
```cmd
# Default (10 samples)
curl http://localhost:8000/api/v1/data/sample

# Custom count
curl "http://localhost:8000/api/v1/data/sample?n=5"

# Specific meter
curl "http://localhost:8000/api/v1/data/sample?meter_id=1000647"
```

---

## 🔧 Development Commands

### Run with Custom Config
```cmd
# Custom host/port
uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload

# Custom log level
uvicorn backend.main:app --log-level debug --reload

# Custom app factory (if using)
uvicorn "backend.main:create_app" --reload
```

### Debug Mode
```cmd
# Enable debug endpoint (if implemented)
# Set in .env: DEBUG=true
uvicorn backend.main:app --reload --log-level debug
```

### Profile Performance
```cmd
# Using py-spy (install: pip install py-spy)
py-spy record -o profile.svg -- python -m uvicorn backend.main:app --port 8000

# Using cProfile
python -m cProfile -o profile.stats -m uvicorn backend.main:app --port 8000
# Analyze: python -c "import pstats; p=pstats.Stats('profile.stats'); p.sort_stats('cumulative').print_stats(20)"
```

---

## 📦 Dependency Management

### Install Dependencies
```cmd
# From requirements.txt
pip install -r backend/requirements.txt

# With specific versions
pip install "fastapi>=0.109,<1.0" "uvicorn>=0.27,<1.0" "pydantic>=2.5,<3.0" "python-dotenv>=1.0,<2.0" "numpy>=1.26,<2.0" "pandas>=2.0,<3.0" "scikit-learn>=1.3,<2.0" "joblib>=1.3,<2.0" torch --index-url https://download.pytorch.org/whl/cpu

# Upgrade all
pip install --upgrade -r backend/requirements.txt

# Force reinstall
pip install --force-reinstall -r backend/requirements.txt
```

### Export Current Environment
```cmd
# Freeze requirements
pip freeze > backend/requirements-full.txt

# Only project deps (exclude transitive)
pip list --local --format=freeze > backend/requirements-project.txt
```

### Check for Updates
```cmd
# List outdated
pip list --outdated

# Check specific package
pip index versions fastapi
```

---

## 🧪 Testing Commands

### Run Unit Tests
```cmd
# If tests exist
pytest backend/tests/ -v

# With coverage
pytest backend/tests/ --cov=backend --cov-report=html
```

### Linting / Type Checking
```cmd
# Ruff (fast linter)
ruff check backend/
ruff format backend/

# MyPy (type checking)
mypy backend/

# PyLint
pylint backend/
```

---

## 🐳 Docker Commands

### Build Image
```cmd
# From project root
docker build -f Dockerfile.backend -t piper-backend .

# With build args
docker build -f Dockerfile.backend --build-arg PYTHON_VERSION=3.11 -t piper-backend .
```

### Run Container
```cmd
# Basic
docker run -p 8000:8000 piper-backend

# With volumes (live reload)
docker run -p 8000:8000 -v %cd%:/app piper-backend

# With environment file
docker run -p 8000:8000 --env-file .env piper-backend

# Detached
docker run -d -p 8000:8000 --name piper-backend piper-backend
```

### Manage Containers
```cmd
# List
docker ps -a

# Logs
docker logs piper-backend
docker logs -f piper-backend  # follow

# Stop/Start
docker stop piper-backend
docker start piper-backend

# Remove
docker rm piper-backend

# Exec into container
docker exec -it piper-backend bash
```

---

## 📊 Monitoring Commands

### Check Process
```cmd
# Windows
tasklist | findstr uvicorn
netstat -ano | findstr :8000

# Linux/macOS
ps aux | grep uvicorn
lsof -i :8000
```

### Resource Usage
```cmd
# Windows (PowerShell)
Get-Process python | Select-Object Id, ProcessName, CPU, WS, PM

# Linux
htop -p $(pgrep -f uvicorn)
```

### API Metrics (if Prometheus enabled)
```cmd
# Metrics endpoint
curl http://localhost:8000/metrics
```

---

## 🔄 Database / Migrations (if using Alembic)

```cmd
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1

# Current version
alembic current

# History
alembic history
```

---

## 🛠️ Utility Scripts

### Model Verification
```cmd
.venv\Scripts\activate
python -c "
from backend.model_loader import load_model, get_model_loader
ok = load_model()
loader = get_model_loader()
info = loader.get_model_info()
print(f'Loaded: {ok}')
print(f'Model: {info.model}')
print(f'Window: {info.window}')
print(f'Features: {len(info.feature_cols)}')
print(f'Threshold: {info.thr}')
"
```

### Data Verification
```cmd
.venv\Scripts\activate
python -c "
import pandas as pd
from pathlib import Path

# Check model artifacts
for f in ['gru_cls.pt', 'gru_cls_scaler.joblib', 'gru_cls_meta.json']:
    p = Path('models') / f
    print(f'{f}: {\"OK\" if p.exists() else \"MISSING\"}')

# Check data
print(f'LeakageData CSVs: {len(list(Path(\"LeakageData\").glob(\"*.csv\")))}')
print(f'Test artifacts: {Path(\"models/artifacts/test_agg.parquet\").exists()}')
"
```

---

## 📋 Quick Reference Card

| Task | Command |
|------|---------|
| Start dev server | `uvicorn backend.main:app --reload` |
| Start prod (4 workers) | `uvicorn backend.main:app --workers 4` |
| Health check | `curl localhost:8000/api/v1/health` |
| Model info | `curl localhost:8000/api/v1/model/info` |
| Predict (single) | `curl -X POST localhost:8000/api/v1/predict -d @req.json` |
| Predict (batch) | `curl -X POST localhost:8000/api/v1/predict/batch` |
| List meters | `curl localhost:8000/api/v1/meters` |
| Install deps | `pip install -r backend/requirements.txt` |
| Run tests | `pytest backend/tests/` |
| Docker build | `docker build -f Dockerfile.backend -t piper-backend .` |
| Docker run | `docker run -p 8000:8000 piper-backend` |