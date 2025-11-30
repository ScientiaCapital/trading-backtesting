# Execute PRP (6-Phase Execution Protocol)

**CRITICAL RULE**: NO OpenAI models - API keys in .env only

## Project: Iron Condor Trading Backtester
**Tech Stack**: Node.js, Express, NEON PostgreSQL, Vercel
**Test Command**: `npm test`
**Location**: `/Users/tmkipper/Desktop/tk_projects/trading-backtesting/ultra-mvp`

---

## Purpose
Execute a Project Refinement Plan (PRP) using a systematic 6-phase approach with validation gates at each phase.

---

## Usage
```bash
/execute-prp [prp-file-name]
```

**Example**:
```bash
/execute-prp PRPs/active/advanced-greeks-20251130.md
```

---

## 6-Phase Execution Framework

### Phase 1: Setup & Validation (10 minutes)
**Goal**: Prepare environment and verify PRP completeness

#### Tasks
```bash
cd /Users/tmkipper/Desktop/tk_projects/trading-backtesting/ultra-mvp

# 1. Create feature branch
git checkout -b feature/[prp-name]

# 2. Verify environment
npm install
npm test

# 3. Check database connection
npm run db:test-connection

# 4. Review PRP document
cat PRPs/active/[prp-file].md
```

#### Validation Gate
- [ ] PRP document exists and is complete
- [ ] All dependencies installed
- [ ] Tests passing on main branch
- [ ] Database connection verified
- [ ] No OpenAI dependencies in PRP
- [ ] Branch created successfully

**STOP**: If any validation fails, fix before proceeding.

---

### Phase 2: Database Migration (15 minutes)
**Goal**: Implement schema changes if required

#### Tasks
```bash
# 1. Create migration file
npm run migration:create -- add-[feature-name]

# 2. Write migration SQL
# Edit: migrations/[timestamp]_add_[feature].sql

# 3. Test migration locally
npm run migrate:up
npm run migrate:down
npm run migrate:up

# 4. Verify schema
npm run db:inspect
```

#### Example Migration
```sql
-- Migration: Add strategy legs support
CREATE TABLE IF NOT EXISTS strategy_legs (
  id SERIAL PRIMARY KEY,
  backtest_id INT REFERENCES backtests(id) ON DELETE CASCADE,
  leg_type VARCHAR(20) NOT NULL,
  strike DECIMAL(10,2) NOT NULL,
  expiration DATE NOT NULL,
  quantity INT NOT NULL,
  premium DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strategy_legs_backtest
  ON strategy_legs(backtest_id);
```

#### Validation Gate
- [ ] Migration runs successfully (up/down)
- [ ] No data loss
- [ ] Indexes created
- [ ] Foreign keys enforced
- [ ] Schema matches PRP specification
- [ ] Rollback tested

**STOP**: If migration fails, fix schema before proceeding.

---

### Phase 3: Core Implementation (30-60 minutes)
**Goal**: Implement trading logic and calculations

#### Tasks
```bash
# 1. Create core module
touch src/lib/[feature-name].js

# 2. Implement calculations
# Follow PRP specification exactly

# 3. Add input validation
# Validate all parameters

# 4. Add error handling
# Handle edge cases
```

#### Implementation Checklist
- [ ] All formulas from PRP implemented
- [ ] Input validation comprehensive
- [ ] Error messages descriptive
- [ ] No hardcoded values (use config)
- [ ] No OpenAI imports
- [ ] Code follows project style

#### Example Implementation
```javascript
// src/lib/greeks.js
/**
 * Calculate option Greeks using Black-Scholes model
 * NO OpenAI - Pure mathematical calculations
 */

const { normalCDF, normalPDF } = require('./statistics');

function calculateDelta(S, K, T, r, sigma, optionType) {
  // Validate inputs
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
    throw new Error('Invalid option parameters');
  }

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) /
             (sigma * Math.sqrt(T));

  return optionType === 'call'
    ? normalCDF(d1)
    : normalCDF(d1) - 1;
}

module.exports = {
  calculateDelta,
  calculateGamma,
  calculateTheta,
  calculateVega
};
```

#### Validation Gate
- [ ] Code compiles without errors
- [ ] Linting passes: `npm run lint`
- [ ] Type checking passes (if TypeScript)
- [ ] All functions documented
- [ ] No OpenAI references

**STOP**: If implementation has errors, fix before testing.

---

### Phase 4: Testing (20-30 minutes)
**Goal**: Verify calculation accuracy and system integration

#### Tasks
```bash
# 1. Write unit tests
touch tests/unit/[feature-name].test.js

# 2. Write integration tests
touch tests/integration/[feature-name].test.js

# 3. Run test suite
npm test

# 4. Check coverage
npm test -- --coverage
```

#### Unit Test Example
```javascript
// tests/unit/greeks.test.js
const { calculateDelta } = require('../../src/lib/greeks');

describe('Greek Calculations', () => {
  describe('Delta', () => {
    test('call delta for ATM option should be ~0.5', () => {
      const delta = calculateDelta(
        100,  // S: spot price
        100,  // K: strike
        1,    // T: 1 year
        0.05, // r: risk-free rate
        0.2,  // sigma: volatility
        'call'
      );

      expect(delta).toBeGreaterThan(0.45);
      expect(delta).toBeLessThan(0.55);
    });

    test('put delta should be call delta - 1', () => {
      const params = [100, 100, 1, 0.05, 0.2];
      const callDelta = calculateDelta(...params, 'call');
      const putDelta = calculateDelta(...params, 'put');

      expect(putDelta).toBeCloseTo(callDelta - 1);
    });

    test('should throw on invalid inputs', () => {
      expect(() => {
        calculateDelta(-100, 100, 1, 0.05, 0.2, 'call');
      }).toThrow('Invalid option parameters');
    });
  });
});
```

#### Integration Test Example
```javascript
// tests/integration/greeks-api.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('POST /api/greeks/calculate', () => {
  test('should return all Greeks for valid input', async () => {
    const response = await request(app)
      .post('/api/greeks/calculate')
      .send({
        spot: 100,
        strike: 100,
        expiration: '2025-12-31',
        volatility: 0.2,
        riskFreeRate: 0.05,
        optionType: 'call'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('delta');
    expect(response.body).toHaveProperty('gamma');
    expect(response.body).toHaveProperty('theta');
    expect(response.body).toHaveProperty('vega');
  });
});
```

#### Validation Gate
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Test coverage > 80%
- [ ] Edge cases tested
- [ ] Known benchmark results match
- [ ] No test failures

**STOP**: If tests fail, debug and fix before proceeding.

---

### Phase 5: API Integration (15-20 minutes)
**Goal**: Expose functionality via REST API

#### Tasks
```bash
# 1. Create API route
touch src/routes/[feature-name].js

# 2. Add route to app
# Edit: src/app.js

# 3. Document API
# Edit: docs/api.md

# 4. Test endpoints
npm run test:api
```

#### API Route Example
```javascript
// src/routes/greeks.js
const express = require('express');
const router = express.Router();
const { calculateDelta, calculateGamma } = require('../lib/greeks');

/**
 * POST /api/greeks/calculate
 * Calculate all Greeks for an option
 * NO OpenAI - Pure Black-Scholes calculations
 */
router.post('/calculate', async (req, res) => {
  try {
    const { spot, strike, expiration, volatility, riskFreeRate, optionType } = req.body;

    // Validate inputs
    if (!spot || !strike || !expiration || !volatility || !riskFreeRate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Calculate time to expiration in years
    const T = (new Date(expiration) - new Date()) / (365 * 24 * 60 * 60 * 1000);

    const greeks = {
      delta: calculateDelta(spot, strike, T, riskFreeRate, volatility, optionType),
      gamma: calculateGamma(spot, strike, T, riskFreeRate, volatility),
      theta: calculateTheta(spot, strike, T, riskFreeRate, volatility, optionType),
      vega: calculateVega(spot, strike, T, riskFreeRate, volatility)
    };

    res.json(greeks);
  } catch (error) {
    console.error('Greeks calculation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### Validation Gate
- [ ] API endpoints respond correctly
- [ ] Error handling comprehensive
- [ ] Response times < 500ms
- [ ] API documentation updated
- [ ] No OpenAI dependencies
- [ ] Rate limiting considered

**STOP**: If API tests fail, fix before validation.

---

### Phase 6: Pre-Merge Validation (15-20 minutes)
**Goal**: Final checks before merging to main

#### Tasks
```bash
# 1. Run full validation suite
/validate

# 2. Manual testing
npm run dev
# Test endpoints manually

# 3. Performance check
npm run benchmark

# 4. Security audit
npm audit

# 5. Documentation review
cat docs/api.md
cat README.md
```

#### Final Checklist
- [ ] All tests pass (`npm test`)
- [ ] Linting clean (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] No security vulnerabilities
- [ ] Documentation updated
- [ ] TASK.md updated
- [ ] PLANNING.md updated
- [ ] No OpenAI references anywhere

#### Performance Validation
```bash
# Test API response times
npm run benchmark:greeks

# Expected results:
# - Greeks calculation: < 50ms
# - API endpoint: < 200ms
# - Database query: < 100ms
```

#### Validation Gate
- [ ] All automated tests pass
- [ ] Manual testing successful
- [ ] Performance benchmarks met
- [ ] No regressions detected
- [ ] Documentation complete

**STOP**: If any validation fails, fix before merge.

---

## Merge & Deploy

### Merge to Main
```bash
# 1. Final test run
npm test -- --coverage

# 2. Commit changes
git add .
git commit -m "feat: [feature-name] - [brief description]

- Implemented [calculation/feature]
- Added comprehensive tests
- Updated API documentation
- NO OpenAI models used"

# 3. Push to remote
git push origin feature/[prp-name]

# 4. Create PR
# Use GitHub/GitLab UI

# 5. After PR approval, merge
git checkout main
git pull origin main
git merge feature/[prp-name]
git push origin main
```

### Deploy to Vercel
```bash
# Automatic deployment via GitHub integration
# Monitor at: https://vercel.com/dashboard

# Or manual deploy:
vercel --prod
```

### Post-Deploy Validation
```bash
# 1. Health check
curl https://trading-backtesting.vercel.app/api/health

# 2. Test new endpoint
curl -X POST https://trading-backtesting.vercel.app/api/greeks/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "spot": 100,
    "strike": 100,
    "expiration": "2025-12-31",
    "volatility": 0.2,
    "riskFreeRate": 0.05,
    "optionType": "call"
  }'

# 3. Monitor logs
vercel logs
```

---

## Cleanup

### Move PRP to Completed
```bash
mv PRPs/active/[prp-file].md PRPs/completed/
```

### Update Project Files
```bash
# Update TASK.md
# Mark feature as complete

# Update PLANNING.md
# Document architectural decisions

# Archive feature branch (optional)
git branch -d feature/[prp-name]
```

---

## Emergency Rollback

### If Deployment Fails
```bash
# 1. Revert on Vercel
vercel rollback

# 2. Revert git commit
git revert HEAD
git push origin main

# 3. Investigate issue
# Check logs, errors, test failures

# 4. Fix and redeploy
```

---

## Trading Platform Best Practices

### Calculation Accuracy
- Always test against known benchmarks
- Use established formulas (Black-Scholes, etc.)
- Handle edge cases (expiration, extreme volatility)
- Validate inputs rigorously

### Performance
- Cache expensive calculations
- Optimize database queries
- Use connection pooling
- Monitor query times

### Data Integrity
- Never introduce look-ahead bias
- Handle missing data gracefully
- Validate all market data
- Log all calculations for audit

### Forbidden Patterns
- ❌ OpenAI for trading signals
- ❌ Hardcoded parameters
- ❌ Unvalidated data sources
- ❌ Skipping tests for "simple" features

---

## Success Criteria
- [ ] All 6 phases completed
- [ ] Zero test failures
- [ ] Performance benchmarks met
- [ ] No OpenAI dependencies
- [ ] Documentation updated
- [ ] Successfully deployed
- [ ] PRP moved to completed

**Remember**: Trading platforms require precision. Never skip validation phases.
