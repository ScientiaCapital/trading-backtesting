"""
MCP Configuration Generator for Users
This module handles generating personalized MCP configurations for users
"""
import json
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from pydantic import BaseModel
from fastapi import HTTPException

class MCPPermissions(BaseModel):
    can_trade: bool = False
    can_backtest: bool = True
    can_access_realtime: bool = False
    max_requests_per_minute: int = 60
    max_position_size: float = 1000.0
    allowed_symbols: Optional[List[str]] = None

class UserTier(BaseModel):
    name: str
    permissions: MCPPermissions
    
# Define user tiers
TIERS = {
    "free": UserTier(
        name="Free",
        permissions=MCPPermissions(
            can_trade=False,
            can_backtest=True,
            can_access_realtime=False,
            max_requests_per_minute=60,
            max_position_size=0
        )
    ),
    "pro": UserTier(
        name="Pro",
        permissions=MCPPermissions(
            can_trade=True,
            can_backtest=True,
            can_access_realtime=True,
            max_requests_per_minute=300,
            max_position_size=10000
        )
    ),
    "quant": UserTier(
        name="Quant",
        permissions=MCPPermissions(
            can_trade=True,
            can_backtest=True,
            can_access_realtime=True,
            max_requests_per_minute=1000,
            max_position_size=100000
        )
    )
}

class MCPConfigGenerator:
    def __init__(self, base_api_url: str = "https://api.your-platform.com"):
        self.base_api_url = base_api_url
    
    def generate_api_key(self, user_id: str) -> str:
        """Generate a secure API key for the user"""
        # Create a unique key combining user ID and random token
        random_token = secrets.token_urlsafe(32)
        key_data = f"{user_id}:{random_token}:{datetime.utcnow().isoformat()}"
        
        # Create a shorter, more manageable key
        key_hash = hashlib.sha256(key_data.encode()).hexdigest()[:40]
        return f"tk_{key_hash}"
    
    def generate_mcp_config(self, user_id: str, api_key: str, tier: str = "free") -> Dict:
        """Generate the MCP configuration for Claude Desktop"""
        user_tier = TIERS.get(tier, TIERS["free"])
        
        config = {
            "trading-assistant": {
                "command": "npx",
                "args": ["@your-platform/trading-mcp"],
                "env": {
                    "TRADING_API_KEY": api_key,
                    "TRADING_API_URL": self.base_api_url,
                    "TRADING_USER_ID": user_id,
                    "TRADING_TIER": tier,
                    "TRADING_PERMISSIONS": json.dumps(user_tier.permissions.dict())
                }
            }
        }
        
        return config
    
    def generate_installation_script(self, user_id: str, api_key: str, tier: str = "free") -> str:
        """Generate a one-line installation script for the user"""
        config = self.generate_mcp_config(user_id, api_key, tier)
        config_json = json.dumps(config, separators=(',', ':'))
        
        # Create a base64 encoded config for easy copying
        import base64
        config_b64 = base64.b64encode(config_json.encode()).decode()
        
        return f"npx @your-platform/trading-mcp-installer --config {config_b64}"
    
    def generate_user_dashboard_data(self, user_id: str, api_key: str, tier: str = "free") -> Dict:
        """Generate data for user dashboard display"""
        user_tier = TIERS.get(tier, TIERS["free"])
        
        return {
            "api_key": api_key,
            "tier": tier,
            "permissions": user_tier.permissions.dict(),
            "mcp_config": self.generate_mcp_config(user_id, api_key, tier),
            "installation_steps": [
                {
                    "step": 1,
                    "title": "Open Claude Desktop Settings",
                    "description": "Click on your name → Settings → Developer → Edit Config"
                },
                {
                    "step": 2,
                    "title": "Add Trading Assistant",
                    "description": "Copy the configuration below and add it to your mcpServers section",
                    "code": json.dumps(self.generate_mcp_config(user_id, api_key, tier), indent=2)
                },
                {
                    "step": 3,
                    "title": "Restart Claude Desktop",
                    "description": "Quit and reopen Claude Desktop to activate the trading assistant"
                },
                {
                    "step": 4,
                    "title": "Test Your Setup",
                    "description": 'Ask Claude: "What trading tools are available?"'
                }
            ],
            "example_prompts": self._get_example_prompts(tier)
        }
    
    def _get_example_prompts(self, tier: str) -> List[Dict[str, str]]:
        """Get tier-appropriate example prompts"""
        base_prompts = [
            {
                "prompt": "What's the current price of Apple stock?",
                "description": "Get real-time market data"
            },
            {
                "prompt": "Show me a 50-day moving average chart for TSLA",
                "description": "Technical analysis visualization"
            }
        ]
        
        if tier in ["pro", "quant"]:
            base_prompts.extend([
                {
                    "prompt": "Run a backtest of mean reversion strategy on SPY for the last year",
                    "description": "Strategy backtesting"
                },
                {
                    "prompt": "Place a limit order to buy 10 shares of AAPL at $150",
                    "description": "Execute trades (paper or real)"
                }
            ])
        
        if tier == "quant":
            base_prompts.extend([
                {
                    "prompt": "Find all stocks with RSI < 30 and rising volume",
                    "description": "Advanced screening"
                },
                {
                    "prompt": "Optimize my portfolio for maximum Sharpe ratio",
                    "description": "Portfolio optimization"
                }
            ])
        
        return base_prompts

# FastAPI endpoints example
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

app = FastAPI()
config_generator = MCPConfigGenerator()

@app.post("/api/users/{user_id}/generate-mcp-access")
async def generate_mcp_access(
    user_id: str,
    tier: str = "free",
    # db: Session = Depends(get_db)
):
    """Generate MCP access for a user"""
    # Verify user exists and check their tier
    # user = db.query(User).filter(User.id == user_id).first()
    # if not user:
    #     raise HTTPException(status_code=404, detail="User not found")
    
    # Generate API key
    api_key = config_generator.generate_api_key(user_id)
    
    # Save API key to database
    # api_key_record = APIKey(
    #     key=api_key,
    #     user_id=user_id,
    #     tier=tier,
    #     created_at=datetime.utcnow(),
    #     expires_at=datetime.utcnow() + timedelta(days=365)
    # )
    # db.add(api_key_record)
    # db.commit()
    
    # Generate dashboard data
    dashboard_data = config_generator.generate_user_dashboard_data(user_id, api_key, tier)
    
    return {
        "success": True,
        "data": dashboard_data
    }

@app.get("/api/users/{user_id}/mcp-config")
async def get_mcp_config(
    user_id: str,
    # db: Session = Depends(get_db)
):
    """Get user's MCP configuration"""
    # Get user's active API key
    # api_key = db.query(APIKey).filter(
    #     APIKey.user_id == user_id,
    #     APIKey.is_active == True
    # ).first()
    
    # For demo purposes
    api_key = "tk_demo_key_12345"
    tier = "free"
    
    config = config_generator.generate_mcp_config(user_id, api_key, tier)
    
    return {
        "config": config,
        "installation_command": config_generator.generate_installation_script(user_id, api_key, tier)
    }

# React component example for the frontend
REACT_COMPONENT = '''
import React, { useState, useEffect } from 'react';
import { Card, Button, Code, Steps, Alert } from '@/components/ui';

export function MCPSetup({ userId }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchMCPConfig();
  }, [userId]);

  const fetchMCPConfig = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/generate-mcp-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'free' })
      });
      const data = await response.json();
      setConfig(data.data);
    } catch (error) {
      console.error('Failed to fetch MCP config:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div>Loading...</div>;
  if (!config) return <div>Error loading configuration</div>;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold mb-4">Your Trading Assistant Setup</h2>
        
        <Alert className="mb-4">
          <p>API Key: <code>{config.api_key}</code></p>
          <p>Tier: {config.tier}</p>
        </Alert>

        <Steps>
          {config.installation_steps.map((step, index) => (
            <Steps.Item key={index} title={step.title}>
              <p>{step.description}</p>
              {step.code && (
                <div className="mt-2">
                  <Code language="json">{step.code}</Code>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(step.code)}
                    className="mt-2"
                  >
                    {copied ? 'Copied!' : 'Copy Configuration'}
                  </Button>
                </div>
              )}
            </Steps.Item>
          ))}
        </Steps>
      </Card>

      <Card>
        <h3 className="text-xl font-bold mb-4">Example Prompts</h3>
        <div className="space-y-2">
          {config.example_prompts.map((example, index) => (
            <div key={index} className="border rounded p-3">
              <p className="font-medium">{example.prompt}</p>
              <p className="text-sm text-gray-600">{example.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
'''
