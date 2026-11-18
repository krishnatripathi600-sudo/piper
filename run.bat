@echo off
REM PIPER - Complete Service Runner for Windows
REM This script starts both backend and frontend services

setlocal enabledelayedexpansion

REM Colors for output
set RED=\033[0;31m
set GREEN=\033[0;32m
set YELLOW=\033[1;33m
set BLUE=\033[0;34m
set NC=\033[0m

REM Project root
set PROJECT_ROOT=%~dp0
set BACKEND_DIR=%PROJECT_ROOT%backend
set FRONTEND_DIR=%PROJECT_ROOT%frontend
set VENV_DIR=%PROJECT_ROOT%.venv

echo ========================================
echo    PIPER Service Runner (Windows)
echo ========================================
echo.

REM Function to check if a port is in use
:check_port
set PORT=%1
netstat -ano | findstr :%PORT% >nul 2>&1
if %errorlevel% equ 0 (
    exit /b 0
) else (
    exit /b 1
)

REM Function to kill process on port
:kill_port
set PORT=%1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
exit /b 0

REM Setup virtual environment
:setup_venv
echo [INFO] Setting up virtual environment...
if not exist "%VENV_DIR%" (
    echo [WARN] Creating virtual environment...
    python -m venv "%VENV_DIR%"
)
call "%VENV_DIR%\Scripts\activate.bat"
python -m pip install --upgrade pip >nul 2>&1
echo [OK] Virtual environment ready
exit /b 0

REM Install backend dependencies
:install_backend
echo [INFO] Installing backend dependencies...
cd /d "%BACKEND_DIR%"
pip install -r requirements.txt
echo [OK] Backend dependencies installed
exit /b 0

REM Install frontend dependencies
:install_frontend
echo [INFO] Installing frontend dependencies...
cd /d "%FRONTEND_DIR%"
npm install
echo [OK] Frontend dependencies installed
exit /b 0

REM Build frontend
:build_frontend
echo [INFO] Building frontend...
cd /d "%FRONTEND_DIR%"
npm run build
echo [OK] Frontend built successfully
exit /b 0

REM Start backend
:start_backend
echo [INFO] Starting backend on port 8000...
cd /d "%BACKEND_DIR%"
call :kill_port 8000

start /B python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "%PROJECT_ROOT%backend.log" 2>&1
echo Backend started (check backend.log)

REM Wait for backend to be ready
echo [WAIT] Waiting for backend to start...
for /L %%i in (1,1,30) do (
    curl -s http://localhost:8000/api/v1/health >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Backend started successfully
        goto :eof
    )
    timeout /t 1 /nobreak >nul
)
echo [ERROR] Backend failed to start. Check backend.log
exit /b 1

REM Start frontend
:start_frontend
echo [INFO] Starting frontend on port 5173...
cd /d "%FRONTEND_DIR%"
call :kill_port 5173

start /B npm run dev > "%PROJECT_ROOT%frontend.log" 2>&1
echo Frontend started (check frontend.log)

REM Wait for frontend to be ready
echo [WAIT] Waiting for frontend to start...
for /L %%i in (1,1,30) do (
    curl -s http://localhost:5173 >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Frontend started successfully
        goto :eof
    )
    timeout /t 1 /nobreak >nul
)
echo [ERROR] Frontend failed to start. Check frontend.log
exit /b 1

REM Stop all services
:stop_services
echo [INFO] Stopping all services...
call :kill_port 8000
call :kill_port 5173
echo [OK] All services stopped
exit /b 0

REM Show status
:show_status
echo Service Status:
echo ================
call :check_port 8000
if !errorlevel! equ 0 (
    echo Backend (port 8000): RUNNING
    curl -s http://localhost:8000/api/v1/health
) else (
    echo Backend (port 8000): STOPPED
)
echo.
call :check_port 5173
if !errorlevel! equ 0 (
    echo Frontend (port 5173): RUNNING
) else (
    echo Frontend (port 5173): STOPPED
)
exit /b 0

REM View logs
:view_logs
set SERVICE=%1
if "%SERVICE%"=="" set SERVICE=backend
if "%SERVICE%"=="backend" (
    type "%PROJECT_ROOT%backend.log"
) else if "%SERVICE%"=="frontend" (
    type "%PROJECT_ROOT%frontend.log"
) else (
    echo Usage: %0 logs [backend^|frontend]
)
exit /b 0

REM Main command handler
if "%1"=="" set COMMAND=start
set COMMAND=%1

if "%COMMAND%"=="setup" (
    call :setup_venv
    call :install_backend
    call :install_frontend
    echo [OK] Setup complete!
    goto :eof
)

if "%COMMAND%"=="install" (
    call :setup_venv
    call :install_backend
    call :install_frontend
    goto :eof
)

if "%COMMAND%"=="build" (
    call :setup_venv
    call :build_frontend
    goto :eof
)

if "%COMMAND%"=="start" (
    call :setup_venv
    call :start_backend
    call :start_frontend
    call :show_status
    echo.
    echo [OK] All services started!
    echo Backend:  http://localhost:8000
    echo Frontend: http://localhost:5173
    echo API Docs: http://localhost:8000/docs
    goto :eof
)

if "%COMMAND%"=="stop" (
    call :stop_services
    goto :eof
)

if "%COMMAND%"=="restart" (
    call :stop_services
    timeout /t 2 /nobreak >nul
    call :start_backend
    call :start_frontend
    goto :eof
)

if "%COMMAND%"=="status" (
    call :show_status
    goto :eof
)

if "%COMMAND%"=="logs" (
    call :view_logs %2
    goto :eof
)

if "%COMMAND%"=="test" (
    echo [INFO] Testing API endpoints...
    curl -s http://localhost:8000/api/v1/health
    curl -s http://localhost:8000/api/v1/explain/health
    curl -s http://localhost:8000/api/v1/model/info
    echo [OK] API tests passed
    goto :eof
)

echo Usage: %0 {setup^|install^|build^|start^|stop^|restart^|status^|logs^|test}
echo.
echo Commands:
echo   setup    - Create venv and install all dependencies
echo   install  - Install dependencies only
echo   build    - Build frontend for production
echo   start    - Start all services (backend + frontend)
echo   stop     - Stop all services
echo   restart  - Restart all services
echo   status   - Show service status
echo   logs     - View logs (backend^|frontend)
echo   test     - Test API endpoints
exit /b 1