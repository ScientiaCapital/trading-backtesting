#!/bin/bash

# Quick Docker test script for trading-backtesting
# This script helps you get started with Docker testing

echo "🚀 Trading Backtesting Docker Helper"
echo "==================================="
echo ""

# Set up Docker path
DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"

# Check if Docker is accessible
if ! $DOCKER_BIN --version > /dev/null 2>&1; then
    echo "❌ Docker is not accessible. Please ensure Docker Desktop is running."
    exit 1
fi

echo "✅ Docker version: $($DOCKER_BIN --version)"
echo ""

# Function to run docker commands
docker_cmd() {
    $DOCKER_BIN "$@"
}

# Function to run docker compose commands
compose_cmd() {
    $DOCKER_BIN compose "$@"
}

# Menu
echo "What would you like to do?"
echo "1) Build the Docker image"
echo "2) Run tests in Docker"
echo "3) Start interactive Python shell"
echo "4) Run Jupyter notebook"
echo "5) Execute custom command"
echo "6) Show Docker help"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        echo "🔨 Building Docker image..."
        compose_cmd build --no-cache trading-app
        ;;
    2)
        echo "🧪 Running tests..."
        compose_cmd run --rm trading-app python -m pytest -v
        ;;
    3)
        echo "🐍 Starting Python shell..."
        compose_cmd run --rm -it trading-app python
        ;;
    4)
        echo "📓 Starting Jupyter notebook..."
        echo "Note: Jupyter will be available at http://localhost:8888"
        compose_cmd up -d jupyter
        compose_cmd logs -f jupyter
        ;;
    5)
        read -p "Enter command to run: " cmd
        echo "🏃 Running: $cmd"
        compose_cmd run --rm trading-app $cmd
        ;;
    6)
        echo "📚 Docker commands for this project:"
        echo ""
        echo "Build image:"
        echo "  $DOCKER_BIN compose build trading-app"
        echo ""
        echo "Run tests:"
        echo "  $DOCKER_BIN compose run --rm trading-app python -m pytest -v"
        echo ""
        echo "Interactive shell:"
        echo "  $DOCKER_BIN compose run --rm -it trading-app /bin/bash"
        echo ""
        echo "Python REPL:"
        echo "  $DOCKER_BIN compose run --rm -it trading-app python"
        echo ""
        echo "View logs:"
        echo "  $DOCKER_BIN compose logs -f"
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac
