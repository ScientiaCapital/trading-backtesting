# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy project files
COPY . .

# Create a non-root user
RUN useradd -m -u 1000 trader && \
    chown -R trader:trader /app

# Switch to non-root user
USER trader

# Expose ports for various services
# 8000: FastAPI/Uvicorn API server
# 8501: Streamlit UI
# 8888: Jupyter Notebook
# 5000: Flask (if needed)
# 3000: Frontend dev server (if needed)
EXPOSE 8000 8501 8888 5000 3000

# Set default command
CMD ["python", "-m", "pytest", "-v"]
