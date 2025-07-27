# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**MANDATORY READING ORDER**: 
1. **This file (CLAUDE.md)** - Core rules and current state
2. **ProjectContextEngineering.md** - Technical architecture and decisions
3. **ProjectTasks.md** - Current tasks and fast start plan

**🚨 CRITICAL**: Always follow the Base PRP Template v2 methodology for ALL feature development.

## 🚀 Project: ULTRA Trading Platform

A next-generation trading platform combining fastquant (backtesting) with Alpaca (live trading) on Cloudflare's edge infrastructure.

## 🔄 Project Awareness & Context

- **Always read `ProjectContextEngineering.md`** for technical decisions and architecture
- **Check `ProjectTasks.md`** before starting work - tasks are prioritized and tracked there
- **Current State**: 
  - ✅ AI APIs fully configured (Anthropic Claude + Google Gemini)
  - ✅ All API keys secured in .env and tested
  - ✅ Python environment with all dependencies installed
  - 🚧 Cloudflare Workers project initialization in progress
- **Target State**: Unified platform on Cloudflare Workers with multi-tenant SaaS architecture
- **GitHub Repository**: https://github.com/ScientiaCapital/trading-backtesting
- **Organization**: ScientiaCapital
- **Cloudflare Account**: Already available and ready to use
- **AI Stack**: Anthropic Claude + Google Gemini (NO OpenAI) - WORKING ✅

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
pip install alpaca-py anthropic google-generativeai langchain chromadb
cd fastquant && pip install -r python/requirements.txt

# Future Cloudflare commands
npx wrangler dev --local --persist
npx wrangler d1 execute ultra-trading --local --command "SELECT * FROM users"
npx wrangler deploy --env production

# Testing
python -m pytest tests/ -v  # Python tests
npm test                    # TypeScript tests

# AI SDK Usage
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
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
    AnalysisAgent      // AI-powered insights using Claude/Gemini
  ]
}
```

### AI Integration Pattern
```typescript
// Universal AI client supporting both providers
class AIService {
  async generateText(provider: 'anthropic' | 'gemini', prompt: string) {
    // Anthropic Claude for complex analysis
    // Google Gemini for quick responses
  }
  async embedText(text: string) {
    // Cloudflare Workers AI for embeddings
  }
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

## 📋 Base PRP Template v2 - MANDATORY METHODOLOGY

**Purpose**: Template optimized for AI agents to implement features with sufficient context and self-validation capabilities to achieve working code through iterative refinement.

### Core Principles (ALWAYS FOLLOW)
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance

### Implementation Blueprint (Required for ALL Features)
1. **Data models and structure** - Create core data models ensuring type safety
2. **Task breakdown** - List tasks in completion order with pseudocode
3. **Integration points** - Database, config, routes with specific patterns
4. **Validation loop** - Syntax, unit tests, integration tests
5. **Final validation checklist** - All tests pass, no errors, documentation updated

### Validation Loop (MANDATORY)
```bash
# Level 1: Syntax & Style (fix FIRST)
ruff check src/ --fix
mypy src/

# Level 2: Unit Tests (use existing patterns)
pytest test_feature.py -v

# Level 3: Integration Test
curl -X POST http://localhost:8000/endpoint
```

### Anti-Patterns to Avoid ❌
- Don't create new patterns when existing ones work
- Don't skip validation because "it should work"
- Don't ignore failing tests - fix them
- Don't use sync functions in async context
- Don't hardcode values that should be config
- Don't catch all exceptions - be specific

## 🧠 AI Behavior Rules

- **Never assume context** - read all three documentation files
- **ALWAYS follow PRP Template v2** - no exceptions
- **Use TodoWrite** for task tracking
- **Validate all code** before marking tasks complete
- **Check existing patterns** before creating new ones
- **Run validation loops** after every change
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