#!/bin/bash
# Service launcher for trading-backtesting project

DOCKER="/Applications/Docker.app/Contents/Resources/bin/docker"
CONTAINER="trading-backtesting-container"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if container is running
check_container() {
    if ! $DOCKER ps | grep -q $CONTAINER; then
        echo -e "${RED}Error: Container $CONTAINER is not running${NC}"
        echo "Start it with: $DOCKER start $CONTAINER"
        exit 1
    fi
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}Warning: Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

case "$1" in
    api)
        check_container
        check_port 8000
        echo -e "${GREEN}Starting FastAPI server on port 8000...${NC}"
        $DOCKER exec -d $CONTAINER uvicorn main:app --host 0.0.0.0 --port 8000 --reload
        echo "API will be available at http://localhost:8000"
        echo "API docs at http://localhost:8000/docs"
        ;;
    
    ui)
        check_container
        check_port 8501
        echo -e "${GREEN}Starting Streamlit UI on port 8501...${NC}"
        $DOCKER exec -d $CONTAINER streamlit run app.py --server.port 8501 --server.address 0.0.0.0
        echo "UI will be available at http://localhost:8501"
        ;;
    
    jupyter)
        check_container
        check_port 8888
        echo -e "${GREEN}Starting Jupyter Notebook on port 8888...${NC}"
        $DOCKER exec -it $CONTAINER jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --allow-root
        ;;
    
    all)
        check_container
        echo -e "${GREEN}Starting all services...${NC}"
        
        # Start API
        check_port 8000 && {
            $DOCKER exec -d $CONTAINER uvicorn main:app --host 0.0.0.0 --port 8000 --reload
            echo "✓ API started on port 8000"
        }
        
        # Start UI
        check_port 8501 && {
            $DOCKER exec -d $CONTAINER streamlit run app.py --server.port 8501 --server.address 0.0.0.0
            echo "✓ UI started on port 8501"
        }
        
        echo -e "\n${GREEN}Services are starting up...${NC}"
        echo "API: http://localhost:8000"
        echo "UI: http://localhost:8501"
        echo "API Docs: http://localhost:8000/docs"
        ;;
    
    stop)
        echo -e "${YELLOW}Stopping all services...${NC}"
        # Kill Python processes in container (this will stop the services)
        $DOCKER exec $CONTAINER pkill -f "uvicorn" || true
        $DOCKER exec $CONTAINER pkill -f "streamlit" || true
        $DOCKER exec $CONTAINER pkill -f "jupyter" || true
        echo -e "${GREEN}All services stopped${NC}"
        ;;
    
    status)
        echo -e "${GREEN}Service Status:${NC}"
        echo -n "API (port 8000): "
        check_port 8000 && echo -e "${RED}Not running${NC}" || echo -e "${GREEN}Running${NC}"
        
        echo -n "UI (port 8501): "
        check_port 8501 && echo -e "${RED}Not running${NC}" || echo -e "${GREEN}Running${NC}"
        
        echo -n "Jupyter (port 8888): "
        check_port 8888 && echo -e "${RED}Not running${NC}" || echo -e "${GREEN}Running${NC}"
        ;;
    
    logs)
        service=${2:-all}
        case $service in
            api)
                $DOCKER exec $CONTAINER sh -c "tail -f /tmp/uvicorn.log 2>/dev/null || echo 'No API logs found'"
                ;;
            ui)
                $DOCKER exec $CONTAINER sh -c "tail -f /tmp/streamlit.log 2>/dev/null || echo 'No UI logs found'"
                ;;
            *)
                $DOCKER logs -f $CONTAINER
                ;;
        esac
        ;;
    
    *)
        echo "Trading Backtesting Service Manager"
        echo "==================================="
        echo "Usage: ./services.sh [command]"
        echo ""
        echo "Commands:"
        echo "  api      - Start FastAPI server (port 8000)"
        echo "  ui       - Start Streamlit UI (port 8501)"
        echo "  jupyter  - Start Jupyter notebook (port 8888)"
        echo "  all      - Start all services"
        echo "  stop     - Stop all services"
        echo "  status   - Check service status"
        echo "  logs     - View service logs"
        echo ""
        echo "Examples:"
        echo "  ./services.sh all        # Start all services"
        echo "  ./services.sh api        # Start only API"
        echo "  ./services.sh logs api   # View API logs"
        ;;
esac
