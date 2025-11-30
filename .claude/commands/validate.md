# Multi-Phase Validation Protocol

**CRITICAL RULE**: NO OpenAI models - API keys in .env only

## Project: Iron Condor Trading Backtester
**Tech Stack**: Node.js, Express, NEON PostgreSQL, Vercel
**Test Command**: `npm test` (standard Node.js testing)
**Location**: `/Users/tmkipper/Desktop/tk_projects/trading-backtesting/ultra-mvp`

---

## Phase 1: Pre-Commit Validation
**When**: Before every git commit
**Duration**: 2-5 minutes

### Required Checks
```bash
cd ultra-mvp

# 1. Linting
npm run lint

# 2. Type safety (if using TypeScript)
npm run typecheck

# 3. Unit tests
npm test

# 4. Build verification
npm run build
```

### Critical Validations
- [ ] No API keys hardcoded (check .env usage)
- [ ] No OpenAI imports or references
- [ ] All trading calculations tested
- [ ] NEON PostgreSQL connection verified
- [ ] Environment variables documented

### Auto-Fix Available
```bash
npm run lint:fix
npm run format  # if prettier configured
```

---

## Phase 2: Feature Validation
**When**: After implementing a feature
**Duration**: 5-10 minutes

### Functional Tests
```bash
# Run feature-specific tests
npm test -- --grep "Iron Condor"

# Integration tests
npm run test:integration

# Database tests
npm run test:db
```

### Manual Checks
- [ ] Iron Condor calculations accurate
- [ ] Backtesting logic correct
- [ ] Database queries optimized
- [ ] API endpoints responsive (<200ms)
- [ ] Error handling comprehensive

### Trading Logic Validation
- [ ] Options pricing formulas verified
- [ ] P&L calculations match expected results
- [ ] Win rate calculations accurate
- [ ] Drawdown metrics correct

---

## Phase 3: Pre-PR Validation
**When**: Before creating pull request
**Duration**: 10-15 minutes

### Comprehensive Tests
```bash
# Full test suite
npm test -- --coverage

# Performance benchmarks
npm run benchmark

# Security scan
npm audit

# Database migration check
npm run migrate:test
```

### Code Quality
- [ ] Test coverage > 80%
- [ ] No critical/high vulnerabilities
- [ ] All database migrations tested
- [ ] API documentation updated

### Trading Platform Specific
- [ ] Backtesting results reproducible
- [ ] No data leakage in backtests
- [ ] Risk calculations verified
- [ ] Performance metrics accurate

---

## Phase 4: Deployment Validation
**When**: Before production deploy
**Duration**: 15-20 minutes

### Pre-Deploy Checklist
```bash
# Production build
npm run build

# Database migration
npm run migrate:production

# Smoke tests
npm run test:smoke
```

### Environment Verification
- [ ] NEON_DATABASE_URL configured
- [ ] API_PORT set correctly
- [ ] No .env file in build output
- [ ] All dependencies in package.json
- [ ] No OpenAI dependencies

### Critical Path Testing
1. Health check endpoint
2. Iron Condor backtest execution
3. Database query performance
4. API response times
5. Error handling (network, DB failures)

---

## Phase 5: Post-Deploy Validation
**When**: Immediately after deployment
**Duration**: 10 minutes

### Live Checks
```bash
# Health check
curl https://trading-backtesting.vercel.app/api/health

# Backtest endpoint
curl -X POST https://trading-backtesting.vercel.app/api/backtest \
  -H "Content-Type: application/json" \
  -d '{"strategy":"iron-condor","symbol":"SPY","startDate":"2024-01-01"}'
```

### Real System Monitoring
- [ ] Response times < 500ms (p95)
- [ ] Error rate < 0.1%
- [ ] Database connections stable
- [ ] No memory leaks
- [ ] NEON database responsive

### Rollback Criteria
- Error rate > 1%
- Response time > 2s
- Database connection failures
- Incorrect trading calculations

---

## Phase 6: Monitoring & Alerts
**When**: Continuous
**Setup**: Vercel Analytics + NEON Monitoring

### Key Metrics
- **Latency**: API < 500ms, Backtest < 5s
- **Errors**: < 0.1% error rate
- **Database**: Query time < 100ms
- **Usage**: Backtest requests/hour

### Alert Thresholds
```yaml
critical:
  - error_rate > 1%
  - response_time > 2s
  - db_connections > 80%

warning:
  - error_rate > 0.5%
  - response_time > 1s
  - db_connections > 60%
```

### Weekly Review
- [ ] Review trading calculation accuracy
- [ ] Check database performance
- [ ] Analyze backtest results distribution
- [ ] Verify no OpenAI usage creeping in

---

## Trading Platform Compliance

### Calculation Accuracy
```bash
# Verify calculations against known benchmarks
npm run test:calculations

# Test with historical data
npm run test:historical-accuracy
```

### Data Integrity
- [ ] No look-ahead bias in backtests
- [ ] Price data validated
- [ ] No survivorship bias
- [ ] Realistic slippage/commissions

### Forbidden Technologies
- ❌ OpenAI models (no AI for trading decisions)
- ❌ Hardcoded API keys
- ❌ External AI APIs for predictions

---

## Emergency Procedures

### If Trading Calculations Wrong
1. Stop all backtests immediately
2. Revert to last known good version
3. Re-verify formulas against textbooks
4. Test with known datasets
5. Deploy fix with thorough validation

### If Database Issues
1. Check NEON status page
2. Verify connection string
3. Test database queries locally
4. Review query performance
5. Scale up NEON if needed

---

## Quick Reference

| Phase | When | Duration | Command |
|-------|------|----------|---------|
| Pre-Commit | Every commit | 2-5 min | `npm run validate` |
| Feature | After feature | 5-10 min | `npm test -- <feature>` |
| Pre-PR | Before PR | 10-15 min | `npm test -- --coverage` |
| Pre-Deploy | Before deploy | 15-20 min | `npm run build` |
| Post-Deploy | After deploy | 10 min | `curl <health-endpoint>` |
| Monitoring | Continuous | N/A | Vercel + NEON dashboards |

**Remember**: No OpenAI. Accurate trading calculations. Test thoroughly.
