# Trading Backtesting Project Configuration

## Service Ports Configuration

This document outlines the port configuration for the trading-backtesting project.

### Default Port Mappings

| Service | Container Port | Host Port | Description |
|---------|---------------|-----------|-------------|
| FastAPI | 8000 | 8000 | Main API server for trading operations |
| Streamlit | 8501 | 8501 | Web UI for backtesting visualization |
| Jupyter | 8888 | 8888 | Interactive notebook environment |
| Flask | 5000 | 5000 | Alternative API server (if needed) |
| Frontend | 3000 | 3000 | React/Next.js dev server (future) |

### Service Startup Commands

```bash
# Start API server (FastAPI)
docker exec trading-backtesting-container uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Start Streamlit UI
docker exec trading-backtesting-container streamlit run app.py --server.port 8501 --server.address 0.0.0.0

# Start Jupyter Notebook
docker exec trading-backtesting-container jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --allow-root

# Start Flask API (alternative)
docker exec trading-backtesting-container python flask_app.py
```

### Environment Variables

The following environment variables are configured:

- `ALPACA_API_KEY`: Your Alpaca API key
- `ALPACA_SECRET_KEY`: Your Alpaca secret key
- `ALPACA_BASE_URL`: Alpaca API base URL (paper/live)
- `PYTHONPATH`: Set to /app for module imports
- `PORT`: Default service port (can be overridden)

### Docker Commands with Ports

```bash
# Run container with all ports exposed
docker run -d \
  --name trading-backtesting \
  -p 8000:8000 \
  -p 8501:8501 \
  -p 8888:8888 \
  -p 5000:5000 \
  -p 3000:3000 \
  -v $(pwd):/app \
  -e PYTHONPATH=/app \
  trading-backtesting:latest

# Using docker-compose (recommended)
docker-compose up -d
```

### Testing Port Connectivity

Once services are running, test connectivity:

```bash
# Test API health
curl http://localhost:8000/health

# Open Streamlit UI
open http://localhost:8501

# Access Jupyter
open http://localhost:8888

# Check all ports
netstat -an | grep -E "(8000|8501|8888|5000|3000)"
```

### Firewall/Security Considerations

- All ports are exposed on 0.0.0.0 (all interfaces) within Docker
- Host firewall rules may need adjustment for external access
- For production, use reverse proxy (nginx) instead of direct port exposure
- Consider using Docker networks for inter-service communication

### Future Services

Reserved ports for future expansion:

- 6379: Redis (caching/queuing)
- 5432: PostgreSQL (trade data storage)
- 9000: Monitoring/metrics
- 4200: Angular/alternative frontend

## Notes

- Update this file when adding new services
- Always use environment variables for configuration
- Keep sensitive data in .env file (not in git)
- Use docker-compose.override.yml for local overrides
