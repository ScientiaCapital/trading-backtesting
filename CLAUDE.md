# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT**: After reading this file, you MUST read ProjectContextEngineering.md and ProjectTasks.md in that order.

## 🚀 Project: ULTRA Trading Platform

A next-generation trading platform combining fastquant (backtesting) with Alpaca (live trading) on Cloudflare's edge infrastructure.

## 🔄 Project Awareness & Context

- **Always read `ProjectContextEngineering.md`** for technical decisions and architecture
- **Check `ProjectTasks.md`** before starting work - tasks are prioritized and tracked there
- **Current State**: Two separate libraries (fastquant, alpaca-py) that need integration
- **Target State**: Unified platform on Cloudflare Workers with multi-tenant SaaS architecture
- **GitHub Repository**: https://github.com/ScientiaCapital/trading-backtesting
- **Organization**: ScientiaCapital
- **Cloudflare Account**: Already available and ready to use

## 📁 Current Repository Structure

```
trading-backtesting/
├── fastquant/           # Python backtesting library
├── alpaca-py/          # Alpaca trading SDK  
├── trading_env/        # Virtual environment
└── context-engineering-intro/  # Context engineering templates
```

## 🧱 Code Structure & Standards

- **TypeScript** for all Cloudflare Workers code (strict mode)
- **Python** for strategy modules and backtesting
- **Never create files > 500 lines** - split into modules
- **Use Hono framework** for Workers API
- **Follow existing patterns** in alpaca-py examples
- **Package structure**: Monorepo with packages/ directory

## 🧪 Testing Requirements

- **Vitest** for TypeScript/Workers code
- **Pytest** for Python modules
- **Test coverage minimum**: 80%
- **Test patterns**: Happy path, edge cases, error cases
- **Run tests before marking any task complete**

## 🔧 Development Commands

```bash
# Current environment
source trading_env/bin/activate

# Install dependencies
pip install alpaca-py
cd fastquant && pip install -r python/requirements.txt

# Future Cloudflare commands
npx wrangler dev --local
npx wrangler d1 execute trading-db --local --command "SELECT * FROM users"
npx wrangler deploy --env production

# Testing
python -m pytest tests/ -v  # Python tests
npm test                    # TypeScript tests
```

## ⚡ Key Integration Points

- **Notebooks to Convert**: `alpaca-py/examples/options/*.ipynb`
  - options-gamma-scalping.ipynb (Priority 1)
  - options-iron-condor.ipynb
  - options-wheel-strategy.ipynb
- **Fastquant Strategies**: `fastquant/python/fastquant/strategies/`
- **Backtest Engine**: `fastquant/python/fastquant/backtest/backtest.py`

## 🛡️ Security & Best Practices

- **Never commit API keys** - use .env files
- **Encrypt Alpaca credentials** before storing in D1
- **Use Cloudflare Access** for authentication
- **Rate limit all API endpoints**
- **Multi-tenant isolation** is critical
- **Keep README.md generic** - we are in STEALTH mode

## 🏗️ Architecture Patterns

### Multi-Agent Pattern (from context-engineering-intro)
```typescript
// Pattern: Agent as Tool for Complex Operations
class TradingAgent {
  tools = [
    BacktestAgent,     // Delegates to fastquant
    AlpacaAgent,       // Handles live trading
    AnalysisAgent      // AI-powered insights
  ]
}
```

### Service Pattern
```typescript
// All services follow this pattern
class ServiceName {
  constructor(private deps: ServiceDeps) {}
  async execute(params: ValidatedParams): Promise<Result> {}
}
```

## 🧠 AI Behavior Rules

- **Never assume context** - read all three documentation files
- **Follow PRP methodology** from context-engineering-intro
- **Use TodoWrite** for task tracking
- **Validate all code** before marking tasks complete
- **Check existing patterns** before creating new ones
- **Run linting and tests** after every change
- **Keep commits generic** to maintain stealth mode

## 📝 Commit Message Guidelines

✅ Good (Stealth):
- "Add data integration module"
- "Implement strategy backtesting"
- "Update documentation"
- "Add performance optimizations"

❌ Avoid (Too Specific):
- "Add Cloudflare Workers API"
- "Implement multi-tenant SaaS"
- "Add ULTRA platform features"
- "Setup Alpaca live trading"

## 🚀 Success Metrics

Track these in ProjectTasks.md:
- Sub-100ms API response times
- 99.9% uptime
- Zero cold starts
- 80% cost reduction vs traditional cloud
- 90%+ test coverage

## 📚 Required Reading Order

1. This file (CLAUDE.md)
2. ProjectContextEngineering.md - Technical deep dive
3. ProjectTasks.md - Current tasks and progress

Always maintain stealth mode in public-facing documentation.