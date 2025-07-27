/**
 * ULTRA Trading Platform - Service Layer
 * Business logic and data access services
 */

import type { 
  HonoContext, 
  TradingStrategy, 
  BacktestRequest, 
  BacktestResult, 
  MarketData,
  User,
  AIAnalysisRequest,
  AIAnalysisResponse,
  HealthStatus,
  HealthCheck
} from '../types';
import { 
  AppError, 
  createCacheKey,
  createCacheEntry,
  isCacheEntryValid,
  timeout,
  createLogger
} from '../utils';

/**
 * Database Service
 * Core database operations with caching
 */
export class DatabaseService {
  private ctx: HonoContext;
  
  constructor(ctx: HonoContext) {
    this.ctx = ctx;
  }

  async createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    
    const user: User = {
      id,
      created_at,
      ...userData
    };

    await this.ctx.env.DB
      .prepare(`
        INSERT INTO users (id, email, name, tenant_id, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(user.id, user.email, user.name, user.tenant_id, user.role, user.created_at)
      .run();

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    const cacheKey = createCacheKey('user', id);
    
    // Try cache first
    const cached = await this.ctx.env.CACHE.get(cacheKey);
    if (cached) {
      const entry = JSON.parse(cached);
      if (isCacheEntryValid(entry)) {
        return entry.value;
      }
    }

    // Query database
    const result = await this.ctx.env.DB
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<User>();

    if (result) {
      // Cache for 5 minutes
      const cacheEntry = createCacheEntry(result, 300);
      await this.ctx.env.CACHE.put(cacheKey, JSON.stringify(cacheEntry));
    }

    return result || null;
  }

  async createStrategy(strategy: Omit<TradingStrategy, 'id' | 'created_at' | 'updated_at'>): Promise<TradingStrategy> {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    const newStrategy: TradingStrategy = {
      id,
      created_at: timestamp,
      updated_at: timestamp,
      ...strategy
    };

    await this.ctx.env.DB
      .prepare(`
        INSERT INTO strategies (id, name, description, type, parameters, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        newStrategy.id,
        newStrategy.name,
        newStrategy.description,
        newStrategy.type,
        JSON.stringify(newStrategy.parameters),
        newStrategy.enabled ? 1 : 0,
        newStrategy.created_at,
        newStrategy.updated_at
      )
      .run();

    return newStrategy;
  }

  async getStrategiesByTenant(tenantId: string): Promise<TradingStrategy[]> {
    const result = await this.ctx.env.DB
      .prepare(`
        SELECT s.* FROM strategies s
        JOIN users u ON s.created_by = u.id
        WHERE u.tenant_id = ?
        ORDER BY s.created_at DESC
      `)
      .bind(tenantId)
      .all<TradingStrategy>();

    return result.results || [];
  }
}

/**
 * Market Data Service
 * Handles real-time and historical market data
 */
export class MarketDataService {
  private ctx: HonoContext;
  
  constructor(ctx: HonoContext) {
    this.ctx = ctx;
  }

  async getCurrentPrice(symbol: string): Promise<MarketData | null> {
    const logger = createLogger(this.ctx);
    const cacheKey = createCacheKey('price', symbol);
    
    try {
      // Try cache first (1 minute TTL for real-time data)
      const cached = await this.ctx.env.CACHE.get(cacheKey);
      if (cached) {
        const entry = JSON.parse(cached);
        if (isCacheEntryValid(entry)) {
          logger.debug('Price data served from cache', { symbol });
          return entry.value;
        }
      }

      // Fetch from external API (placeholder - would integrate with Alpaca, Polygon, etc.)
      const response = await timeout(
        fetch(`https://api.example.com/v1/last/stocks/${symbol}`),
        5000 // 5 second timeout
      );

      if (!response.ok) {
        throw new AppError('MARKET_DATA_ERROR', `Failed to fetch price for ${symbol}`);
      }

      const data = await response.json() as MarketData;
      
      // Cache for 1 minute
      const cacheEntry = createCacheEntry(data, 60);
      await this.ctx.env.CACHE.put(cacheKey, JSON.stringify(cacheEntry));

      logger.info('Price data fetched', { symbol, price: data.price });
      return data;

    } catch (error) {
      logger.error('Failed to fetch market data', { symbol, error: (error as Error).message });
      return null;
    }
  }

  async getHistoricalData(
    symbol: string, 
    startDate: string, 
    endDate: string,
    timeframe: string = '1D'
  ): Promise<MarketData[]> {
    const logger = createLogger(this.ctx);
    const cacheKey = createCacheKey('historical', symbol, startDate, endDate, timeframe);
    
    try {
      // Check cache (longer TTL for historical data)
      const cached = await this.ctx.env.CACHE.get(cacheKey);
      if (cached) {
        const entry = JSON.parse(cached);
        if (isCacheEntryValid(entry)) {
          logger.debug('Historical data served from cache', { symbol, startDate, endDate });
          return entry.value;
        }
      }

      // Fetch historical data (placeholder implementation)
      const response = await timeout(
        fetch(`https://api.example.com/v1/bars?symbol=${symbol}&start=${startDate}&end=${endDate}&timeframe=${timeframe}`),
        10000 // 10 second timeout for larger datasets
      );

      if (!response.ok) {
        throw new AppError('MARKET_DATA_ERROR', `Failed to fetch historical data for ${symbol}`);
      }

      const data = await response.json() as MarketData[];
      
      // Cache for 1 hour
      const cacheEntry = createCacheEntry(data, 3600);
      await this.ctx.env.CACHE.put(cacheKey, JSON.stringify(cacheEntry));

      logger.info('Historical data fetched', { 
        symbol, 
        startDate, 
        endDate, 
        recordCount: data.length 
      });
      
      return data;

    } catch (error) {
      logger.error('Failed to fetch historical data', { 
        symbol, 
        startDate, 
        endDate, 
        error: (error as Error).message 
      });
      throw error;
    }
  }
}

/**
 * Backtest Service
 * Handles strategy backtesting operations
 */
export class BacktestService {
  private ctx: HonoContext;
  
  constructor(ctx: HonoContext) {
    this.ctx = ctx;
  }

  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    const logger = createLogger(this.ctx);
    const backtestId = crypto.randomUUID();
    
    try {
      logger.info('Starting backtest', { 
        backtestId, 
        strategyId: request.strategy.id,
        symbols: request.symbols 
      });

      // Store backtest request in R2 for processing
      const requestKey = `backtests/${backtestId}/request.json`;
      await this.ctx.env.DATA_BUCKET.put(requestKey, JSON.stringify(request));

      // For now, return a placeholder result
      // In production, this would queue a background job
      const result: BacktestResult = {
        id: backtestId,
        strategy_id: request.strategy.id,
        total_return: 0.15, // 15% return
        annual_return: 0.12,
        sharpe_ratio: 1.2,
        max_drawdown: 0.08,
        win_rate: 0.65,
        profit_factor: 1.4,
        total_trades: 150,
        avg_trade_duration: 2.5,
        created_at: new Date().toISOString()
      };

      // Store result in database
      await this.ctx.env.DB
        .prepare(`
          INSERT INTO backtest_results (
            id, strategy_id, total_return, annual_return, sharpe_ratio,
            max_drawdown, win_rate, profit_factor, total_trades,
            avg_trade_duration, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          result.id,
          result.strategy_id,
          result.total_return,
          result.annual_return,
          result.sharpe_ratio,
          result.max_drawdown,
          result.win_rate,
          result.profit_factor,
          result.total_trades,
          result.avg_trade_duration,
          result.created_at
        )
        .run();

      logger.info('Backtest completed', { backtestId, totalReturn: result.total_return });
      return result;

    } catch (error) {
      logger.error('Backtest failed', { backtestId, error: (error as Error).message });
      throw new AppError('BACKTEST_ERROR', 'Failed to run backtest', 500, { backtestId });
    }
  }

  async getBacktestResult(id: string): Promise<BacktestResult | null> {
    const result = await this.ctx.env.DB
      .prepare('SELECT * FROM backtest_results WHERE id = ?')
      .bind(id)
      .first<BacktestResult>();

    return result || null;
  }
}

/**
 * AI Analysis Service
 * Integrates with Anthropic Claude and Google Gemini
 */
export class AIService {
  private ctx: HonoContext;
  
  constructor(ctx: HonoContext) {
    this.ctx = ctx;
  }

  async analyzeStrategy(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const logger = createLogger(this.ctx);
    const startTime = performance.now();

    try {
      logger.info('Starting AI analysis', { type: request.type });

      let analysis: string;
      let modelUsed: string;

      // Choose model based on preference and availability
      if (request.model_preference === 'claude' || request.model_preference === 'auto') {
        try {
          analysis = await this.analyzeWithClaude(request);
          modelUsed = 'claude-3-sonnet';
        } catch (error) {
          logger.warn('Claude analysis failed, falling back to Gemini', { error: (error as Error).message });
          analysis = await this.analyzeWithGemini(request);
          modelUsed = 'gemini-pro';
        }
      } else {
        analysis = await this.analyzeWithGemini(request);
        modelUsed = 'gemini-pro';
      }

      const executionTime = performance.now() - startTime;

      const response: AIAnalysisResponse = {
        analysis,
        confidence: 0.85, // Placeholder confidence score
        recommendations: this.extractRecommendations(analysis),
        model_used: modelUsed,
        execution_time_ms: Math.round(executionTime)
      };

      logger.info('AI analysis completed', { 
        modelUsed, 
        executionTimeMs: response.execution_time_ms 
      });

      return response;

    } catch (error) {
      logger.error('AI analysis failed', { error: (error as Error).message });
      throw new AppError('AI_ANALYSIS_ERROR', 'Failed to analyze strategy', 500);
    }
  }

  private async analyzeWithClaude(request: AIAnalysisRequest): Promise<string> {
    if (!this.ctx.env.ANTHROPIC_API_KEY) {
      throw new AppError('CONFIG_ERROR', 'Anthropic API key not configured');
    }

    const prompt = this.buildAnalysisPrompt(request);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.ctx.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new AppError('CLAUDE_API_ERROR', 'Claude API request failed');
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0]?.text ?? '';
  }

  private async analyzeWithGemini(request: AIAnalysisRequest): Promise<string> {
    if (!this.ctx.env.GOOGLE_AI_API_KEY) {
      throw new AppError('CONFIG_ERROR', 'Google AI API key not configured');
    }

    const prompt = this.buildAnalysisPrompt(request);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.ctx.env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new AppError('GEMINI_API_ERROR', 'Gemini API request failed');
    }

    const data = await response.json() as { 
      candidates: Array<{ 
        content: { 
          parts: Array<{ text: string }> 
        } 
      }> 
    };
    return data.candidates[0]?.content.parts[0]?.text ?? '';
  }

  private buildAnalysisPrompt(request: AIAnalysisRequest): string {
    switch (request.type) {
      case 'strategy_optimization':
        return `Analyze this trading strategy and provide optimization recommendations: ${JSON.stringify(request.data)}`;
      case 'market_analysis':
        return `Provide market analysis based on this data: ${JSON.stringify(request.data)}`;
      case 'risk_assessment':
        return `Assess the risk profile of this trading setup: ${JSON.stringify(request.data)}`;
      default:
        return `Analyze this trading data: ${JSON.stringify(request.data)}`;
    }
  }

  private extractRecommendations(analysis: string): string[] {
    // Simple extraction - in production, use more sophisticated NLP
    const sentences = analysis.split(/[.!?]+/);
    return sentences
      .filter(sentence => 
        sentence.toLowerCase().includes('recommend') || 
        sentence.toLowerCase().includes('suggest') ||
        sentence.toLowerCase().includes('should')
      )
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 10)
      .slice(0, 5); // Top 5 recommendations
  }
}

/**
 * Export Alpaca services
 */
export * from './alpaca';

/**
 * Health Check Service
 * Monitors system health and dependencies
 */
export class HealthService {
  private ctx: HonoContext;
  
  constructor(ctx: HonoContext) {
    this.ctx = ctx;
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = performance.now();
    const checks: HealthCheck[] = [];

    // Database health check
    checks.push(await this.checkDatabase());

    // KV health check
    checks.push(await this.checkKV());

    // R2 health check
    checks.push(await this.checkR2());

    // External API health check
    checks.push(await this.checkExternalAPIs());

    const overallStatus = checks.every(check => check.status === 'pass') 
      ? 'healthy' 
      : checks.some(check => check.status === 'fail') 
        ? 'unhealthy' 
        : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: this.ctx.env.API_VERSION || '1.0.0',
      environment: this.ctx.env.ENVIRONMENT || 'development',
      checks,
      uptime_seconds: Math.round((performance.now() - startTime) / 1000)
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      await this.ctx.env.DB.prepare('SELECT 1').first();
      
      return {
        name: 'database',
        status: 'pass',
        duration_ms: Math.round(performance.now() - startTime)
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        duration_ms: Math.round(performance.now() - startTime),
        message: (error as Error).message
      };
    }
  }

  private async checkKV(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      const testKey = 'health_check_test';
      await this.ctx.env.CACHE.put(testKey, 'test', { expirationTtl: 60 });
      await this.ctx.env.CACHE.get(testKey);
      await this.ctx.env.CACHE.delete(testKey);
      
      return {
        name: 'kv_storage',
        status: 'pass',
        duration_ms: Math.round(performance.now() - startTime)
      };
    } catch (error) {
      return {
        name: 'kv_storage',
        status: 'fail',
        duration_ms: Math.round(performance.now() - startTime),
        message: (error as Error).message
      };
    }
  }

  private async checkR2(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      const testKey = 'health_check_test.txt';
      await this.ctx.env.DATA_BUCKET.put(testKey, 'test');
      await this.ctx.env.DATA_BUCKET.get(testKey);
      await this.ctx.env.DATA_BUCKET.delete(testKey);
      
      return {
        name: 'r2_storage',
        status: 'pass',
        duration_ms: Math.round(performance.now() - startTime)
      };
    } catch (error) {
      return {
        name: 'r2_storage',
        status: 'fail',
        duration_ms: Math.round(performance.now() - startTime),
        message: (error as Error).message
      };
    }
  }

  private async checkExternalAPIs(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      // Test a simple external API call
      const response = await timeout(
        fetch('https://httpbin.org/status/200'),
        3000
      );
      
      if (response.ok) {
        return {
          name: 'external_apis',
          status: 'pass',
          duration_ms: Math.round(performance.now() - startTime)
        };
      } else {
        return {
          name: 'external_apis',
          status: 'warn',
          duration_ms: Math.round(performance.now() - startTime),
          message: 'External API returned non-200 status'
        };
      }
    } catch (error) {
      return {
        name: 'external_apis',
        status: 'fail',
        duration_ms: Math.round(performance.now() - startTime),
        message: (error as Error).message
      };
    }
  }
}