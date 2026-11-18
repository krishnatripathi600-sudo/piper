# Environment Configuration

Configuration via `.env` file and environment variables.

## 📄 `.env` File

Create `.env` in the project root (copy from `.env.example`):

```env
# ===========================================
# PIPER - Environment Configuration
# ===========================================

# Frontend API URL (Vite uses VITE_ prefix)
VITE_API_URL=http://localhost:8000/api/v1

# Backend Configuration
MODELS_DIR=../models
DATA_DIR=../LeakageData
THR_OVERRIDE=0.68
HOST=0.0.0.0
PORT=8000
FRONTEND_PORT=3000

# Optional: Logging
LOG_LEVEL=INFO
# LOG_FILE=logs/piper.log

# Optional: SageMaker / Cloud
# AWS_REGION=us-east-1
# SAGEMAKER_ENDPOINT_NAME=piper-gru-endpoint
```

## 🔧 Variable Reference

### Frontend Variables (Vite)
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

### Backend Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `MODELS_DIR` | `../models` | Path to model artifacts directory |
| `DATA_DIR` | `../LeakageData` | Path to raw CSV data directory |
| `THR_OVERRIDE` | `0.68` | Classification threshold override |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server port |
| `FRONTEND_PORT` | `3000` | Frontend dev server port (for CORS) |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |

## 🐳 Docker Environment

### docker-compose.yml
```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    environment:
      - MODELS_DIR=/app/models
      - DATA_DIR=/app/LeakageData
      - THR_OVERRIDE=0.68
      - HOST=0.0.0.0
      - PORT=8000
    volumes:
      - ./models:/app/models:ro
      - ./LeakageData:/app/LeakageData:ro

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=http://localhost:8000/api/v1
    depends_on:
      - backend
```

### Override with .env.docker
```env
# docker-compose.override.yml reads this
VITE_API_URL=http://backend:8000/api/v1
```

## 🔐 SageMaker / AWS Configuration

### Environment Variables for SageMaker Deployment
```env
AWS_REGION=us-east-1
SAGEMAKER_ROLE_ARN=arn:aws:iam::123456789012:role/SageMakerExecutionRole
SAGEMAKER_BUCKET=s3://my-piper-bucket
SAGEMAKER_ENDPOINT_NAME=piper-gru-prod
SAGEMAKER_INSTANCE_TYPE=ml.m5.xlarge
SAGEMAKER_INSTANCE_COUNT=1
```

### IAM Permissions Required
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sagemaker:*",
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "ecr:GetAuthorizationToken",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "cloudwatch:PutMetricData",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🖥️ Platform-Specific Notes

### Windows
- Use `.bat` files or PowerShell
- Path separators: `\` or `/` (both work in Python)
- Virtual env activation: `.venv\Scripts\activate.bat`

### Linux/macOS
- Use bash/zsh
- Path separators: `/`
- Virtual env activation: `source .venv/bin/activate`
- May need: `sudo apt-get install python3-venv` (Ubuntu)

### WSL2 (Windows Subsystem for Linux)
- Best of both worlds
- Use Linux commands, access Windows files via `/mnt/c/`
- Forward ports: `localhost` works directly

## 🔍 Verifying Configuration

### Check Current Environment
```cmd
# Backend
.venv\Scripts\activate
python -c "
import os
from pathlib import Path
print('MODELS_DIR:', os.environ.get('MODELS_DIR', 'NOT SET'))
print('DATA_DIR:', os.environ.get('DATA_DIR', 'NOT SET'))
print('THR_OVERRIDE:', os.environ.get('THR_OVERRIDE', 'NOT SET'))
print('Models exist:', Path('../models/gru_cls.pt').exists())
print('Data exists:', Path('../LeakageData').exists())
"
```

### Frontend Environment Check
```cmd
cd frontend
cat .env.local 2>/dev/null || echo "No .env.local found"
# Vite loads .env, .env.local, .env.[mode], .env.[mode].local
```

## 📋 Configuration Priority

1. **Highest**: System environment variables
2. **High**: `.env.local` (gitignored, machine-specific)
3. **Medium**: `.env.[mode]` (e.g., `.env.production`)
4. **Low**: `.env` (committed, shared defaults)
5. **Lowest**: Hardcoded defaults in code

## 🔄 Reloading Configuration

| Component | Reload Method |
|-----------|---------------|
| Backend (dev) | Auto-reload via `--reload` flag |
| Backend (prod) | Restart process |
| Frontend (dev) | Auto-HMR via Vite |
| Frontend (prod) | Rebuild + redeploy |

## 🚫 Security Notes

- **Never commit** `.env.local` or files with secrets
- **Use `.env.example`** as template for required variables
- **Rotate** `THR_OVERRIDE` only with model retraining
- **Restrict** `HOST=0.0.0.0` in production (use firewall/SG)