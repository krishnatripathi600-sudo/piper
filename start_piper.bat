@echo off
REM =====================================================================
REM PIPER - Water Leakage Detection System Startup Script (Windows)
REM =====================================================================
REM This script starts both the backend (FastAPI) and frontend (Vite) servers.
REM 
REM Prerequisites:
REM   - Python 3.10+ with venv
REM   - Node.js 18+ with npm
REM   - Backend dependencies installed (pip install -r backend/requirements.txt)
REM   - Frontend dependencies installed (npm install in frontend/)
REM =====================================================================

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo =====================================================================
echo  PIPER - Water Leakage Detection System
echo =====================================================================
echo.

REM Check if we're in the right directory
if not exist "backend\main.py" (
    echo [ERROR] backend/main.py not found. Run this script from the piperApp root directory.
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [ERROR] frontend/package.json not found. Run this script from the piperApp root directory.
    pause
    exit /b 1
)

REM Check for model artifacts
if not exist "models\gru_cls.pt" (
    echo [WARNING] GRU model not found at models/gru_cls.pt
    echo [WARNING] The backend will start but predictions will not work.
    echo.
)

REM Check for Python virtual environment
set "VENV_DIR=%SCRIPT_DIR%\.venv"
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [INFO] Creating Python virtual environment...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment. Make sure Python is installed.
        pause
        exit /b 1
    )
)

REM Activate virtual environment and install backend dependencies
echo [INFO] Activating virtual environment and checking backend dependencies...
call "%VENV_DIR%\Scripts\activate.bat"
pip install -q -r backend/requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b 1
)

REM Check frontend dependencies
echo [INFO] Checking frontend dependencies...
cd "%SCRIPT_DIR%\frontend"
dir node_modules >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing frontend dependencies (this may take a minute)... 
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies. Make sure Node.js is installed.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Frontend dependencies already installed.
)
cd "%SCRIPT_DIR%"

echo.
echo =====================================================================
echo  Starting PIPER Services
echo =====================================================================
echo.

REM Start backend in a new window
echo [INFO] Starting backend server (FastAPI on port 8000)...
start "PIPER Backend" cmd /k "cd /d "%SCRIPT_DIR%" && call "%VENV_DIR%\Scripts\activate.bat" && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
echo [INFO] Starting frontend server (Vite on port 3000)...
start "PIPER Frontend" cmd /k "cd /d "%SCRIPT_DIR%\frontend" && npm run dev"

echo.
echo =====================================================================
echo  PIPER is starting up!
echo =====================================================================
echo.
echo   Backend API:  http://localhost:8000
echo   API Docs:     http://localhost:8000/docs
echo   Frontend:     http://localhost:3000
echo.
echo  Two command windows will open - one for backend, one for frontend.
echo  Keep them running while using the application.
echo.
echo  Press Ctrl+C in each window to stop the servers.
echo =====================================================================
echo.

pause