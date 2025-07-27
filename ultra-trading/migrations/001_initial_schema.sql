-- ULTRA Trading Platform - Initial Database Schema
-- Multi-tenant database design with proper indexes and constraints

-- Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT CHECK(plan IN ('free', 'pro', 'enterprise')) DEFAULT 'free',
    settings TEXT DEFAULT '{}', -- JSON blob for organization settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT CHECK(role IN ('admin', 'trader', 'viewer')) DEFAULT 'trader',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trading Strategies
CREATE TABLE IF NOT EXISTS strategies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK(type IN ('mean_reversion', 'momentum', 'pairs_trading', 'options_gamma_scalping', 'crypto_arbitrage', 'custom')) NOT NULL,
    parameters TEXT DEFAULT '{}', -- JSON blob for strategy parameters
    enabled BOOLEAN DEFAULT FALSE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backtest Results
CREATE TABLE IF NOT EXISTS backtest_results (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    total_return REAL NOT NULL,
    annual_return REAL NOT NULL,
    sharpe_ratio REAL NOT NULL,
    max_drawdown REAL NOT NULL,
    win_rate REAL NOT NULL,
    profit_factor REAL NOT NULL,
    total_trades INTEGER NOT NULL,
    avg_trade_duration REAL NOT NULL,
    benchmark_return REAL,
    parameters TEXT DEFAULT '{}', -- JSON blob for backtest parameters
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trading Orders
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT CHECK(side IN ('buy', 'sell')) NOT NULL,
    order_type TEXT CHECK(order_type IN ('market', 'limit', 'stop', 'stop_limit')) NOT NULL,
    quantity REAL NOT NULL,
    price REAL,
    status TEXT CHECK(status IN ('pending', 'filled', 'partially_filled', 'cancelled', 'rejected')) DEFAULT 'pending',
    filled_quantity REAL DEFAULT 0,
    avg_fill_price REAL,
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market Data Cache
CREATE TABLE IF NOT EXISTS market_data (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    price REAL NOT NULL,
    volume REAL,
    bid REAL,
    ask REAL,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    timestamp TIMESTAMP NOT NULL,
    data_source TEXT DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys and Credentials (encrypted)
CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'alpaca', 'polygon', 'ib', etc.
    name TEXT NOT NULL, -- User-friendly name
    encrypted_data TEXT NOT NULL, -- Encrypted JSON blob
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT DEFAULT '{}', -- JSON blob
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_strategies_tenant_id ON strategies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_strategies_created_by ON strategies(created_by);
CREATE INDEX IF NOT EXISTS idx_strategies_type ON strategies(type);
CREATE INDEX IF NOT EXISTS idx_backtest_results_strategy_id ON backtest_results(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_tenant_id ON backtest_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_strategy_id ON orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_credentials_tenant_id ON credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credentials_provider ON credentials(provider);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Insert demo data for development
INSERT OR IGNORE INTO organizations (id, name, slug, plan) VALUES 
    ('org-demo', 'Demo Organization', 'demo', 'pro');

INSERT OR IGNORE INTO users (id, email, name, tenant_id, role) VALUES 
    ('user-demo', 'demo@ultra-trading.dev', 'Demo User', 'org-demo', 'admin');

INSERT OR IGNORE INTO strategies (id, name, description, type, tenant_id, created_by, enabled) VALUES 
    ('strategy-demo', 'Demo Mean Reversion Strategy', 'A sample mean reversion strategy for demonstration', 'mean_reversion', 'org-demo', 'user-demo', TRUE);