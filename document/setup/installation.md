# Installation Guide

Complete step-by-step installation for PIPER Water Leakage Detection System.

## 📥 Option 1: Automated (Windows Only)

### Using `start_piper.bat`
```cmd
# 1. Clone repository
git clone https://github.com/ApoErch/Water-Leakage-Detection.git
cd Water-Leakage-Detection

# 2. Run startup script (does everything)
start_piper.bat
```

**What it does:**
1. Creates Python virtual environment (`.venv`)
2. Installs backend dependencies (`backend/requirements.txt`)
3. Installs frontend dependencies (`npm install` in `frontend/`)
4. Starts backend on `http://localhost:8000`
5. Starts frontend on `http://localhost:3000`

---

## 🔧 Option 2: Manual Installation

### Step 1: Clone Repository
```cmd
git clone https://github.com/ApoErch/Water-Leakage-Detection.git
cd Water-Leakage-Detection
```

### Step 2: Backend Setup

#### 2a. Create Virtual Environment
```cmd
# Windows
python -m venv .venv

# Linux/macOS
python3 -m venv .venv
```

#### 2b. Activate Virtual Environment
```cmd
# Windows (Command Prompt)
.venv\Scripts\activate.bat

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Linux/macOS
source .venv/bin/activate
```

#### 2c. Upgrade pip (Recommended)
```cmd
python -m pip install --upgrade pip
```

#### 2d. Install Backend Dependencies
```cmd
# Core dependencies
pip install "fastapi>=0.109,<1.0" "uvicorn>=0.27,<1.0" "pydantic>=2.5,<3.0" "python-dotenv>=1.0,<2.0" "numpy>=1.26,<2.0" "pandas>=2.0,<3.0" "scikit-learn>=1.3,<2.0" "joblib>=1.3,<2.0"

# PyTorch (CPU version)
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

**Alternative: Install from requirements file**
```cmd
pip install -r backend/requirements.txt
```

#### 2e. Verify Backend Installation
```cmd
python -c "import fastapi, uvicorn, pydantic, numpy, pandas, sklearn, joblib, torch; print('All backend deps OK')"
```

### Step 3: Frontend Setup

```cmd
cd frontend
npm install
```

#### Verify Frontend Installation
```cmd
npm run build
# Should complete without errors
```

---

## 🐳 Option 3: Docker Installation (Optional)

### Backend Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile (Multi-stage)
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Build and Run
```cmd
# Backend
docker build -f Dockerfile.backend -t piper-backend .
docker run -p 8000:8000 piper-backend

# Frontend
docker build -f Dockerfile.frontend -t piper-frontend .
docker run -p 3000:80 piper-frontend
```

---

## ✅ Post-Installation Verification

### 1. Start Backend
```cmd
.venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start Frontend (New Terminal)
```cmd
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

### 3. Verify Services
| Service | URL | Expected Response |
|---------|-----|-------------------|
| Backend Health | http://localhost:8000/api/v1/health | `{"status":"ok"}` |
| API Docs | http://localhost:8000/docs | Swagger UI loads |
| Frontend | http://localhost:3000 | Dashboard loads |
| Model Info | http://localhost:8000/api/v1/model/info | Model metadata JSON |

---

## 🔄 Reinstalling Dependencies

### Backend
```cmd
.venv\Scripts\activate
pip install --upgrade -r backend/requirements.txt
# Or force reinstall
pip install --force-reinstall -r backend/requirements.txt
```

### Frontend
```cmd
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Clean Everything
```cmd
# Remove venv
rmdir /s .venv

# Remove node_modules
cd frontend && rmdir /s node_modules

# Re-run installation
```

---

## 📝 Installation Logs

Check these files for troubleshooting:
- Backend install log: Check terminal output during `pip install`
- Frontend install log: Check terminal output during `npm install`
- Windows Event Viewer: For system-level issues

---

## 🆘 Common Installation Issues

| Issue | Solution |
|-------|----------|
| `pip install` fails on PyTorch | Use `--index-url https://download.pytorch.org/whl/cpu` |
| `npm install` permission errors | Run as administrator or fix npm permissions |
| Port 8000/3000 in use | Kill existing processes or change ports in `.env` |
| Model not found warning | Ensure `models/gru_cls.pt` exists (included in repo) |

See [Troubleshooting](troubleshooting.md) for more details.