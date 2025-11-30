# Generate PRP (Project Refinement Plan)

**CRITICAL RULE**: NO OpenAI models - API keys in .env only

## Project: Iron Condor Trading Backtester
**Tech Stack**: Node.js, Express, NEON PostgreSQL, Vercel
**Test Command**: `npm test`
**Location**: `/Users/tmkipper/Desktop/tk_projects/trading-backtesting/ultra-mvp`

---

## Purpose
Generate a comprehensive Project Refinement Plan (PRP) for new features or major changes to the Iron Condor backtesting platform.

---

## Usage
```bash
/generate-prp [feature-name]
```

**Examples**:
- `/generate-prp advanced-greeks-calculation`
- `/generate-prp multi-leg-strategies`
- `/generate-prp real-time-market-data`

---

## PRP Generation Process

### Step 1: Feature Analysis (5 minutes)
Ask clarifying questions:
- What trading strategy/feature is being added?
- What are the acceptance criteria?
- What are the performance requirements?
- What database schema changes are needed?
- What API endpoints will be affected?

### Step 2: Trading Logic Design (10 minutes)
Document:
- Options pricing formulas required
- P&L calculation methods
- Risk metrics to track
- Backtesting logic flow
- Data requirements (OHLCV, Greeks, etc.)

### Step 3: Technical Specification (10 minutes)
Define:
- **API Routes**: New/modified Express endpoints
- **Database Schema**: NEON PostgreSQL tables/columns
- **Business Logic**: Core calculation functions
- **Testing Strategy**: Unit tests for calculations
- **Validation**: How to verify accuracy

### Step 4: Implementation Breakdown (15 minutes)
Create tasks:
1. Database migrations (if needed)
2. Core calculation functions
3. API endpoint implementation
4. Unit tests for trading logic
5. Integration tests
6. Documentation updates

### Step 5: Risk Assessment (5 minutes)
Identify risks:
- Calculation accuracy issues
- Performance bottlenecks
- Database query optimization
- Backtesting bias (look-ahead, survivorship)
- Data quality concerns

### Step 6: Generate PRP Document (5 minutes)
Create file at: `PRPs/active/[feature-name]-[YYYYMMDD].md`

Use template from: `PRPs/templates/prp_base.md`

---

## PRP Template Structure

```markdown
# PRP: [Feature Name]

## Critical Rules
- NO OpenAI models
- API keys in .env only
- All trading calculations must be tested

## Feature Overview
**Goal**: [What this feature accomplishes]
**Priority**: [High/Medium/Low]
**Estimated Effort**: [Hours/Days]

## Trading Logic Specification
### Formulas
- [List all mathematical formulas]
- [Include references to textbooks/papers]

### Calculations
- [Step-by-step calculation logic]
- [Edge cases to handle]

## Technical Design
### Database Changes
- Tables: [New/Modified tables]
- Columns: [Schema changes]
- Indexes: [Performance optimization]

### API Endpoints
- `POST /api/backtest/[strategy]`
- Request schema
- Response schema

### Core Functions
- `calculateIronCondorPnL()`
- `computeGreeks()`
- `validateBacktestParams()`

## Testing Strategy
### Unit Tests
- [ ] Test calculation accuracy
- [ ] Test edge cases (expiration, assignment)
- [ ] Test with known datasets

### Integration Tests
- [ ] API endpoint tests
- [ ] Database query tests
- [ ] End-to-end backtest flow

### Performance Tests
- [ ] Query optimization (<100ms)
- [ ] Backtest execution time
- [ ] Memory usage

## Implementation Tasks
1. [ ] Database migration
2. [ ] Core calculation functions
3. [ ] API endpoint
4. [ ] Unit tests
5. [ ] Integration tests
6. [ ] Documentation

## Validation Criteria
- [ ] Calculations match expected results
- [ ] Test coverage > 80%
- [ ] No performance regressions
- [ ] No OpenAI dependencies
- [ ] API keys in .env only

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Incorrect calculations | Test against known benchmarks |
| Poor performance | Optimize database queries |
| Look-ahead bias | Careful data sequencing |

## References
- [Link to options pricing theory]
- [Backtest validation methodology]
- [Performance benchmarks]
```

---

## After Generation

### Review Checklist
- [ ] Trading logic formulas verified
- [ ] Database schema reviewed
- [ ] Test strategy comprehensive
- [ ] No OpenAI references
- [ ] Performance considerations included

### Next Steps
1. Review PRP with stakeholders
2. Estimate implementation time
3. Execute PRP using `/execute-prp`
4. Track progress in `TASK.md`

---

## Trading Platform Specific Considerations

### Calculation Accuracy
- Always include references to textbook formulas
- Test against known option pricing models
- Verify Greeks calculations (Delta, Gamma, Theta, Vega)

### Backtesting Integrity
- No look-ahead bias
- Realistic slippage and commissions
- Proper handling of dividends/splits
- Corporate actions tracking

### Performance Requirements
- API responses < 500ms
- Backtest execution < 5s for 1 year
- Database queries < 100ms
- Support 1000+ concurrent backtests

### Data Quality
- Validate OHLCV data completeness
- Handle missing data gracefully
- Detect and flag data anomalies
- Source data from reliable providers

---

## Examples

### Example 1: Greek Calculations
```markdown
# PRP: Advanced Greeks Calculation

## Trading Logic Specification
### Formulas
- Delta: ∂V/∂S (Black-Scholes)
- Gamma: ∂²V/∂S²
- Theta: ∂V/∂t
- Vega: ∂V/∂σ

### Implementation
- Use Black-Scholes-Merton model
- Handle American vs European options
- Early exercise considerations
```

### Example 2: Multi-Leg Strategies
```markdown
# PRP: Multi-Leg Strategy Support

## Technical Design
### Database Schema
```sql
CREATE TABLE strategy_legs (
  id SERIAL PRIMARY KEY,
  backtest_id INT REFERENCES backtests(id),
  leg_type VARCHAR(20), -- 'long_call', 'short_put', etc.
  strike DECIMAL(10,2),
  expiration DATE,
  quantity INT,
  premium DECIMAL(10,2)
);
```
```

---

## Forbidden Patterns
- ❌ Using OpenAI for trading signals
- ❌ Hardcoded API keys
- ❌ External AI predictions
- ❌ Unvalidated calculation formulas
- ❌ Untested trading logic

---

## Success Metrics
- PRP document created in < 45 minutes
- All trading formulas documented
- Test strategy covers edge cases
- Performance requirements specified
- No OpenAI dependencies

**Remember**: Trading platforms require mathematical precision. Test everything.
