# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**MANDATORY READING ORDER**: 
1. **This file (CLAUDE.md)** - Core rules and current state
2. **ProjectContextEngineering.md** - Technical architecture and decisions
3. **ProjectTasks.md** - Current tasks and fast start plan
4. **docs/STRATEGY_CONVERSION_ANALYSIS.md** - Python to TypeScript strategy conversion guide

**🚨 CRITICAL**: Always follow the Base PRP Template v2 methodology for ALL feature development.

## 🚀 Project: ULTRA Trading Platform

A next-generation trading platform combining fastquant (backtesting) with Alpaca (live trading) on Cloudflare's edge infrastructure.

## 🔄 Project Awareness & Context

- **Always read `ProjectContextEngineering.md`** for technical decisions and architecture
- **Check `ProjectTasks.md`** before starting work - tasks are prioritized and tracked there
- **Review `docs/STRATEGY_CONVERSION_ANALYSIS.md`** for strategy conversion patterns
- **Current State**: 
  - ✅ AI APIs fully configured (Anthropic Claude + Google Gemini + Cloudflare Workers AI)
  - ✅ All API keys secured in .env and tested
  - ✅ Python environment with all dependencies installed
  - ✅ Strategy conversion analysis completed with TypeScript examples
  - ✅ Mathematical utilities for options pricing implemented
  - ✅ Gamma Scalping strategy converted to TypeScript
  - ✅ Iron Condor strategy fully implemented in TypeScript
  - ✅ Wheel strategy fully implemented in TypeScript
  - ✅ Cloudflare Workers project fully initialized
  - ✅ D1 Database and KV storage configured
  - ✅ Alpaca Paper Trading API integrated and tested
  - ✅ Authentication working with new credentials
  - ✅ Multi-Agent AI System (7 agents) fully operational
  - ✅ SmartFastDecisionService achieving <15ms decisions
  - ✅ 0DTE options trading with OptionsFlowAnalyst
  - ✅ Real-time market scanning with MarketHoursResearcher
  - ✅ Enhanced RiskManager with LiveStrategyTuner
  - ✅ MultiAssetConnector for unified trading interface
  - ✅ IntradayPatternEngine for scalping patterns
  - ✅ Production deployed at https://ultra-trading.tkipper.workers.dev
  - 🚧 WebSocket integration for real-time updates
  - 🚧 AfterHoursResearcher agent pending
- **Target State**: Unified platform on Cloudflare Workers with multi-tenant SaaS architecture
- **GitHub Repository**: https://github.com/ScientiaCapital/trading-backtesting
- **Organization**: ScientiaCapital
- **Cloudflare Account**: Already available and ready to use
- **AI Stack**: Anthropic Claude + Google Gemini (NO OpenAI) - WORKING ✅

## 📁 Current Repository Structure

```
trading-backtesting/
├── fastquant/                      # Python backtesting library
├── alpaca-py/                      # Alpaca trading SDK  
│   └── examples/options/           # Original Python notebooks
├── quant-agents/                   # Original Python agents (reference)
│   └── personal_trading_system.py  # 6 specialized agents (TypeScript versions implemented)
├── trading_env/                    # Virtual environment
├── context-engineering-intro/      # Context engineering templates
├── docs/                           # Documentation
│   └── STRATEGY_CONVERSION_ANALYSIS.md  # Conversion guide
└── ultra-trading/                  # Cloudflare Workers app ✅
    ├── src/
    │   ├── agents/                 # AI Trading Agents ✅
    │   │   ├── MarketAnalystAgent.ts
    │   │   ├── StrategyOptimizerAgent.ts
    │   │   ├── RiskManagerAgent.ts (with LiveStrategyTuner)
    │   │   ├── PerformanceAnalystAgent.ts
    │   │   ├── ExecutionAgent.ts
    │   │   ├── OptionsFlowAnalyst.ts
    │   │   ├── MarketHoursResearcher.ts
    │   │   └── base/BaseAgent.ts
    │   ├── api/                    # API routes
    │   │   ├── index.ts           # Main router
    │   │   ├── trading.ts         # Alpaca trading endpoints
    │   │   └── agents.ts          # Agent communication endpoints
    │   ├── durable-objects/        # Stateful objects
    │   │   ├── AgentCoordinator.ts # Multi-agent orchestration
    │   │   └── TradingSession.ts   # WebSocket sessions
    │   ├── services/              
    │   │   ├── alpaca/            # Alpaca integration
    │   │   │   ├── AlpacaClient.ts
    │   │   │   ├── AlpacaMarketData.ts
    │   │   │   ├── AlpacaTradingService.ts
    │   │   │   └── AlpacaWebSocketService.ts
    │   │   ├── FastDecisionService.ts      # <20ms decisions
    │   │   ├── SmartFastDecisionService.ts # <15ms with risk mgmt
    │   │   ├── MultiAssetConnector.ts      # Unified asset interface
    │   │   ├── IntradayPatternEngine.ts    # Pattern detection
    │   │   ├── database.ts        # D1 service
    │   │   ├── market-data.ts     # Market data service
    │   │   └── ai.ts              # AI service (Claude/Gemini/CF)
    │   ├── strategies/             # TypeScript strategies ✅
    │   │   ├── GammaScalpingStrategy.ts
    │   │   ├── IronCondorStrategy.ts
    │   │   └── WheelStrategy.ts
    │   ├── utils/
    │   │   ├── options-pricing.ts  # Black-Scholes engine
    │   │   └── TradingTime.ts      # Market hours utility
    │   └── index.ts               # Worker entry point
    ├── migrations/                 # D1 database schemas
    ├── scripts/
    │   ├── convert-notebook.ts     # Jupyter converter
    │   ├── test-alpaca.ts         # Alpaca connection test
    │   ├── debug-alpaca-auth.ts   # Auth debugger
    │   └── test-smart-decision.ts  # Smart decision tester
    └── wrangler.jsonc             # Cloudflare config
```

## 🔄 Strategy Conversion Resources

**Available Resources for Strategy Conversion:**
1. **Converter Script**: `ultra-trading/scripts/convert-notebook.ts`
   - Run: `ts-node scripts/convert-notebook.ts input.ipynb output.ts`
   - Automatically converts Python patterns to TypeScript
   
2. **Example Implementation**: `ultra-trading/src/strategies/GammaScalpingStrategy.ts`
   - Complete TypeScript strategy with all patterns
   - Use as template for other strategies
   
3. **Mathematical Utilities**: `ultra-trading/src/utils/options-pricing.ts`
   - Black-Scholes pricing engine
   - Greeks calculations (Delta, Gamma, Theta, Vega, Rho)
   - Normal distribution functions (replaces scipy.stats)
   - Optimization algorithms (replaces scipy.optimize)
   
4. **Conversion Guide**: `docs/STRATEGY_CONVERSION_ANALYSIS.md`
   - Detailed analysis of all strategies
   - Technical challenges and solutions
   - Implementation checklist

## 🧱 Code Structure & Standards

- **TypeScript** for all Cloudflare Workers code (strict mode)
- **Python** for strategy modules and backtesting
- **Never create files > 500 lines** - split into modules
- **Use Hono framework** for Workers API
- **Follow existing patterns** in alpaca-py examples
- **Package structure**: Monorepo with packages/ directory
- **Strategy Pattern**: All strategies extend `TradingStrategy` base class

## 🧪 Testing Requirements

- **Vitest** for TypeScript/Workers code
- **Pytest** for Python modules
- **Test coverage minimum**: 80%
- **Test patterns**: Happy path, edge cases, error cases
- **Run tests before marking any task complete**
- **Validate mathematical functions** against Python outputs

## 🔧 Development Commands

```bash
# Current environment
source trading_env/bin/activate

# Install dependencies
pip install alpaca-py anthropic google-generativeai langchain chromadb
cd fastquant && pip install -r python/requirements.txt

# Cloudflare Workers Development
cd ultra-trading
npm install
npm run dev                     # Start local development server
npm run test:alpaca            # Test Alpaca API connection
npm run build                  # Build for production
npm run deploy                 # Deploy to Cloudflare
npm run validate               # Run all checks (lint, type-check, test)

# Database Commands
npx wrangler d1 execute ultra-trading --local --file=./migrations/001_initial_schema.sql
npx wrangler d1 execute ultra-trading --local --command "SELECT * FROM users"

# Testing
python -m pytest tests/ -v     # Python tests
npm test                       # TypeScript tests
npm run test:watch            # Watch mode

# Environment Variables
export ALPACA_API_KEY="PKYN9OAQHP1IR05GGAGL"
export ALPACA_API_SECRET="tfezhnS1NvEtu8eT6BkW3fLd1wKIi0Ygc5HILoBl"
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="AIzaSy..."
```

## ⚡ Key Integration Points

- **Strategies Completed**: `ultra-trading/src/strategies/`
  - ✅ GammaScalpingStrategy.ts (with full Greeks calculation)
  - ✅ IronCondorStrategy.ts (four-leg options strategy)
  - ✅ WheelStrategy.ts (cash-secured puts/covered calls)
- **AI Agents Implemented**: `ultra-trading/src/agents/`
  - ✅ MarketAnalystAgent (Gemini Pro) - Market analysis
  - ✅ StrategyOptimizerAgent (Claude Opus) - Strategy optimization
  - ✅ RiskManagerAgent (Llama 3.1) - Risk + LiveStrategyTuner
  - ✅ PerformanceAnalystAgent (Llama 3.1) - P&L tracking
  - ✅ ExecutionAgent (Llama 3.1) - Order execution
  - ✅ OptionsFlowAnalyst (Llama 3.1) - 0DTE options
  - ✅ MarketHoursResearcher (Llama 3.1) - Real-time scanning
- **Fast Decision Services**: `ultra-trading/src/services/`
  - ✅ FastDecisionService - 10-20ms decisions
  - ✅ SmartFastDecisionService - <15ms with risk management
  - ✅ MultiAssetConnector - Unified trading interface
  - ✅ IntradayPatternEngine - Pattern detection <100ms
- **Performance Metrics**:
  - API Response: <50ms (target: <100ms) ✅
  - Decision Speed: 14.40ms average ✅
  - Agent Response: 50ms-2s depending on complexity
  - Pattern Detection: <100ms ✅

## 🛡️ Security & Best Practices

- **Never commit API keys** - use .env files
- **Encrypt Alpaca credentials** before storing in D1
- **Use Cloudflare Access** for authentication
- **Rate limit all API endpoints**
- **Multi-tenant isolation** is critical
- **Keep README.md generic** - we are in STEALTH mode

## 🏗️ Architecture Patterns

### Multi-Agent Pattern (Fully Implemented)
```typescript
// Pattern: Agent Coordinator with 7 Specialized Agents
class AgentCoordinator extends DurableObject {
  agents = new Map([
    [AgentType.MARKET_ANALYST, new MarketAnalystAgent()],      // Gemini Pro
    [AgentType.STRATEGY_OPTIMIZER, new StrategyOptimizerAgent()], // Claude Opus
    [AgentType.RISK_MANAGER, new RiskManagerAgent()],          // Llama 3.1 + LiveTuner
    [AgentType.PERFORMANCE_ANALYST, new PerformanceAnalystAgent()], // Llama 3.1
    [AgentType.EXECUTION, new ExecutionAgent()],               // Llama 3.1
    [AgentType.OPTIONS_FLOW_ANALYST, new OptionsFlowAnalyst()], // Llama 3.1
    [AgentType.MARKET_HOURS_RESEARCHER, new MarketHoursResearcher()] // Llama 3.1
  ]);
  
  // Fast decision services for <15ms responses
  fastDecisionService = new SmartFastDecisionService();
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

### Trading Strategy Pattern
```typescript
// All strategies must extend base class
abstract class TradingStrategy {
  abstract execute(marketData: MarketData): Promise<Signal[]>;
  abstract validate(account: Account): Promise<ValidationResult>;
  abstract calculateRisk(positions: Position[]): RiskMetrics;
}
```

### Fast Decision Pattern
```typescript
// Bypass AI for time-critical decisions (<15ms)
class SmartFastDecisionService {
  async getQuickDecision(
    marketData: MarketSnapshot[],
    positions: Position[],
    dailyPnL: number,
    accountValue: number
  ): Promise<TradingDecision> {
    // 1. Analyze market context
    const context = this.analyzeMarketContext(marketData);
    
    // 2. Multi-factor validation
    if (!this.shouldTrade(context, positions, dailyPnL)) {
      return this.createWaitDecision('Risk limits exceeded');
    }
    
    // 3. Technical scoring
    const score = this.calculateTechnicalScore(marketData, context);
    
    // 4. Generate decision with metadata
    return this.generateDecision(score, context);
  }
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
npm run lint
npm run type-check

# Level 2: Unit Tests (use existing patterns)
npm test

# Level 3: Integration Test
curl -X POST http://localhost:8787/api/v1/endpoint
```

### Anti-Patterns to Avoid ❌
- Don't create new patterns when existing ones work
- Don't skip validation because "it should work"
- Don't ignore failing tests - fix them
- Don't use sync functions in async context
- Don't hardcode values that should be config
- Don't catch all exceptions - be specific

## 🧠 AI Behavior Rules

- **Never assume context** - read all documentation files
- **ALWAYS follow PRP Template v2** - no exceptions
- **Review strategy conversion docs** before implementing strategies
- **Use existing mathematical utilities** - don't reimplement
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
- "Convert trading strategies"

❌ Avoid (Too Specific):
- "Add Cloudflare Workers API"
- "Implement multi-tenant SaaS"
- "Add ULTRA platform features"
- "Setup Alpaca live trading"
- "Convert Gamma Scalping for options"

## 🚀 Success Metrics

Track these in ProjectTasks.md:
- Sub-100ms API response times ✅ (Achieved: <50ms)
- Sub-15ms trading decisions ✅ (Achieved: 14.40ms average)
- 99.9% uptime ✅ (Cloudflare edge)
- Zero cold starts ✅ (V8 isolates)
- 80% cost reduction vs traditional cloud ✅
- 90%+ test coverage (In Progress: 25%)
- Strategy conversion accuracy: Greeks within 0.01% ✅
- 7 AI agents operational ✅
- 0DTE options trading enabled ✅
- Real-time market scanning every 30s ✅

## 📚 Required Reading Order

1. This file (CLAUDE.md)
2. ProjectContextEngineering.md - Technical deep dive
3. ProjectTasks.md - Current tasks and progress
4. docs/STRATEGY_CONVERSION_ANALYSIS.md - Conversion patterns

Always maintain stealth mode in public-facing documentation.