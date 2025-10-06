# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**MANDATORY READING ORDER**: 
1. **This file (CLAUDE.md)** - Core rules and current state
2. **ProjectContextEngineering.md** - Technical architecture and decisions
3. **ProjectTasks.md** - Current tasks and fast start plan

## 🚀 Project: ULTRA Trading Platform MVP

A simplified trading platform MVP focused on strategy backtesting, deployed on Vercel with NEON PostgreSQL.

## 🔄 Project Awareness & Context

- **Always read `ProjectContextEngineering.md`** for technical decisions and architecture
- **Check `ProjectTasks.md`** before starting work - tasks are prioritized and tracked there
- **Current State**: 
  - ✅ MVP Created: Simple Iron Condor backtester
  - ✅ NEON PostgreSQL database connected
  - ✅ Express.js API with backtest endpoints
  - ✅ Simple HTML/CSS/JS frontend
  - ✅ Ready for Vercel deployment
  - ✅ All Cloudflare dependencies removed
  - ✅ Reduced from 22,558 files to < 10 files
  - ✅ Reduced from 1.47GB to < 1MB (excluding node_modules)
- **MVP Location**: `/ultra-mvp` directory
- **Tech Stack**: Node.js + Express + NEON + Vercel
- **GitHub Repository**: https://github.com/ScientiaCapital/trading-backtesting
- **Organization**: ScientiaCapital

[... rest of the existing content remains the same ...]

## 🛡️ Anti-Patterns to Avoid

- ❌ Don't create new patterns when ContextualRAG works
- ❌ Don't skip TypeScript fixes - they block everything
- ❌ Don't hardcode model names - use config
- ❌ Don't catch all exceptions - be specific
- ❌ Don't exceed 500 lines per file
- ❌ Don't use sync functions in Workers

[... rest of the existing content remains the same ...]