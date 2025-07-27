# Docker Setup for Trading Backtesting

This guide will help you use Docker Desktop to test and develop the trading-backtesting project.

## Prerequisites

1. **Docker Desktop** installed and running
2. **Terminal** access (Docker Desktop terminal or your system terminal)

## Quick Start

### Option 1: Using the setup script
```bash
./docker-setup.sh
```

### Option 2: Manual setup
```bash
# Build the Docker images
docker-compose build

# Start all services
docker-compose up -d

# Enter the container
docker-compose exec trading-app /bin/bash
```

## Using Make Commands

We've included a Makefile for easier Docker operations:

```bash
make build    # Build Docker images
make up       # Start all services
make shell    # Enter the container shell
make test     # Run tests
make jupyter  # Start Jupyter notebook
make logs     # View container logs
make down     # Stop all services
```

## Docker Desktop Terminal Usage

1. **Open Docker Desktop**
2. Navigate to **Containers** tab
3. Click on `trading-backtesting` container
4. Click **Terminal** tab to access the container shell

### Inside the container, you can:
```bash
# Run tests
python -m pytest -v

# Run specific test files
python -m pytest tests/test_ai_integration.py -v

# Run Python scripts
python test_ai_integration.py

# Install additional packages
pip install <package-name>

# Access Python REPL
python
```

## Development Workflow

### 1. **Testing with Docker**
```bash
# Run all tests
make test

# Or inside container
docker-compose exec trading-app python -m pytest -v
```

### 2. **Interactive Development**
```bash
# Enter container shell
make shell

# Then run Python interactively
python
>>> import pandas as pd
>>> from alpaca_py import Client
>>> # Your code here
```

### 3. **Using Jupyter Notebook**
```bash
# Start Jupyter
make jupyter

# Access at http://localhost:8888
# No password required
```

### 4. **Viewing Logs**
```bash
# View all logs
make logs

# View specific service logs
docker-compose logs -f trading-app
```

## Project Structure in Docker

```
/app/                     # Your project root
├── alpaca-py/           # Alpaca trading examples
├── fastquant/           # FastQuant strategies
├── ultra-trading/       # Ultra trading strategies
├── trading_env/         # Virtual environment (ignored)
├── requirements.txt     # Python dependencies
└── test_ai_integration.py  # AI integration tests
```

## Environment Variables

The `.env` file is mounted into the container. Update it with your API keys:

```env
# Alpaca API Keys
ALPACA_API_KEY=your_api_key_here
ALPACA_SECRET_KEY=your_secret_key_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Other API keys as needed
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs trading-app

# Rebuild from scratch
make rebuild
```

### Permission issues
```bash
# Fix permissions
docker-compose exec trading-app chown -R trader:trader /app
```

### Can't connect to services
```bash
# Check container status
docker-compose ps

# Restart services
make down && make up
```

## Advanced Usage

### Running with Cloudflare (if needed)
Add to docker-compose.yml:
```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - trading-network
```

### Adding more Python packages
Edit `requirements.txt` and rebuild:
```bash
echo "new-package>=1.0.0" >> requirements.txt
make rebuild
```

## Tips for Docker Desktop

1. **Resource Limits**: Go to Docker Desktop → Settings → Resources to adjust CPU/Memory
2. **File Sharing**: Ensure your project directory is in Docker Desktop's file sharing settings
3. **Logs**: Use the Docker Desktop UI to view real-time logs
4. **Stats**: Monitor container resource usage in the Containers tab

## Next Steps

1. Run `./docker-setup.sh` to initialize
2. Update `.env` with your API credentials
3. Run `make test` to verify setup
4. Start developing with `make shell`

Happy trading! 🚀
