#!/bin/bash

# Docker setup script for trading-backtesting project

echo "🚀 Setting up Docker environment for trading-backtesting..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "✅ Docker is running"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your actual API keys"
fi

# Build images
echo "🔨 Building Docker images..."
docker-compose build

# Start services
echo "🎯 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Show status
echo "📊 Container status:"
docker-compose ps

echo ""
echo "✅ Setup complete! Here's how to use Docker with your project:"
echo ""
echo "📚 Quick Commands:"
echo "  - Enter container shell: make shell"
echo "  - Run tests: make test"
echo "  - Start Jupyter: make jupyter"
echo "  - View logs: make logs"
echo "  - Stop services: make down"
echo ""
echo "🔧 Manual Docker commands:"
echo "  - Build: docker-compose build"
echo "  - Start: docker-compose up -d"
echo "  - Shell: docker-compose exec trading-app /bin/bash"
echo "  - Logs: docker-compose logs -f"
echo ""
echo "💡 Tip: The terminal in Docker Desktop shows container logs."
echo "    Use 'make shell' to get an interactive terminal inside the container."
