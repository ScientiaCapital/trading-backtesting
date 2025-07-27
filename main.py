"""
FastAPI application for trading backtesting API
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime

# Initialize FastAPI app
app = FastAPI(
    title="Trading Backtesting API",
    description="API for algorithmic trading backtesting and analysis",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class BacktestRequest(BaseModel):
    strategy: str
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float = 10000.0
    parameters: Optional[dict] = {}

class BacktestResponse(BaseModel):
    strategy: str
    symbol: str
    total_return: float
    sharpe_ratio: float
    max_drawdown: float
    trades: int
    win_rate: float

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "0.1.0"
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Trading Backtesting API",
        "endpoints": [
            "/health",
            "/docs",
            "/backtest",
            "/strategies",
            "/symbols"
        ]
    }

# Backtest endpoint
@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest(request: BacktestRequest):
    """
    Run a backtest with the specified parameters
    """
    # TODO: Implement actual backtesting logic
    # This is a placeholder response
    return BacktestResponse(
        strategy=request.strategy,
        symbol=request.symbol,
        total_return=15.5,
        sharpe_ratio=1.2,
        max_drawdown=-8.3,
        trades=42,
        win_rate=0.57
    )

# List available strategies
@app.get("/strategies")
async def list_strategies():
    """
    Get list of available trading strategies
    """
    return {
        "strategies": [
            "moving_average_crossover",
            "rsi_oversold",
            "bollinger_bands",
            "macd_signal",
            "mean_reversion"
        ]
    }

# List available symbols
@app.get("/symbols")
async def list_symbols():
    """
    Get list of available trading symbols
    """
    return {
        "symbols": [
            "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA",
            "SPY", "QQQ", "IWM", "DIA", "VTI"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    
    # Import test endpoints for MCP testing
    from test_mcp_endpoints import (
        mcp_test_quote, 
        mcp_test_backtest, 
        mcp_test_portfolio,
        MOCK_PRICES
    )
    
    # Add test endpoints
    app.get("/api/mcp/market/quote/{symbol}")(mcp_test_quote)
    app.post("/api/mcp/backtest/run")(mcp_test_backtest)
    app.get("/api/mcp/portfolio")(mcp_test_portfolio)
    
    print("🚀 Starting Trading API with MCP test endpoints...")
    print("📋 Test with API key format: tk_test_XXXXX")
    
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
