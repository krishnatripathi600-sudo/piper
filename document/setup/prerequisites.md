# Prerequisites

System requirements for running the PIPER Water Leakage Detection System.

## 🖥️ Operating System
- **Windows 10/11** (primary, with `start_piper.bat` support)
- **Linux** (Ubuntu 20.04+, tested on Ubuntu 22.04)
- **macOS** (12+ Monterey, tested on macOS 13 Ventura)

## 🐍 Python Requirements
| Requirement | Version | Notes |
|-------------|---------|-------|
| **Python** | **3.10+** | 3.10, 3.11, 3.12 tested |
| **pip** | 23.0+ | Upgrade: `python -m pip install --upgrade pip` |
| **venv** | Built-in | Standard library module |

### Verify Python Installation
```cmd
python --version
# Expected: Python 3.10.x or higher

pip --version
# Expected: pip 23.x or higher
```

## 📦 Node.js Requirements
| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | **18+** | LTS recommended (18.x, 20.x) |
| **npm** | 9+ | Bundled with Node.js |

### Verify Node.js Installation
```cmd
node --version
# Expected: v18.x.x or higher

npm --version
# Expected: 9.x.x or higher
```

## 🔧 Additional Tools
| Tool | Required? | Purpose |
|------|-----------|---------|
| **Git** | Yes | Cloning repository, version control |
| **Docker** | Optional | Containerized deployment |
| **VS Code** | Recommended | IDE with Python/TypeScript extensions |

## 💾 Disk Space
| Component | Estimated Space |
|-----------|-----------------|
| Python venv + deps | ~2 GB |
| Node.js node_modules | ~500 MB |
| Model artifacts | ~50 MB |
| Data (LeakageData) | ~100 MB |
| **Total** | **~3 GB** |

## 🌐 Network
- **Localhost ports**: 3000 (frontend), 8000 (backend)
- **Internet**: Required for initial dependency installation (PyPI, npm)
- **Offline**: Possible after dependencies cached

## 📋 Pre-Installation Checklist

```cmd
# 1. Check Python
python --version && pip --version

# 2. Check Node.js
node --version && npm --version

# 3. Check Git
git --version

# 4. Check available disk space
# Windows: dir C:\
# Linux/macOS: df -h .

# 5. Check ports available
# Windows: netstat -an | findstr "3000 8000"
# Linux/macOS: lsof -i :3000 -i :8000
```

## ⚠️ Known Compatibility Issues

| Issue | Workaround |
|-------|------------|
| Python 3.13+ | Not fully tested; use 3.10-3.12 |
| Node.js 16 or older | Upgrade to 18+ (Vite 5 requires Node 18+) |
| Windows ARM64 | PyTorch CPU wheel may not exist; use x64 emulation |
| Corporate proxy | Configure `pip config set global.proxy` and `npm config set proxy` |

## 🔗 Official Downloads
- **Python**: https://python.org/downloads/
- **Node.js**: https://nodejs.org/ (LTS version)
- **Git**: https://git-scm.com/downloads
- **VS Code**: https://code.visualstudio.com/