# Frontend Commands Reference

Complete command reference for the PIPER React + TypeScript + Vite frontend.

## 📦 Installation

### Initial Install
```cmd
cd frontend
npm install
```

### Clean Reinstall
```cmd
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Install Specific Package
```cmd
# Production dependency
npm install <package-name>

# Development dependency
npm install -D <package-name>

# Exact version
npm install <package-name>@1.2.3
```

---

## 🚀 Development Server

### Start Dev Server (Default)
```cmd
cd frontend
npm run dev
# Starts on http://localhost:5173 (Vite default)
```

### Start on Specific Port
```cmd
# Port 3000 (matches backend CORS config)
npm run dev -- --port 3000

# Explicit host (for network access)
npm run dev -- --host 127.0.0.1 --port 3000

# All interfaces (LAN access)
npm run dev -- --host 0.0.0.0 --port 3000
```

### Start with HTTPS (Local Certs)
```cmd
# Generate certs first: mkcert localhost
npm run dev -- --https
```

---

## 🏗️ Building

### Production Build
```cmd
cd frontend
npm run build
# Output: dist/ directory
```

### Build with Analysis
```cmd
# Bundle analyzer
npm run build -- --mode analyze
# Or with vite-bundle-analyzer
npx vite-bundle-analyzer dist
```

### Preview Production Build
```cmd
npm run preview
# Serves dist/ on http://localhost:4173
```

---

## 🧪 Testing & Quality

### Linting
```cmd
# Run ESLint
npm run lint

# Auto-fix
npm run lint -- --fix

# Specific file
npx eslint src/components/ui/Button.tsx
```

### Type Checking
```cmd
# TypeScript check (no emit)
npx tsc --noEmit

# Watch mode
npx tsc --noEmit --watch
```

### Formatting (if Prettier configured)
```cmd
# Check
npx prettier --check "src/**/*.{ts,tsx}"

# Fix
npx prettier --write "src/**/*.{ts,tsx}"
```

---

## 📦 Dependency Management

### Update Dependencies
```cmd
# Check outdated
npm outdated

# Update all (respects semver)
npm update

# Update to latest (major versions)
npx npm-check-updates -u
npm install
```

### Audit Security
```cmd
# Check vulnerabilities
npm audit

# Fix automatically (non-breaking)
npm audit fix

# Fix all (may break)
npm audit fix --force
```

### List Dependencies
```cmd
# Top-level only
npm list --depth=0

# Full tree
npm list

# Production only
npm list --production
```

---

## 🔧 Vite-Specific Commands

### Clear Cache
```cmd
# Clear Vite cache
npx vite --force

# Or manually
rm -rf node_modules/.vite
```

### Optimize Dependencies
```cmd
# Force re-optimize
npx vite optimize
```

### Build Modes
```cmd
# Development (default)
npm run dev -- --mode development

# Production
npm run build -- --mode production

# Staging (custom)
npm run build -- --mode staging
```

---

## 🐳 Docker Commands

### Build Frontend Image
```cmd
# From project root
docker build -f Dockerfile.frontend -t piper-frontend .

# Multi-stage (included in Dockerfile)
```

### Run Container
```cmd
# Production (nginx)
docker run -p 3000:80 piper-frontend

# Development (with hot reload)
docker run -p 5173:5173 -v %cd%/frontend:/app -v /app/node_modules piper-frontend-dev

# With custom API URL
docker run -p 3000:80 -e VITE_API_URL=http://backend:8000/api/v1 piper-frontend
```

### Docker Compose
```cmd
# From project root
docker-compose up frontend
docker-compose up -d frontend  # detached
docker-compose logs -f frontend
docker-compose down
```

---

## 📱 PWA / Offline Commands

### Generate Icons (if using vite-plugin-pwa)
```cmd
# Generate manifest icons
npx vite-pwa generate-sw
```

### Test Offline
```cmd
# Build and serve with HTTPS (required for Service Worker)
npm run build && npx serve -s dist -l 3000 --ssl-cert cert.pem --ssl-key key.pem
```

---

## 🔍 Debugging Commands

### Inspect Bundle
```cmd
# Visualize bundle
npx vite-bundle-analyzer dist

# Source map exploration
# Open dist/assets/index-*.js.map in source-map-explorer
npx source-map-explorer dist/assets/index-*.js
```

### Component Tree (React DevTools)
```cmd
# Install React DevTools browser extension
# Or standalone:
npx react-devtools
```

### Network Debugging
```cmd
# Check API calls in browser DevTools Network tab
# Filter: fetch/xhr
# Look for: /api/v1/ endpoints
```

---

## 📋 Quick Reference Card

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Start dev (port 3000) | `npm run dev -- --port 3000` |
| Start dev (LAN) | `npm run dev -- --host 0.0.0.0 --port 3000` |
| Production build | `npm run build` |
| Preview build | `npm run preview` |
| Lint | `npm run lint` |
| Lint + fix | `npm run lint -- --fix` |
| Type check | `npx tsc --noEmit` |
| Check outdated | `npm outdated` |
| Update deps | `npm update` |
| Security audit | `npm audit` |
| Clear cache | `rm -rf node_modules/.vite` |
| Docker build | `docker build -f Dockerfile.frontend -t piper-frontend .` |
| Docker run | `docker run -p 3000:80 piper-frontend` |

---

## 🌐 Environment Variables

### `.env.local` (Machine-specific, gitignored)
```env
# Override API URL
VITE_API_URL=http://localhost:8000/api/v1

# Enable debug features
VITE_DEBUG=true
```

### `.env.production` (Production build)
```env
VITE_API_URL=https://api.example.com/api/v1
```

### Available Variables (in `import.meta.env`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_DEBUG` | Enable debug logging |
| `MODE` | `development` / `production` |
| `DEV` | Boolean: dev mode |
| `PROD` | Boolean: production mode |
| `SSR` | Boolean: server-side rendering |

---

## 🔄 Common Workflows

### Daily Development
```cmd
cd frontend
npm run dev -- --port 3000
# Edit code → Auto-reload via HMR
```

### Before Commit
```cmd
npm run lint
npx tsc --noEmit
npm run build
```

### Deploy to Production
```cmd
npm run build
# Upload dist/ to static hosting (Netlify, Vercel, S3, nginx)
```

### Debug Production Issue
```cmd
npm run build
npm run preview
# Test at http://localhost:4173
```