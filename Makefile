# Makefile for trading-backtesting Docker operations

.PHONY: help build up down shell test jupyter logs clean rebuild

# Default target
help:
	@echo "Available commands:"
	@echo "  make build    - Build Docker images"
	@echo "  make up       - Start all services"
	@echo "  make down     - Stop all services"
	@echo "  make shell    - Enter the trading app container"
	@echo "  make test     - Run tests in container"
	@echo "  make jupyter  - Start Jupyter notebook server"
	@echo "  make logs     - View container logs"
	@echo "  make clean    - Remove containers and volumes"
	@echo "  make rebuild  - Clean rebuild of everything"

# Build Docker images
build:
	docker-compose build

# Start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# Enter the trading app container
shell:
	docker-compose exec trading-app /bin/bash

# Run tests
test:
	docker-compose run --rm trading-app python -m pytest -v

# Start only Jupyter service
jupyter:
	docker-compose up -d jupyter
	@echo "Jupyter notebook is running at http://localhost:8888"

# View logs
logs:
	docker-compose logs -f

# Clean up containers and volumes
clean:
	docker-compose down -v
	docker system prune -f

# Rebuild everything from scratch
rebuild: clean build up
