# TASK.md - Current Work Tracking

**Project**: Iron Condor Trading Backtester
**Tech Stack**: Node.js, Express, NEON PostgreSQL, Vercel
**Location**: `/Users/tmkipper/Desktop/tk_projects/trading-backtesting/ultra-mvp`
**Test Command**: `npm test`

---

## Critical Rules
- ❌ **NO OpenAI models**
- ❌ **API keys in .env only**
- ✅ Run `npm test` before every commit

---

## Current Sprint

**Sprint**: MVP Development
**Start Date**: 2025-11-30
**End Date**: 2025-12-15
**Goal**: Launch basic Iron Condor backtesting platform

---

## Active Tasks

### 🔥 In Progress

#### Task: Database Schema Setup
**Priority**: HIGH
**Assigned**: Dev Team
**Started**: 2025-11-30
**Estimated**: 2 hours

**Description**: Create initial NEON PostgreSQL schema for backtests and market data.

**Subtasks**:
- [ ] Create migration file: `migrations/001_initial_schema.sql`
- [ ] Define `backtests` table
- [ ] Define `market_data` table
- [ ] Add indexes for performance
- [ ] Test migration up/down
- [ ] Verify schema with `npm run db:inspect`

**Acceptance Criteria**:
- [ ] Migrations run successfully
- [ ] Can insert/query backtests
- [ ] Can insert/query market data
- [ ] Indexes improve query performance

**Notes**:
- Use JSONB for strategy parameters (flexibility)
- NEON connection pooling configured
- NO OpenAI fields in schema

---

### 📋 Planned (This Sprint)

#### Task: Black-Scholes Implementation
**Priority**: HIGH
**Estimated**: 3 hours

**Description**: Implement Black-Scholes options pricing model.

**Subtasks**:
- [ ] Create `src/lib/pricing.js`
- [ ] Implement `blackScholesCall()`
- [ ] Implement `blackScholesPut()`
- [ ] Add normal CDF helper function
- [ ] Write unit tests (> 80% coverage)
- [ ] Validate against textbook examples

**Acceptance Criteria**:
- [ ] Calculations match Hull textbook (p. 342)
- [ ] ATM call delta ≈ 0.5
- [ ] Test coverage > 80%
- [ ] Calculation time < 50ms

**References**:
- Hull, J. (2018). "Options, Futures, and Other Derivatives", Chapter 15

---

#### Task: Greeks Calculation
**Priority**: MEDIUM
**Estimated**: 2 hours

**Description**: Calculate Delta, Gamma, Theta, Vega for options.

**Subtasks**:
- [ ] Create `src/lib/greeks.js`
- [ ] Implement Delta calculation
- [ ] Implement Gamma calculation
- [ ] Implement Theta calculation
- [ ] Implement Vega calculation
- [ ] Write comprehensive tests

**Acceptance Criteria**:
- [ ] All Greeks match known benchmarks
- [ ] Put-call parity validated
- [ ] Edge cases handled (T→0, extreme vol)
- [ ] NO OpenAI used

---

#### Task: Iron Condor Backtest Logic
**Priority**: HIGH
**Estimated**: 4 hours

**Description**: Implement core Iron Condor backtesting algorithm.

**Subtasks**:
- [ ] Create `src/lib/strategies/ironCondor.js`
- [ ] Define entry/exit rules
- [ ] Calculate P&L for each trade
- [ ] Track win rate, max drawdown
- [ ] Add realistic slippage/commissions
- [ ] Write integration tests

**Acceptance Criteria**:
- [ ] Backtest produces consistent results
- [ ] No look-ahead bias
- [ ] Handles expiration correctly
- [ ] Performance < 5s for 1 year

**Validation**:
- Test with SPY historical data (2023)
- Compare with manual calculations
- Verify no survivorship bias

---

#### Task: API Endpoints
**Priority**: MEDIUM
**Estimated**: 3 hours

**Description**: Create REST API for backtesting.

**Endpoints**:
- `POST /api/backtests` - Start new backtest
- `GET /api/backtests/:id` - Get results
- `GET /api/backtests` - List all backtests
- `POST /api/pricing/black-scholes` - Price option

**Subtasks**:
- [ ] Create route files
- [ ] Add request validation
- [ ] Add error handling
- [ ] Write API tests (Supertest)
- [ ] Document in `docs/api.md`

**Acceptance Criteria**:
- [ ] All endpoints return correct schemas
- [ ] Error handling comprehensive
- [ ] Response times < 500ms
- [ ] Rate limiting configured

---

### ⏸️ Blocked

_No blocked tasks currently_

---

## Backlog (Future Sprints)

### High Priority
- [ ] Market data ingestion (Alpha Vantage or Polygon)
- [ ] Frontend dashboard (React)
- [ ] User authentication
- [ ] Backtest result visualization

### Medium Priority
- [ ] Additional strategies (straddles, spreads)
- [ ] Portfolio optimization (NO AI)
- [ ] Risk metrics dashboard
- [ ] Historical volatility calculation

### Low Priority
- [ ] Export results to CSV
- [ ] Email notifications
- [ ] Multi-symbol backtests
- [ ] Mobile-responsive design

---

## Completed Tasks

### ✅ Sprint 0 (Setup)

#### Task: Project Initialization
**Completed**: 2025-11-30

**What Was Done**:
- [x] Created project structure
- [x] Initialized npm project
- [x] Set up NEON database account
- [x] Configured Vercel deployment
- [x] Created `.env` template
- [x] Added `.gitignore` (no .env files)

**Outcome**: Project ready for development

---

#### Task: Context Engineering Files
**Completed**: 2025-11-30

**What Was Done**:
- [x] Created `.claude/commands/validate.md`
- [x] Created `.claude/commands/generate-prp.md`
- [x] Created `.claude/commands/execute-prp.md`
- [x] Created `PRPs/templates/prp_base.md`
- [x] Created `PLANNING.md`
- [x] Created `TASK.md` (this file)

**Outcome**: Development workflow documented

---

## Testing Status

### Test Coverage
| Module | Coverage | Target | Status |
|--------|----------|--------|--------|
| Pricing | 0% | 80% | 🔴 Not Started |
| Greeks | 0% | 80% | 🔴 Not Started |
| Iron Condor | 0% | 80% | 🔴 Not Started |
| API | 0% | 80% | 🔴 Not Started |

### Known Test Issues
_None yet - development just starting_

---

## Deployment Status

### Environments
| Environment | Status | URL | Last Deploy |
|-------------|--------|-----|-------------|
| Production | ⏸️ Not Deployed | TBD | N/A |
| Staging | ⏸️ Not Deployed | TBD | N/A |
| Development | ✅ Local | localhost:8001 | N/A |

### Pre-Deploy Checklist
- [ ] All tests passing
- [ ] Test coverage > 80%
- [ ] Performance benchmarks met
- [ ] Security audit clean (`npm audit`)
- [ ] Documentation updated
- [ ] Environment variables configured in Vercel
- [ ] NO OpenAI dependencies

---

## Daily Standup Notes

### 2025-11-30
**Yesterday**: Project initialization
**Today**: Database schema + Black-Scholes implementation
**Blockers**: None

**Progress**:
- ✅ Created all context engineering files
- ✅ Documented architecture decisions
- 🔄 Starting database schema

**Risks**:
- Need to validate Black-Scholes against known benchmarks
- NEON database connection pooling needs testing

---

## Week in Review

### Week of 2025-11-25
**Goals**:
- [x] Initialize project
- [ ] Complete database schema
- [ ] Implement Black-Scholes

**Achieved**:
- Project structure created
- Documentation complete
- Ready to start development

**Missed**:
- Database schema (moving to next week)
- Black-Scholes implementation (next week)

**Next Week Focus**:
- Complete MVP backend (pricing + backtesting)
- Deploy to Vercel staging
- Start frontend dashboard

---

## Metrics

### Development Velocity
- **Sprint 0**: 6 tasks completed (setup)
- **Sprint 1**: 0 tasks completed (just started)

### Quality Metrics
- **Test Coverage**: 0% (target: 80%)
- **Security Issues**: 0 (npm audit clean)
- **Performance**: Not measured yet

---

## Important Reminders

### Before Every Commit
1. Run `npm test`
2. Run `npm run lint`
3. Check no OpenAI imports
4. Verify .env not committed

### Before Every PR
1. Run `/validate` command
2. Test coverage > 80%
3. Update TASK.md
4. Update PLANNING.md if architecture changed

### Before Deploy
1. Full validation suite
2. Performance benchmarks
3. Security audit
4. Environment variables verified

---

## Questions & Decisions Needed

### Open Questions
1. Which market data provider? (Alpha Vantage vs Polygon)
2. Should we support American options? (needs binomial model)
3. What commissions to use for backtests? ($0.65/contract standard?)

### Pending Decisions
_None currently_

---

## Notes & Ideas

### Ideas for Future
- Could add Monte Carlo simulation (NO AI - just random walks)
- Volatility smile/skew visualization
- Greeks heatmaps
- Risk-adjusted returns (Sharpe ratio)

### Things to Avoid
- ❌ Using OpenAI for any calculations
- ❌ Adding too many features before MVP
- ❌ Overengineering database schema
- ❌ Skipping tests "because it's simple"

---

## Quick Reference

### Common Commands
```bash
# Development
npm run dev

# Testing
npm test
npm test -- --coverage
npm run test:watch

# Database
npm run migrate:up
npm run migrate:down
npm run db:inspect

# Deployment
vercel --prod

# Validation
/validate
```

### Key Files
- **Config**: `/ultra-mvp/.env` (not committed)
- **Database**: `/ultra-mvp/migrations/`
- **Tests**: `/ultra-mvp/tests/`
- **API Routes**: `/ultra-mvp/src/routes/`
- **Business Logic**: `/ultra-mvp/src/lib/`

---

**Last Updated**: 2025-11-30 13:00 UTC
**Next Review**: 2025-12-01

**Remember**: NO OpenAI. Test everything. Keep it simple.
