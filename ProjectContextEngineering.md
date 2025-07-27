# ProjectContextEngineering.md

## Architecture Decisions & Technical Context

### Why These Technologies?

#### Cloudflare Edge Infrastructure
- **83% cost reduction** (Baselime case study: $708k → $118k annually)
- **Zero cold starts** with V8 isolates vs containers
- **Global performance**: Execute within 50ms of 95% of users
- **Billing advantage**: Pay only for CPU time, not I/O wait
- **Free tier**: 100k requests/day, 10GB storage

#### Hono Framework
- **Ultrafast router** using RegExpRouter (no linear loops)
- **12KB bundle size** with zero dependencies
- **First-class TypeScript** support
- **Native Cloudflare bindings** integration
- **Pattern from Cloudflare docs**: Recommended for Workers

#### Multi-Agent Architecture (Inspired by context-engineering-intro PRP)
```typescript
// Pattern: Agent as Tool for Complex Operations
class TradingAgent {
  tools = [
    BacktestAgent,     // Delegates to fastquant Python process
    AlpacaAgent,       // Handles live trading via API
    AnalysisAgent      // AI-powered insights via Workers AI
  ]
}
```

### Data Flow Architecture

```
User Request → Cloudflare Workers (Hono)
                    ↓
            Authentication (JWT/Access)
                    ↓
         ┌──────────┴──────────┐
         ↓                     ↓
    Trading API           Backtest API
         ↓                     ↓
  Durable Objects         Queue Worker
         ↓                     ↓
   Alpaca WebSocket      Python Process
         ↓                     ↓
   Market Orders         fastquant Engine
         ↓                     ↓
    Execution              R2 Storage
```

### Integration Strategy

#### Phase 1: Notebook Conversion Pattern
```typescript
// Example: options-gamma-scalping.ipynb → GammaScalpingStrategy.ts

// Python (Original)
def calculate_delta(self, option_price, underlying_price):
    return norm.cdf(d1)

// TypeScript (Converted)
class GammaScalpingStrategy implements Strategy {
  calculateDelta(optionPrice: number, underlyingPrice: number): number {
    // Use statistics library or implement Black-Scholes
    return this.normalCDF(d1);
  }
}
```

#### Phase 2: Service Wrapper Pattern
```typescript
// AlpacaService - Multi-tenant with encrypted credentials
class AlpacaService {
  private credentials: Map<string, EncryptedCredentials> = new Map();
  
  async executeTrade(
    tenantId: string,
    strategy: Strategy,
    context: TradingContext
  ): Promise<TradeResult> {
    // 1. Get tenant credentials
    const creds = await this.getDecryptedCredentials(tenantId);
    
    // 2. Validate strategy against account
    const validation = await this.validateStrategy(strategy, creds);
    if (!validation.success) throw new ValidationError(validation.errors);
    
    // 3. Execute with retry logic
    return this.withRetry(async () => {
      const client = new AlpacaClient(creds);
      return client.submitOrder(strategy.toOrder());
    });
  }
}
```

### Technical Constraints & Solutions

#### Cloudflare Workers Limits
| Limit | Free | Paid | Solution |
|-------|------|------|----------|
| CPU Time | 10ms | 30s | Use Durable Objects for long operations |
| Memory | 128MB | 128MB | Stream large datasets |
| Subrequests | 50 | 1000 | Batch operations |
| Script Size | 1MB | 10MB | Code splitting |

#### Python → TypeScript Conversion Challenges

1. **NumPy/Pandas Operations**
   ```typescript
   // Python: df.rolling(window=20).mean()
   // TypeScript: Use lightweight alternative
   import { SMA } from '@/indicators';
   const sma = new SMA(20);
   ```

2. **Async Patterns**
   ```typescript
   // Python: async with aiohttp.ClientSession()
   // TypeScript: Native fetch() API
   const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
   ```

3. **Type Safety**
   ```typescript
   // Strict interfaces for all data
   interface OptionContract {
     symbol: string;
     strike: number;
     expiry: Date;
     type: 'call' | 'put';
   }
   ```

### Multi-Tenant Architecture

#### Database Schema (D1)
```sql
-- Core tables (shared)
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK(role IN ('owner', 'admin', 'member'))
);

-- Encrypted credentials
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  provider TEXT NOT NULL, -- 'alpaca', 'polygon', etc
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Per-tenant strategy tables (dynamic)
-- Created on org signup: strategies_{org_id}, trades_{org_id}, etc.
```

#### Durable Objects for Tenant Isolation
```typescript
export class TradingSession extends DurableObject {
  private tenantId: string;
  private connections: Map<WebSocket, ConnectionInfo> = new Map();
  
  async fetch(request: Request): Promise<Response> {
    // Extract tenant from subdomain or JWT
    this.tenantId = this.extractTenant(request);
    
    // Tenant-specific operations only
    return this.handleWebSocketUpgrade(request);
  }
}
```

### Security Architecture

#### Credential Encryption
```typescript
class CredentialManager {
  private key: CryptoKey;
  
  async encrypt(credentials: AlpacaCredentials): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(credentials));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      encoded
    );
    
    // Store IV with encrypted data
    return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
  }
}
```

#### API Rate Limiting
```typescript
class RateLimiter {
  async checkLimit(tenantId: string, endpoint: string): Promise<boolean> {
    const key = `rate:${tenantId}:${endpoint}`;
    const count = await env.KV.get(key);
    
    if (count && parseInt(count) >= this.limits[endpoint]) {
      return false;
    }
    
    await env.KV.put(key, String((parseInt(count || '0') + 1)), {
      expirationTtl: 60 // 1 minute window
    });
    
    return true;
  }
}
```

### Performance Optimizations

#### Caching Strategy
- **KV**: API responses, market data (TTL: 1-5 min)
- **Cache API**: Static assets, backtest results
- **Durable Objects**: Active trading sessions

#### Streaming Responses
```typescript
// For large backtest results
export async function streamBacktestResults(id: string): Promise<Response> {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  // Don't await - stream in background
  env.ctx.waitUntil(
    streamFromR2(id, writer)
  );
  
  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson' }
  });
}
```

### Cost Analysis

#### Cloudflare vs Traditional Cloud (Monthly)
| Service | AWS | Cloudflare | Savings |
|---------|-----|------------|---------|
| Compute | $500 | $50 | 90% |
| Storage | $100 | $15 | 85% |
| Bandwidth | $200 | $0 | 100% |
| Database | $300 | $5 | 98% |
| **Total** | **$1100** | **$70** | **94%** |

### Development Workflow

1. **Local Development**
   ```bash
   npx wrangler dev --local --persist
   ```

2. **Testing**
   ```bash
   npm test -- --coverage
   ```

3. **Staging Deployment**
   ```bash
   npx wrangler deploy --env staging
   ```

4. **Production**
   ```bash
   npx wrangler deploy --env production
   ```

### Monitoring & Observability

- **Cloudflare Analytics**: Built-in metrics
- **Custom Logging**: To R2 for analysis
- **Error Tracking**: Durable Object state
- **Performance**: Web Analytics API

### Future Scalability

1. **Horizontal Scaling**: Automatic with Workers
2. **Data Sharding**: By tenant ID
3. **Global Replication**: D1 read replicas
4. **Edge Caching**: Automatic with Cloudflare

This architecture provides a solid foundation for the ULTRA trading platform while maintaining flexibility for future enhancements.