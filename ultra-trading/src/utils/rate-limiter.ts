/**
 * Rate Limiter
 * Prevents API rate limit violations
 */

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  async checkLimit(key: string): Promise<void> {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(
      timestamp => now - timestamp < this.config.windowMs
    );

    if (validRequests.length >= this.config.maxRequests) {
      const oldestRequest = validRequests[0];
      if (oldestRequest !== undefined) {
        const waitTime = this.config.windowMs - (now - oldestRequest);
        throw new RateLimitError(waitTime);
      }
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  resetAll(): void {
    this.requests.clear();
  }
}

export class RateLimitError extends Error {
  constructor(public waitTimeMs: number) {
    super(`Rate limit exceeded. Wait ${waitTimeMs}ms before retrying.`);
    this.name = 'RateLimitError';
  }
}