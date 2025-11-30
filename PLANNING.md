# PLANNING.md - Architecture & Decisions

**Project**: Iron Condor Trading Backtester
**Tech Stack**: Node.js, Express, NEON PostgreSQL, Vercel
**Location**: `/Users/tmkipper/Desktop/tk_projects/trading-backtesting/ultra-mvp`

---

## Critical Rules
- ❌ **NO OpenAI models** - Never use for trading signals or analysis
- ❌ **API keys in .env only** - Never hardcode
- ✅ **Test Command**: `npm test`

---

## Project Vision

### Goal
Build a high-performance Iron Condor options backtesting platform that:
- Provides accurate P&L calculations
- Supports historical backtesting with realistic assumptions
- Scales to handle 1000+ concurrent backtests
- Maintains calculation precision without AI dependencies

### Non-Goals
- ❌ Real-time trading execution
- ❌ AI-powered trade recommendations (NO OpenAI)
- ❌ Social trading features
- ❌ Mobile app (web-first)

---

## Architecture Decisions

### ADR-001: Node.js + Express Backend
**Date**: 2025-11-30
**Status**: ACCEPTED

**Context**: Need a performant, scalable backend for options calculations.

**Decision**: Use Node.js with Express framework.

**Rationale**:
- Fast JSON processing
- Large ecosystem for financial calculations
- Easy Vercel deployment
- Strong async/await support for database operations

**Consequences**:
- ✅ Fast development cycle
- ✅ Easy to deploy
- ⚠️ Need to manage callback hell with proper async/await
- ⚠️ TypeScript recommended for type safety

**Alternatives Considered**:
- Python FastAPI: Better for data science, but slower JSON
- Go: More performant, but steeper learning curve

---

### ADR-002: NEON PostgreSQL for Data Storage
**Date**: 2025-11-30
**Status**: ACCEPTED

**Context**: Need reliable, scalable database for backtesting data.

**Decision**: Use NEON Serverless PostgreSQL.

**Rationale**:
- Serverless scaling (pay per use)
- PostgreSQL compatibility (robust SQL features)
- Connection pooling built-in
- Excellent performance for analytical queries
- Easy Vercel integration

**Consequences**:
- ✅ No database server management
- ✅ Automatic backups
- ✅ Scales with usage
- ⚠️ Connection limits (managed with pooling)
- ⚠️ Cold start latency (minimal with connection pooling)

**Alternatives Considered**:
- Supabase: More features, but overkill for this use case
- MongoDB: Not ideal for relational financial data
- MySQL: Less advanced analytical features

**Configuration**:
```javascript
// Database connection (Neon)
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

---

### ADR-003: NO OpenAI or AI Models
**Date**: 2025-11-30
**Status**: ACCEPTED (MANDATORY)

**Context**: Trading calculations require mathematical precision, not AI predictions.

**Decision**: **NEVER** use OpenAI or any AI models for:
- Trading signals
- Options pricing
- P&L calculations
- Backtesting logic

**Rationale**:
- AI models are non-deterministic (bad for finance)
- Regulations require explainable calculations
- Black-Scholes and other formulas are proven
- Reproducibility is critical for backtesting

**Consequences**:
- ✅ Calculations are auditable
- ✅ Results are reproducible
- ✅ No OpenAI API costs
- ✅ Regulatory compliance easier

**Forbidden Patterns**:
```javascript
// ❌ NEVER DO THIS
const openai = require('openai');
const prediction = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Predict option price" }]
});

// ✅ ALWAYS DO THIS
const { calculateBlackScholes } = require('./lib/pricing');
const optionPrice = calculateBlackScholes(spot, strike, T, r, sigma);
```

---

### ADR-004: Black-Scholes for Options Pricing
**Date**: 2025-11-30
**Status**: ACCEPTED

**Context**: Need reliable options pricing model.

**Decision**: Use Black-Scholes-Merton model for European options.

**Rationale**:
- Industry standard
- Mathematically proven
- Fast to calculate
- Well-documented edge cases

**Consequences**:
- ✅ Accurate pricing
- ✅ Fast computation (< 50ms)
- ⚠️ Assumes European exercise (American needs binomial/trinomial)
- ⚠️ Assumes constant volatility (may need to adjust)

**Implementation**:
```javascript
// Black-Scholes call option pricing
function blackScholesCall(S, K, T, r, sigma) {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) /
             (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}
```

**References**:
- Black, F.; Scholes, M. (1973). "The Pricing of Options and Corporate Liabilities"
- Hull, J. (2018). "Options, Futures, and Other Derivatives"

---

### ADR-005: Vercel for Deployment
**Date**: 2025-11-30
**Status**: ACCEPTED

**Context**: Need fast, reliable hosting for API.

**Decision**: Deploy on Vercel.

**Rationale**:
- Serverless functions (auto-scaling)
- Global CDN
- Easy GitHub integration
- Excellent performance
- Free tier generous

**Consequences**:
- ✅ Fast deployment (git push)
- ✅ Automatic HTTPS
- ✅ Edge caching
- ⚠️ Cold start latency (10s timeout)
- ⚠️ Function execution limits (10s/60s depending on plan)

**Configuration**:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "ultra-mvp/src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "ultra-mvp/src/index.js"
    }
  ]
}
```

---

### ADR-006: Environment Variables in .env Only
**Date**: 2025-11-30
**Status**: ACCEPTED (MANDATORY)

**Context**: API keys and secrets must be secure.

**Decision**: **ALL** API keys, database URLs, and secrets in `.env` file only.

**Rationale**:
- Security best practice
- Prevents accidental commits
- Easy to rotate keys
- Vercel supports .env natively

**Consequences**:
- ✅ Keys never in git
- ✅ Easy key rotation
- ✅ Environment-specific configs
- ⚠️ Must configure Vercel environment variables

**Required Variables**:
```bash
# .env (NEVER commit this file)
NEON_DATABASE_URL=postgresql://user:pass@host/db
API_PORT=8001
NODE_ENV=production

# Market data (if needed - NO OpenAI keys)
ALPHA_VANTAGE_KEY=your-key
POLYGON_API_KEY=your-key
```

**Forbidden**:
```javascript
// ❌ NEVER hardcode
const dbUrl = "postgresql://user:pass@host/db";

// ✅ ALWAYS use process.env
const dbUrl = process.env.NEON_DATABASE_URL;
```

---

### ADR-007: Connection Pooling for Database
**Date**: 2025-11-30
**Status**: ACCEPTED

**Context**: Serverless functions create many database connections.

**Decision**: Use connection pooling with pg.Pool.

**Rationale**:
- Reduces connection overhead
- Improves performance
- Prevents connection exhaustion
- Works well with NEON

**Consequences**:
- ✅ Better performance
- ✅ Handles concurrent requests
- ⚠️ Need to configure pool size

**Implementation**:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  max: 20,           // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Always use pool.query(), never pool.connect()
const result = await pool.query('SELECT * FROM backtests WHERE id = $1', [id]);
```

---

### ADR-008: RESTful API Design
**Date**: 2025-11-30
**Status**: ACCEPTED

**Context**: Need consistent API patterns.

**Decision**: Use RESTful conventions.

**API Structure**:
```
POST   /api/backtests              - Create new backtest
GET    /api/backtests/:id          - Get backtest results
GET    /api/backtests              - List all backtests
DELETE /api/backtests/:id          - Delete backtest

POST   /api/greeks/calculate       - Calculate Greeks
POST   /api/pricing/black-scholes  - Price option
```

**Response Format**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "result": { ... }
  },
  "meta": {
    "timestamp": "2025-11-30T12:00:00Z",
    "version": "1.0"
  }
}
```

**Error Format**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Strike price must be positive",
    "field": "strike"
  }
}
```

---

## Database Schema

### Current Schema (v1.0)

```sql
-- Backtests table
CREATE TABLE backtests (
  id SERIAL PRIMARY KEY,
  strategy VARCHAR(50) NOT NULL,      -- 'iron-condor', etc.
  symbol VARCHAR(10) NOT NULL,        -- 'SPY', 'QQQ', etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  parameters JSONB,                   -- Strategy-specific params
  results JSONB,                      -- P&L, win rate, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_backtests_symbol ON backtests(symbol);
CREATE INDEX idx_backtests_created_at ON backtests(created_at DESC);

-- Market data (historical prices)
CREATE TABLE market_data (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  open DECIMAL(10,2),
  high DECIMAL(10,2),
  low DECIMAL(10,2),
  close DECIMAL(10,2),
  volume BIGINT,
  UNIQUE(symbol, date)
);

CREATE INDEX idx_market_data_symbol_date ON market_data(symbol, date);
```

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time (p95) | < 500ms | TBD |
| Backtest Execution (1 year) | < 5s | TBD |
| Database Query Time | < 100ms | TBD |
| Calculation Time (Greeks) | < 50ms | TBD |
| Concurrent Backtests | 1000+ | TBD |

---

## Testing Strategy

### Test Pyramid
```
        /\
       /UI\        <- 10% (E2E tests)
      /----\
     / API  \      <- 30% (Integration tests)
    /--------\
   /   Unit   \    <- 60% (Unit tests)
  /------------\
```

### Test Coverage Requirements
- **Unit Tests**: > 80% coverage
- **Integration Tests**: All API endpoints
- **Known Benchmarks**: Validate against textbook examples

### Testing Tools
- **Framework**: Jest
- **API Testing**: Supertest
- **Coverage**: Jest built-in
- **Performance**: Custom benchmark suite

### Example Test
```javascript
// tests/unit/pricing.test.js
describe('Black-Scholes Pricing', () => {
  test('ATM call option should match textbook value', () => {
    // Known benchmark from Hull's book
    const price = blackScholesCall(
      42,    // S: spot
      40,    // K: strike
      0.5,   // T: 6 months
      0.10,  // r: 10%
      0.20   // σ: 20% vol
    );

    expect(price).toBeCloseTo(4.76, 2);
  });
});
```

---

## Security Considerations

### Input Validation
```javascript
// Always validate inputs
function validateBacktestParams(params) {
  if (!params.symbol || typeof params.symbol !== 'string') {
    throw new Error('Invalid symbol');
  }
  if (!params.startDate || isNaN(Date.parse(params.startDate))) {
    throw new Error('Invalid start date');
  }
  // ... more validations
}
```

### SQL Injection Prevention
```javascript
// ✅ ALWAYS use parameterized queries
const result = await pool.query(
  'SELECT * FROM backtests WHERE symbol = $1',
  [symbol]
);

// ❌ NEVER concatenate SQL
const result = await pool.query(
  `SELECT * FROM backtests WHERE symbol = '${symbol}'`
);
```

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);
```

---

## Monitoring & Observability

### Key Metrics to Track
- API response times (p50, p95, p99)
- Error rates
- Database query performance
- Backtest execution times
- Memory usage

### Logging Strategy
```javascript
// Structured logging
const logger = require('pino')();

logger.info({
  event: 'backtest_started',
  backtestId: id,
  symbol: symbol,
  strategy: 'iron-condor'
});

logger.error({
  event: 'calculation_error',
  error: err.message,
  params: { S, K, T, r, sigma }
});
```

### Alerts
- Error rate > 1% → Critical
- Response time > 2s → Warning
- Database connections > 80% → Warning

---

## Future Enhancements

### Roadmap
1. **Phase 1** (Current): Iron Condor backtesting
2. **Phase 2**: Add more strategies (straddles, spreads)
3. **Phase 3**: Greeks calculation dashboard
4. **Phase 4**: Portfolio optimization (NO AI)
5. **Phase 5**: Real-time paper trading

### Technologies to Consider
- **Frontend**: React for dashboard
- **Caching**: Redis for frequently accessed data
- **Analytics**: Time-series database for metrics

### What We'll NEVER Add
- ❌ OpenAI trading signals
- ❌ AI-powered predictions
- ❌ Social trading recommendations
- ❌ Automated real-money trading

---

## Team Guidelines

### Code Review Checklist
- [ ] No OpenAI imports
- [ ] No hardcoded API keys
- [ ] All calculations tested
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Commit Message Format
```
feat(pricing): Add Black-Scholes Greeks calculation

- Implemented Delta, Gamma, Theta, Vega
- Added comprehensive unit tests
- Validated against Hull textbook examples
- NO OpenAI models used

Closes #123
```

### Branch Naming
- `feature/greeks-calculation`
- `fix/backtest-pnl-error`
- `perf/optimize-db-queries`

---

## References

### Books
- Hull, J. (2018). "Options, Futures, and Other Derivatives" (9th ed.)
- Wilmott, P. (2006). "Paul Wilmott on Quantitative Finance"

### Papers
- Black, F.; Scholes, M. (1973). "The Pricing of Options and Corporate Liabilities"

### Resources
- NEON Documentation: https://neon.tech/docs
- Vercel Documentation: https://vercel.com/docs
- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices

---

**Last Updated**: 2025-11-30
**Next Review**: 2025-12-30

**Remember**: NO OpenAI. Test everything. Precision matters in finance.
