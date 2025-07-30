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
  - ✅ Multi-Agent AI System (7 agents) fully operational
  - ✅ FastDecisionService consolidated (SmartFastDecisionService merged)
  - ✅ 0DTE options trading with OptionsFlowAnalyst
  - ✅ Real-time market scanning with MarketHoursResearcher
  - ✅ Enhanced RiskManager with LiveStrategyTuner
  - ✅ MultiAssetConnector for unified trading interface
  - ✅ IntradayPatternEngine for scalping patterns
  - ✅ TechnicalIndicators service with @ixjb94/indicators integration
  - ✅ Production deployed at https://ultra-trading.tkipper.workers.dev
  - ✅ TypeScript build errors FULLY RESOLVED (0 errors with strict type checking)
  - ✅ ESLint errors reduced from 418 to 24 (94% improvement)
  - ✅ All JSON parsing now has proper type assertions
  - ✅ Type safety across entire codebase with proper error handling
  - ✅ Anthropic and Google Gemini cookbooks reviewed
  - ✅ ContextualRAG services implemented (49% retrieval improvement)
  - 🚧 AutoRAG integration with Cloudflare (in progress)
  - 🚧 Structured Output services with Gemini (pending)
  - 🚧 Hierarchical Summarization system (pending)
  - 🚧 CandlestickPatterns service - 60+ patterns (pending)
  - 🚧 Knowledge Base infrastructure with D1 + Vectorize (pending)
  - 🚧 Cloudflare Vectorize indexes configuration (pending)
  - 🚧 AI Orchestrator integration layer (pending)
  - 🚧 AfterHoursResearcher agent (pending)
- **Target State**: Unified platform on Cloudflare Workers with multi-tenant SaaS architecture
- **GitHub Repository**: https://github.com/ScientiaCapital/trading-backtesting
- **Organization**: ScientiaCapital
- **Cloudflare Account**: Already available and ready to use
- **AI Stack**: Anthropic Claude + Google Gemini (NO OpenAI) - WORKING ✅

[... rest of the existing content remains the same ...]

## 🛡️ Anti-Patterns to Avoid

- ❌ Don't create new patterns when ContextualRAG works
- ❌ Don't skip TypeScript fixes - they block everything
- ❌ Don't hardcode model names - use config
- ❌ Don't catch all exceptions - be specific
- ❌ Don't exceed 500 lines per file
- ❌ Don't use sync functions in Workers

[... rest of the existing content remains the same ...]