# Complete MCP Trading Assistant Implementation Guide

## Overview

This guide shows how to implement a system where users can install an MCP tool in Claude Desktop to turn it into a personal quant trading assistant.

## Architecture Components

### 1. **MCP Server Package** (`trading-mcp-server/`)
- Node.js/TypeScript MCP server
- Communicates with your backend API
- Provides trading tools to Claude

### 2. **Backend API** (FastAPI/Python)
- User authentication & API key management
- Trading operations proxy
- Data aggregation from multiple sources
- Security & rate limiting

### 3. **Frontend Dashboard** (React/Next.js)
- User registration
- MCP setup instructions
- API key management
- Usage analytics

## Implementation Steps

### Step 1: Backend API Setup

```python
# main.py - Add to your existing FastAPI app

from mcp_config_generator import MCPConfigGenerator, TIERS
from database import User, APIKey, get_db

config_generator = MCPConfigGenerator(
    base_api_url="https://api.your-platform.com"
)

# Middleware for MCP authentication
@app.middleware("http")
async def mcp_auth_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/mcp/"):
        api_key = request.headers.get("Authorization", "").replace("Bearer ", "")
        
        # Validate API key
        with get_db() as db:
            key_record = db.query(APIKey).filter(
                APIKey.key == api_key,
                APIKey.is_active == True
            ).first()
            
            if not key_record:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Invalid API key"}
                )
            
            # Add user context to request
            request.state.user_id = key_record.user_id
            request.state.tier = key_record.tier
    
    response = await call_next(request)
    return response

# MCP-specific endpoints
@app.get("/api/mcp/market/quote/{symbol}")
async def mcp_get_quote(symbol: str, request: Request):
    """Get stock quote - used by MCP tool"""
    tier = request.state.tier
    
    # Check permissions
    if tier == "free":
        # Return delayed data
        data = await get_delayed_quote(symbol)
    else:
        # Return real-time data
        data = await get_realtime_quote(symbol)
    
    return {
        "symbol": symbol,
        "price": data["price"],
        "change": data["change"],
        "volume": data["volume"],
        "timestamp": data["timestamp"],
        "data_type": "delayed" if tier == "free" else "realtime"
    }

@app.post("/api/mcp/backtest/run")
async def mcp_run_backtest(
    request: Request,
    strategy: str,
    symbol: str,
    start_date: str,
    end_date: str,
    capital: float = 10000
):
    """Run backtest - used by MCP tool"""
    user_id = request.state.user_id
    tier = request.state.tier
    
    # Check backtest limits
    if tier == "free":
        # Check daily limit
        today_count = await get_user_backtest_count_today(user_id)
        if today_count >= 10:
            raise HTTPException(
                status_code=429,
                detail="Daily backtest limit reached (10/day for free tier)"
            )
    
    # Run backtest
    results = await run_backtest_engine(
        strategy=strategy,
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        capital=capital
    )
    
    # Log usage
    await log_api_usage(user_id, "backtest", request.state.tier)
    
    return results
```

### Step 2: Database Schema

```python
# models.py
from sqlalchemy import Column, String, Boolean, DateTime, Float, JSON
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True)
    tier = Column(String, default="free")
    created_at = Column(DateTime)
    
class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(String, primary_key=True)
    key = Column(String, unique=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    tier = Column(String)
    permissions = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime)
    last_used_at = Column(DateTime, nullable=True)
    
class APIUsage(Base):
    __tablename__ = "api_usage"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    endpoint = Column(String)
    timestamp = Column(DateTime)
    response_time_ms = Column(Float)
    status_code = Column(Integer)
```

### Step 3: Frontend Integration

```typescript
// pages/dashboard/mcp-setup.tsx
import { useState, useEffect } from 'react';
import { Card, Button, Code, Steps, Alert, Tabs } from '@/components/ui';

export default function MCPSetupPage() {
  const [setupData, setSetupData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateMCPAccess();
  }, []);

  const generateMCPAccess = async () => {
    try {
      const response = await fetch('/api/users/me/generate-mcp-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const data = await response.json();
      setSetupData(data.data);
    } catch (error) {
      console.error('Failed to generate MCP access:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Turn Claude into Your Trading Assistant
      </h1>

      <Tabs defaultValue="setup">
        <Tabs.List>
          <Tabs.Trigger value="setup">Setup Guide</Tabs.Trigger>
          <Tabs.Trigger value="config">Configuration</Tabs.Trigger>
          <Tabs.Trigger value="examples">Examples</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="setup">
          <SetupInstructions data={setupData} />
        </Tabs.Content>

        <Tabs.Content value="config">
          <ConfigurationView data={setupData} />
        </Tabs.Content>

        <Tabs.Content value="examples">
          <ExamplePrompts prompts={setupData.example_prompts} />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
```

### Step 4: MCP Server Deployment

```bash
# Build and publish the MCP package
cd trading-mcp-server
npm install
npm run build
npm publish --access public
```

### Step 5: Usage Tracking & Analytics

```python
# analytics.py
from datetime import datetime, timedelta
import asyncio
from collections import defaultdict

class UsageAnalytics:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def track_api_call(self, user_id: str, endpoint: str, tier: str):
        """Track API usage for rate limiting and analytics"""
        now = datetime.utcnow()
        
        # Increment counters
        keys = [
            f"usage:{user_id}:minute:{now.strftime('%Y%m%d%H%M')}",
            f"usage:{user_id}:hour:{now.strftime('%Y%m%d%H')}",
            f"usage:{user_id}:day:{now.strftime('%Y%m%d')}",
            f"usage:{tier}:endpoint:{endpoint}:day:{now.strftime('%Y%m%d')}"
        ]
        
        pipe = self.redis.pipeline()
        for key in keys:
            pipe.incr(key)
            pipe.expire(key, 86400 * 7)  # 7 days retention
        
        await pipe.execute()
    
    async def check_rate_limit(self, user_id: str, tier: str) -> bool:
        """Check if user has exceeded rate limit"""
        limits = {
            "free": 60,
            "pro": 300,
            "quant": 1000
        }
        
        limit = limits.get(tier, 60)
        now = datetime.utcnow()
        key = f"usage:{user_id}:minute:{now.strftime('%Y%m%d%H%M')}"
        
        count = await self.redis.get(key)
        return int(count or 0) < limit
    
    async def get_user_stats(self, user_id: str) -> dict:
        """Get usage statistics for user dashboard"""
        now = datetime.utcnow()
        
        stats = {
            "today": await self.redis.get(
                f"usage:{user_id}:day:{now.strftime('%Y%m%d')}"
            ) or 0,
            "this_month": 0,
            "by_endpoint": {}
        }
        
        # Aggregate monthly stats
        for i in range(30):
            day = now - timedelta(days=i)
            day_key = f"usage:{user_id}:day:{day.strftime('%Y%m%d')}"
            count = await self.redis.get(day_key)
            if count:
                stats["this_month"] += int(count)
        
        return stats
```

### Step 6: Monetization Implementation

```python
# billing.py
import stripe
from datetime import datetime, timedelta

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

class BillingManager:
    PLANS = {
        "free": {
            "price": 0,
            "stripe_price_id": None
        },
        "pro": {
            "price": 29.99,
            "stripe_price_id": "price_pro_monthly"
        },
        "quant": {
            "price": 99.99,
            "stripe_price_id": "price_quant_monthly"
        }
    }
    
    async def create_checkout_session(self, user_id: str, tier: str):
        """Create Stripe checkout session for upgrade"""
        plan = self.PLANS.get(tier)
        if not plan["stripe_price_id"]:
            raise ValueError("Invalid plan")
        
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": plan["stripe_price_id"],
                "quantity": 1
            }],
            mode="subscription",
            success_url=f"{BASE_URL}/dashboard/mcp-setup?upgraded=true",
            cancel_url=f"{BASE_URL}/pricing",
            client_reference_id=user_id,
            metadata={
                "user_id": user_id,
                "tier": tier
            }
        )
        
        return session.url
    
    async def handle_webhook(self, event):
        """Handle Stripe webhook events"""
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = session["client_reference_id"]
            tier = session["metadata"]["tier"]
            
            # Update user tier
            await self.upgrade_user_tier(user_id, tier)
            
            # Update API keys with new permissions
            await self.update_api_key_permissions(user_id, tier)
```

## Testing the Complete System

### 1. Local Testing
```bash
# Start your backend
cd trading-backtesting
./services.sh api

# In another terminal, test MCP server
cd trading-mcp-server
npm run dev
```

### 2. Integration Testing
```python
# test_mcp_integration.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_mcp_flow():
    async with AsyncClient(base_url="http://localhost:8000") as client:
        # 1. Register user
        response = await client.post("/api/users/register", json={
            "email": "test@example.com",
            "password": "secure123"
        })
        assert response.status_code == 201
        user_data = response.json()
        
        # 2. Generate MCP access
        response = await client.post(
            f"/api/users/{user_data['id']}/generate-mcp-access",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        assert response.status_code == 200
        mcp_data = response.json()
        
        # 3. Test MCP endpoint with generated API key
        response = await client.get(
            "/api/mcp/market/quote/AAPL",
            headers={"Authorization": f"Bearer {mcp_data['data']['api_key']}"}
        )
        assert response.status_code == 200
```

## Production Deployment

### 1. Backend Deployment (Docker)
```dockerfile
# Dockerfile.api
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. MCP Server Deployment (NPM)
```json
// package.json
{
  "name": "@your-platform/trading-mcp",
  "version": "1.0.0",
  "bin": {
    "trading-mcp": "./dist/index.js"
  },
  "files": [
    "dist/**/*"
  ],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### 3. Monitoring & Observability
```python
# monitoring.py
from prometheus_client import Counter, Histogram, Gauge

# Metrics
api_calls = Counter('mcp_api_calls_total', 'Total API calls', ['endpoint', 'tier'])
api_latency = Histogram('mcp_api_latency_seconds', 'API latency', ['endpoint'])
active_users = Gauge('mcp_active_users', 'Active MCP users', ['tier'])

# Middleware to track metrics
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    # Track metrics
    if request.url.path.startswith("/api/mcp/"):
        duration = time.time() - start_time
        endpoint = request.url.path
        tier = getattr(request.state, 'tier', 'unknown')
        
        api_calls.labels(endpoint=endpoint, tier=tier).inc()
        api_latency.labels(endpoint=endpoint).observe(duration)
    
    return response
```

## Success Metrics Dashboard

```sql
-- Key metrics queries
-- Daily Active Users
SELECT COUNT(DISTINCT user_id) as dau
FROM api_usage
WHERE timestamp >= CURRENT_DATE;

-- API Usage by Tier
SELECT 
    u.tier,
    COUNT(*) as api_calls,
    AVG(au.response_time_ms) as avg_latency
FROM api_usage au
JOIN users u ON u.id = au.user_id
WHERE au.timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.tier;

-- Most Used Features
SELECT 
    endpoint,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users
FROM api_usage
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY endpoint
ORDER BY usage_count DESC;

-- Conversion Funnel
SELECT 
    COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN id END) as new_users,
    COUNT(DISTINCT CASE WHEN tier = 'pro' THEN id END) as pro_users,
    COUNT(DISTINCT CASE WHEN tier = 'quant' THEN id END) as quant_users
FROM users;
```

This complete implementation allows users to:
1. Sign up on your website
2. Get a personalized MCP configuration
3. Install it in Claude Desktop
4. Use Claude as their personal quant trading assistant

The system includes proper security, rate limiting, monetization, and analytics to build a sustainable business around it.
