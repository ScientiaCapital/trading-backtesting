# PRP: [Feature Name]

**Created**: [YYYY-MM-DD]
**Status**: ACTIVE | COMPLETED | ARCHIVED
**Priority**: HIGH | MEDIUM | LOW
**Estimated Effort**: [Hours/Days]

---

## Critical Rules
- ❌ **NO OpenAI models**
- ❌ **API keys in .env only** - Never hardcoded
- ✅ **All trading calculations must be tested**
- ✅ **Test Command**: `npm test`

---

## Project Context
**Project**: Iron Condor Trading Backtester
**Tech Stack**: Node.js, Express, NEON PostgreSQL, Vercel
**Location**: `/Users/tmkipper/Desktop/tk_projects/trading-backtesting/ultra-mvp`

---

## 1. Feature Overview

### Goal
[Describe what this feature accomplishes in 1-2 sentences]

### Business Value
[Why is this feature important? What problem does it solve?]

### Success Metrics
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
- [ ] [Measurable outcome 3]

### Acceptance Criteria
- [ ] [User can do X]
- [ ] [System calculates Y correctly]
- [ ] [Performance meets Z threshold]

---

## 2. Trading Logic Specification

### Mathematical Formulas
```
[Formula 1]: Description
Example: Delta = ∂V/∂S (Black-Scholes derivative)

[Formula 2]: Description
Example: Gamma = ∂²V/∂S²

[Formula 3]: Description
Example: P&L = (Exit Price - Entry Price) × Quantity
```

### References
- [Textbook/Paper citation for formula 1]
- [Industry standard calculation method]
- [Benchmark dataset for validation]

### Calculation Steps
1. **Step 1**: [Input validation]
   - Validate spot price > 0
   - Validate strike price > 0
   - Validate time to expiration > 0

2. **Step 2**: [Core calculation]
   - Calculate d1, d2 for Black-Scholes
   - Apply normal CDF

3. **Step 3**: [Output formatting]
   - Round to appropriate precision
   - Return structured result

### Edge Cases
- [ ] **Expiration**: How to handle options on expiration day
- [ ] **Extreme Volatility**: Handle σ > 200%
- [ ] **Deep ITM/OTM**: Handle numerical precision
- [ ] **Zero Time**: Handle T → 0
- [ ] **Division by Zero**: Prevent σ = 0 errors

---

## 3. Technical Design

### Database Schema Changes

#### New Tables
```sql
CREATE TABLE IF NOT EXISTS [table_name] (
  id SERIAL PRIMARY KEY,
  [column1] [TYPE] NOT NULL,
  [column2] [TYPE],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_[table]_[column] ON [table]([column]);
```

#### Modified Tables
```sql
ALTER TABLE [existing_table]
  ADD COLUMN [new_column] [TYPE];
```

#### Migration Plan
1. Create migration file: `migrations/[timestamp]_[description].sql`
2. Test migration up/down locally
3. Verify schema with `npm run db:inspect`
4. Apply to production after PR approval

### API Endpoints

#### New Endpoints
```
POST /api/[resource]/[action]
GET  /api/[resource]/:id
PUT  /api/[resource]/:id
DELETE /api/[resource]/:id
```

#### Request Schema
```json
{
  "field1": "value",
  "field2": 123,
  "field3": ["array", "of", "values"]
}
```

#### Response Schema
```json
{
  "success": true,
  "data": {
    "result": 0.52,
    "calculation": "delta"
  },
  "meta": {
    "timestamp": "2025-11-30T12:00:00Z"
  }
}
```

#### Error Responses
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Strike price must be greater than 0",
    "field": "strike"
  }
}
```

### Core Functions

#### Function 1: [Name]
```javascript
/**
 * [Description of what this function does]
 * @param {number} param1 - Description
 * @param {string} param2 - Description
 * @returns {Object} - Description
 * @throws {Error} - When validation fails
 */
function functionName(param1, param2) {
  // Validate inputs
  if (!param1 || param1 <= 0) {
    throw new Error('Invalid param1');
  }

  // Core logic
  const result = /* calculation */;

  return result;
}
```

#### Function 2: [Name]
```javascript
// [Implementation sketch]
```

### Dependencies
```json
{
  "dependencies": {
    "[package-name]": "^version",
    "[another-package]": "^version"
  }
}
```

**Critical**: No OpenAI dependencies allowed

---

## 4. Testing Strategy

### Unit Tests

#### Test File: `tests/unit/[feature].test.js`
```javascript
describe('[Feature Name]', () => {
  describe('[Function/Component]', () => {
    test('should [expected behavior]', () => {
      // Arrange
      const input = /* test data */;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expectedValue);
    });

    test('should throw on invalid input', () => {
      expect(() => {
        functionUnderTest(invalidInput);
      }).toThrow('Expected error message');
    });
  });
});
```

#### Known Benchmark Tests
```javascript
test('ATM call delta should be ~0.5', () => {
  const delta = calculateDelta(100, 100, 1, 0.05, 0.2, 'call');
  expect(delta).toBeCloseTo(0.5, 2);
});
```

### Integration Tests

#### Test File: `tests/integration/[feature].test.js`
```javascript
const request = require('supertest');
const app = require('../../src/app');

describe('API Endpoint: POST /api/[resource]', () => {
  test('should return correct calculation', async () => {
    const response = await request(app)
      .post('/api/greeks/calculate')
      .send({ /* test data */ });

    expect(response.status).toBe(200);
    expect(response.body.data.delta).toBeCloseTo(0.5, 2);
  });
});
```

### Performance Tests
```javascript
test('calculation should complete in < 50ms', async () => {
  const start = Date.now();
  const result = await performCalculation();
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(50);
});
```

### Test Coverage Requirements
- [ ] Unit test coverage > 80%
- [ ] All edge cases tested
- [ ] Known benchmarks validated
- [ ] API endpoints tested
- [ ] Database queries tested

---

## 5. Implementation Tasks

### Phase 1: Setup (10 min)
- [ ] Create feature branch: `feature/[name]`
- [ ] Verify environment setup
- [ ] Run existing tests to ensure baseline

### Phase 2: Database (15 min)
- [ ] Create migration file
- [ ] Write SQL for schema changes
- [ ] Test migration up/down
- [ ] Verify with `npm run db:inspect`

### Phase 3: Core Logic (30-60 min)
- [ ] Create module file: `src/lib/[feature].js`
- [ ] Implement calculation functions
- [ ] Add input validation
- [ ] Add error handling
- [ ] Add JSDoc documentation

### Phase 4: Testing (20-30 min)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Run test suite: `npm test`
- [ ] Check coverage: `npm test -- --coverage`
- [ ] Verify benchmarks

### Phase 5: API Integration (15-20 min)
- [ ] Create route file: `src/routes/[feature].js`
- [ ] Implement endpoint handlers
- [ ] Add request validation
- [ ] Add error handling
- [ ] Test API endpoints

### Phase 6: Validation (15-20 min)
- [ ] Run `/validate` command
- [ ] Manual testing
- [ ] Performance benchmarks
- [ ] Security audit: `npm audit`
- [ ] Documentation update

---

## 6. Validation Criteria

### Functional Validation
- [ ] All calculations produce correct results
- [ ] Edge cases handled properly
- [ ] Error messages are descriptive
- [ ] API responses match schema

### Performance Validation
- [ ] Calculation time < 50ms
- [ ] API response time < 200ms
- [ ] Database queries < 100ms
- [ ] No memory leaks

### Quality Validation
- [ ] Test coverage > 80%
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] No security vulnerabilities

### Trading Validation
- [ ] Calculations match textbook formulas
- [ ] Known benchmarks validate
- [ ] No look-ahead bias
- [ ] Realistic market conditions

### Compliance
- [ ] No OpenAI models used
- [ ] No hardcoded API keys
- [ ] All keys in .env file
- [ ] Documentation updated

---

## 7. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Incorrect calculations | HIGH | MEDIUM | Test against known benchmarks |
| Poor performance | MEDIUM | LOW | Optimize queries, add caching |
| Look-ahead bias | HIGH | LOW | Careful data sequencing |
| Database migration fails | HIGH | LOW | Test thoroughly locally first |
| [Add more risks] | | | |

---

## 8. Rollback Plan

### If Deployment Fails
1. Revert deployment on Vercel: `vercel rollback`
2. Revert git commit: `git revert HEAD`
3. Investigate root cause
4. Fix and redeploy

### If Database Migration Fails
1. Run migration down: `npm run migrate:down`
2. Restore from backup if needed
3. Fix migration SQL
4. Test thoroughly before retry

---

## 9. Documentation Updates

### Files to Update
- [ ] `README.md` - Add feature description
- [ ] `docs/api.md` - Document new endpoints
- [ ] `docs/calculations.md` - Document formulas
- [ ] `PLANNING.md` - Add architectural decisions
- [ ] `TASK.md` - Mark feature complete

### API Documentation Template
```markdown
## POST /api/greeks/calculate

Calculate all Greeks for an option using Black-Scholes model.

**Request**:
```json
{
  "spot": 100,
  "strike": 100,
  "expiration": "2025-12-31",
  "volatility": 0.2,
  "riskFreeRate": 0.05,
  "optionType": "call"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "delta": 0.52,
    "gamma": 0.018,
    "theta": -5.2,
    "vega": 36.8
  }
}
```
```

---

## 10. Success Criteria

### Definition of Done
- [ ] All implementation tasks completed
- [ ] All tests passing (unit + integration)
- [ ] Test coverage > 80%
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Deployed to production
- [ ] No OpenAI dependencies

### Post-Deployment Validation
- [ ] Health check passes
- [ ] New endpoints responding correctly
- [ ] No errors in production logs
- [ ] Performance metrics normal

---

## 11. Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Setup | 10 min | [timestamp] | [timestamp] |
| Database | 15 min | | |
| Core Logic | 45 min | | |
| Testing | 25 min | | |
| API Integration | 17 min | | |
| Validation | 17 min | | |
| **Total** | **~2 hours** | | |

---

## 12. Notes & Decisions

### Architectural Decisions
- [Decision 1]: Why we chose X over Y
- [Decision 2]: Trade-offs considered

### Open Questions
- [ ] [Question that needs answering]
- [ ] [Clarification needed]

### Future Enhancements
- [Enhancement 1]: Not in scope for this PRP
- [Enhancement 2]: Consider for next iteration

---

## Completion Checklist

- [ ] PRP reviewed and approved
- [ ] All phases executed successfully
- [ ] Tests passing (100%)
- [ ] Deployed to production
- [ ] Documentation updated
- [ ] TASK.md updated
- [ ] PLANNING.md updated
- [ ] PRP moved to `PRPs/completed/`

**Completed Date**: [YYYY-MM-DD]
**Deployment URL**: https://trading-backtesting.vercel.app
**Git Commit**: [commit-hash]

---

**Remember**: NO OpenAI models. Test all calculations. Precision matters in trading.
