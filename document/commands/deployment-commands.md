# Deployment Commands Reference

Complete command reference for deploying PIPER to production environments.

## 🐳 Docker Deployment

### Build Images

#### Backend
```cmd
# From project root
docker build -f Dockerfile.backend -t piper-backend:latest .
docker build -f Dockerfile.backend -t piper-backend:v1.0.0 .

# Multi-arch (for ARM servers)
docker buildx build --platform linux/amd64,linux/arm64 -f Dockerfile.backend -t piper-backend:latest --push .
```

#### Frontend
```cmd
docker build -f Dockerfile.frontend -t piper-frontend:latest .
docker build -f Dockerfile.frontend -t piper-frontend:v1.0.0 .
```

### Run Containers

#### Development (with hot reload)
```cmd
# Backend
docker run -d \
  --name piper-backend-dev \
  -p 8000:8000 \
  -v %cd%:/app \
  -v /app/.venv \
  --env-file .env \
  piper-backend:latest \
  uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
docker run -d \
  --name piper-frontend-dev \
  -p 3000:5173 \
  -v %cd%/frontend:/app \
  -v /app/node_modules \
  piper-frontend:latest \
  npm run dev -- --host 0.0.0.0 --port 5173
```

#### Production
```cmd
# Backend
docker run -d \
  --name piper-backend \
  -p 8000:8000 \
  --restart unless-stopped \
  --env-file .env.production \
  -v %cd%/models:/app/models:ro \
  -v %cd%/LeakageData:/app/LeakageData:ro \
  piper-backend:latest

# Frontend (nginx)
docker run -d \
  --name piper-frontend \
  -p 80:80 \
  --restart unless-stopped \
  piper-frontend:latest
```

### Docker Compose

#### docker-compose.yml
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
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  # Optional: Redis for caching
  # redis:
  #   image: redis:7-alpine
  #   ports:
  #     - "6379:6379"
```

#### Deploy with Compose
```cmd
# Development
docker-compose up -d

# Production (with override)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop
docker-compose down

# Update
docker-compose pull && docker-compose up -d
```

---

## ☁️ Cloud Deployment

### AWS Elastic Beanstalk

#### Backend
```cmd
# Install EB CLI
pip install awsebcli

# Initialize
eb init piper-backend --platform python-3.11 --region us-east-1

# Create environment
eb create piper-prod --instance-type t3.medium --envvars MODELS_DIR=/app/models,THR_OVERRIDE=0.68

# Deploy
eb deploy

# Scale
eb scale 3
```

#### Frontend (Amplify / S3 + CloudFront)
```cmd
# Build
cd frontend && npm run build

# Deploy to S3
aws s3 sync dist/ s3://piper-frontend-bucket --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

### AWS ECS (Fargate)

#### Task Definition (backend)
```json
{
  "family": "piper-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/piper-backend:latest",
      "portMappings": [{"containerPort": 8000, "protocol": "tcp"}],
      "environment": [
        {"name": "MODELS_DIR", "value": "/app/models"},
        {"name": "THR_OVERRIDE", "value": "0.68"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/piper-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/api/v1/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### Google Cloud Run

```cmd
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/piper-backend .
gcloud builds submit --tag gcr.io/PROJECT_ID/piper-frontend .

# Deploy
gcloud run deploy piper-backend --image gcr.io/PROJECT_ID/piper-backend --platform managed --region us-central1 --allow-unauthenticated --port 8000 --memory 1Gi --cpu 1

gcloud run deploy piper-frontend --image gcr.io/PROJECT_ID/piper-frontend --platform managed --region us-central1 --allow-unauthenticated --port 80
```

### Azure Container Instances

```cmd
# Backend
az container create \
  --resource-group piper-rg \
  --name piper-backend \
  --image piper-backend:latest \
  --ports 8000 \
  --environment-variables MODELS_DIR=/app/models THR_OVERRIDE=0.68 \
  --cpu 1 --memory 1.5

# Frontend
az container create \
  --resource-group piper-rg \
  --name piper-frontend \
  --image piper-frontend:latest \
  --ports 80 \
  --cpu 0.5 --memory 1
```

---

## 🔧 Kubernetes Deployment

### Namespace
```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: piper
```

### Backend Deployment
```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: piper-backend
  namespace: piper
spec:
  replicas: 3
  selector:
    matchLabels:
      app: piper-backend
  template:
    metadata:
      labels:
        app: piper-backend
    spec:
      containers:
      - name: backend
        image: piper-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: MODELS_DIR
          value: "/app/models"
        - name: THR_OVERRIDE
          value: "0.68"
        - name: HOST
          value: "0.0.0.0"
        - name: PORT
          value: "8000"
        volumeMounts:
        - name: models
          mountPath: /app/models
          readOnly: true
        - name: data
          mountPath: /app/LeakageData
          readOnly: true
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/v1/model/info
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: piper-models-pvc
      - name: data
        persistentVolumeClaim:
          claimName: piper-data-pvc
```

### Backend Service
```yaml
# backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: piper-backend
  namespace: piper
spec:
  selector:
    app: piper-backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### Frontend Deployment
```yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: piper-frontend
  namespace: piper
spec:
  replicas: 2
  selector:
    matchLabels:
      app: piper-frontend
  template:
    metadata:
      labels:
        app: piper-frontend
    spec:
      containers:
      - name: frontend
        image: piper-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

### Ingress
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: piper-ingress
  namespace: piper
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: piper.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: piper-backend
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: piper-frontend
            port:
              number: 80
```

### Apply to Kubernetes
```cmd
kubectl apply -f namespace.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f ingress.yaml

# Check status
kubectl get pods -n piper
kubectl get svc -n piper
kubectl logs -n piper -l app=piper-backend -f
```

---

## 🚀 CI/CD Pipelines

### GitHub Actions (`.github/workflows/deploy.yml`)
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.11'

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Build Backend Image
      run: |
        docker build -f Dockerfile.backend -t ${{ secrets.DOCKER_REGISTRY }}/piper-backend:${{ github.sha }} .
        docker push ${{ secrets.DOCKER_REGISTRY }}/piper-backend:${{ github.sha }}

    - name: Build Frontend Image
      run: |
        docker build -f Dockerfile.frontend -t ${{ secrets.DOCKER_REGISTRY }}/piper-frontend:${{ github.sha }} .
        docker push ${{ secrets.DOCKER_REGISTRY }}/piper-frontend:${{ github.sha }}

    - name: Deploy to Kubernetes
      uses: azure/k8s-set-context@v1
      with:
        kubeconfig: ${{ secrets.KUBECONFIG }}
      run: |
        kubectl set image deployment/piper-backend backend=${{ secrets.DOCKER_REGISTRY }}/piper-backend:${{ github.sha }} -n piper
        kubectl set image deployment/piper-frontend frontend=${{ secrets.DOCKER_REGISTRY }}/piper-frontend:${{ github.sha }} -n piper
```

### GitLab CI (`.gitlab-ci.yml`)
```yaml
stages:
  - build
  - test
  - deploy

variables:
  DOCKER_REGISTRY: registry.example.com/piper

build_backend:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -f Dockerfile.backend -t $DOCKER_REGISTRY/backend:$CI_COMMIT_SHA .
    - docker push $DOCKER_REGISTRY/backend:$CI_COMMIT_SHA

build_frontend:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -f Dockerfile.frontend -t $DOCKER_REGISTRY/frontend:$CI_COMMIT_SHA .
    - docker push $DOCKER_REGISTRY/frontend:$CI_COMMIT_SHA

deploy_staging:
  stage: deploy
  script:
    - kubectl set image deployment/piper-backend backend=$DOCKER_REGISTRY/backend:$CI_COMMIT_SHA -n piper-staging
    - kubectl set image deployment/piper-frontend frontend=$DOCKER_REGISTRY/frontend:$CI_COMMIT_SHA -n piper-staging
  environment:
    name: staging
    url: https://staging.piper.example.com
  only:
    - develop

deploy_prod:
  stage: deploy
  script:
    - kubectl set image deployment/piper-backend backend=$DOCKER_REGISTRY/backend:$CI_COMMIT_SHA -n piper
    - kubectl set image deployment/piper-frontend frontend=$DOCKER_REGISTRY/frontend:$CI_COMMIT_SHA -n piper
  environment:
    name: production
    url: https://piper.example.com
  only:
    - main
  when: manual
```

---

## 🔒 SSL/TLS Configuration

### Let's Encrypt (Certbot + Nginx)
```cmd
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d piper.example.com -d api.piper.example.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Nginx Reverse Proxy Config
```nginx
# /etc/nginx/sites-available/piper
server {
    listen 80;
    server_name piper.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name piper.example.com;

    ssl_certificate /etc/letsencrypt/live/piper.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/piper.example.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📊 Monitoring & Logging

### Prometheus + Grafana
```yaml
# prometheus.yml scrape config
scrape_configs:
  - job_name: 'piper-backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  - job_name: 'piper-frontend'
    static_configs:
      - targets: ['frontend:80']
```

### Log Aggregation (ELK / Loki)
```yaml
# docker-compose logging
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 🔄 Backup & Restore

### Model Artifacts Backup
```cmd
# Backup
tar -czf piper-models-backup-$(date +%Y%m%d).tar.gz models/

# Restore
tar -xzf piper-models-backup-20240115.tar.gz
```

### Database Backup (if using)
```cmd
# PostgreSQL
pg_dump -h localhost -U piper piper_db > piper_db_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U piper piper_db < piper_db_20240115.sql
```

---

## 📋 Quick Reference Card

| Task | Command |
|------|---------|
| Build backend image | `docker build -f Dockerfile.backend -t piper-backend .` |
| Build frontend image | `docker build -f Dockerfile.frontend -t piper-frontend .` |
| Run compose (dev) | `docker-compose up -d` |
| Run compose (prod) | `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |
| Deploy to K8s | `kubectl apply -f k8s/` |
| Update K8s image | `kubectl set image deployment/piper-backend backend=piper-backend:v1.0.1 -n piper` |
| Check K8s pods | `kubectl get pods -n piper` |
| View K8s logs | `kubectl logs -n piper -l app=piper-backend -f` |
| SSL cert (Let's Encrypt) | `certbot --nginx -d piper.example.com` |
| Backup models | `tar -czf models-backup.tar.gz models/` |