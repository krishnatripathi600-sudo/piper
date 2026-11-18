#!/bin/bash
# PIPER - Complete Service Runner
# This script starts both backend and frontend services

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$PROJECT_ROOT/.venv"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   PIPER Service Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}Killing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Check and setup virtual environment
setup_venv() {
    echo -e "${BLUE}Setting up virtual environment...${NC}"
    
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${YELLOW}Creating virtual environment...${NC}"
        python3 -m venv "$VENV_DIR"
    fi
    
    # Activate venv
    source "$VENV_DIR/bin/activate"
    
    # Upgrade pip
    pip install --upgrade pip >/dev/null 2>&1
    
    echo -e "${GREEN}Virtual environment ready${NC}"
}

# Install backend dependencies
install_backend() {
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    cd "$BACKEND_DIR"
    pip install -r requirements.txt
    echo -e "${GREEN}Backend dependencies installed${NC}"
}

# Install frontend dependencies
install_frontend() {
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd "$FRONTEND_DIR"
    npm install
    echo -e "${GREEN}Frontend dependencies installed${NC}"
}

# Build frontend
build_frontend() {
    echo -e "${BLUE}Building frontend...${NC}"
    cd "$FRONTEND_DIR"
    npm run build
    echo -e "${GREEN}Frontend built successfully${NC}"
}

# Start backend
start_backend() {
    echo -e "${BLUE}Starting backend on port 8000...${NC}"
    cd "$BACKEND_DIR"
    
    # Kill any existing process on port 8000
    kill_port 8000
    
    # Start backend in background
    nohup python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_ROOT/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$PROJECT_ROOT/backend.pid"
    
    # Wait for backend to be ready
    echo -e "${YELLOW}Waiting for backend to start...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:8000/api/v1/health >/dev/null 2>&1; then
            echo -e "${GREEN}Backend started successfully (PID: $BACKEND_PID)${NC}"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}Backend failed to start. Check backend.log${NC}"
    return 1
}

# Start frontend
start_frontend() {
    echo -e "${BLUE}Starting frontend on port 5173...${NC}"
    cd "$FRONTEND_DIR"
    
    # Kill any existing process on port 5173
    kill_port 5173
    
    # Start frontend in background
    nohup npm run dev > "$PROJECT_ROOT/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$PROJECT_ROOT/frontend.pid"
    
    # Wait for frontend to be ready
    echo -e "${YELLOW}Waiting for frontend to start...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:5173 >/dev/null 2>&1; then
            echo -e "${GREEN}Frontend started successfully (PID: $FRONTEND_PID)${NC}"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}Frontend failed to start. Check frontend.log${NC}"
    return 1
}

# Stop all services
stop_services() {
    echo -e "${BLUE}Stopping all services...${NC}"
    
    # Stop backend
    if [ -f "$PROJECT_ROOT/backend.pid" ]; then
        kill $(cat "$PROJECT_ROOT/backend.pid") 2>/dev/null || true
        rm "$PROJECT_ROOT/backend.pid"
    fi
    kill_port 8000
    
    # Stop frontend
    if [ -f "$PROJECT_ROOT/frontend.pid" ]; then
        kill $(cat "$PROJECT_ROOT/frontend.pid") 2>/dev/null || true
        rm "$PROJECT_ROOT/frontend.pid"
    fi
    kill_port 5173
    
    echo -e "${GREEN}All services stopped${NC}"
}

# Show status
show_status() {
    echo -e "${BLUE}Service Status:${NC}"
    echo -e "${BLUE}================${NC}"
    
    if check_port 8000; then
        echo -e "Backend (port 8000): ${GREEN}RUNNING${NC}"
        curl -s http://localhost:8000/api/v1/health | jq . 2>/dev/null || curl -s http://localhost:8000/api/v1/health
    else
        echo -e "Backend (port 8000): ${RED}STOPPED${NC}"
    fi
    
    echo ""
    
    if check_port 5173; then
        echo -e "Frontend (port 5173): ${GREEN}RUNNING${NC}"
    else
        echo -e "Frontend (port 5173): ${RED}STOPPED${NC}"
    fi
}

# View logs
view_logs() {
    local service=$1
    if [ "$service" = "backend" ]; then
        tail -f "$PROJECT_ROOT/backend.log"
    elif [ "$service" = "frontend" ]; then
        tail -f "$PROJECT_ROOT/frontend.log"
    else
        echo "Usage: $0 logs [backend|frontend]"
    fi
}

# Main command handler
case "${1:-start}" in
    setup)
        setup_venv
        install_backend
        install_frontend
        echo -e "${GREEN}Setup complete!${NC}"
        ;;
    install)
        setup_venv
        install_backend
        install_frontend
        ;;
    build)
        setup_venv
        source "$VENV_DIR/bin/activate"
        build_frontend
        ;;
    start)
        setup_venv
        source "$VENV_DIR/bin/activate"
        start_backend
        start_frontend
        show_status
        echo ""
        echo -e "${GREEN}All services started!${NC}"
        echo -e "Backend:  http://localhost:8000"
        echo -e "Frontend: http://localhost:5173"
        echo -e "API Docs: http://localhost:8000/docs"
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        $0 start
        ;;
    status)
        show_status
        ;;
    logs)
        view_logs "${2:-backend}"
        ;;
    test)
        # Run API tests
        echo -e "${BLUE}Testing API endpoints...${NC}"
        curl -s http://localhost:8000/api/v1/health | jq .
        curl -s http://localhost:8000/api/v1/explain/health | jq .
        curl -s http://localhost:8000/api/v1/model/info | jq .
        echo -e "${GREEN}API tests passed${NC}"
        ;;
    *)
        echo "Usage: $0 {setup|install|build|start|stop|restart|status|logs|test}"
        echo ""
        echo "Commands:"
        echo "  setup    - Create venv and install all dependencies"
        echo "  install  - Install dependencies only"
        echo "  build    - Build frontend for production"
        echo "  start    - Start all services (backend + frontend)"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  status   - Show service status"
        echo "  logs     - View logs (backend|frontend)"
        echo "  test     - Test API endpoints"
        exit 1
        ;;
esac