#!/bin/bash
# Docker shortcuts for trading-backtesting project

DOCKER="/Applications/Docker.app/Contents/Resources/bin/docker"
CONTAINER="trading-backtesting-container"

case "$1" in
    shell)
        echo "🐚 Opening shell in container..."
        $DOCKER exec -it $CONTAINER /bin/bash
        ;;
    test)
        echo "🧪 Running tests..."
        $DOCKER exec $CONTAINER python -m pytest -v
        ;;
    python)
        echo "🐍 Starting Python REPL..."
        $DOCKER exec -it $CONTAINER python
        ;;
    logs)
        echo "📋 Showing container logs..."
        $DOCKER logs -f $CONTAINER
        ;;
    stop)
        echo "🛑 Stopping container..."
        $DOCKER stop $CONTAINER
        ;;
    start)
        echo "🚀 Starting container..."
        $DOCKER start $CONTAINER
        ;;
    restart)
        echo "🔄 Restarting container..."
        $DOCKER restart $CONTAINER
        ;;
    status)
        echo "📊 Container status:"
        $DOCKER ps -a | grep $CONTAINER
        ;;
    *)
        echo "Trading Backtesting Docker Helper"
        echo "================================"
        echo "Usage: ./docker-cmd.sh [command]"
        echo ""
        echo "Commands:"
        echo "  shell    - Open bash shell in container"
        echo "  test     - Run all tests"
        echo "  python   - Start Python REPL"
        echo "  logs     - View container logs"
        echo "  stop     - Stop the container"
        echo "  start    - Start the container"
        echo "  restart  - Restart the container"
        echo "  status   - Show container status"
        ;;
esac
