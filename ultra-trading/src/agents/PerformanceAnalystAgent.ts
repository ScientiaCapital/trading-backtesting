/**
 * Performance Analyst Agent
 * Tracks daily P&L, monitors profit targets, and triggers automatic stops
 * Critical for achieving the $300/day profit target
 */

import { AIAgent } from './base/BaseAgent';
import {
  AgentType,
  AgentMessage,
  IPerformanceAgent,
  PerformanceStatus,
  MessageType,
  MessagePriority,
  AgentConfig
} from '@/types/agents';
import { CloudflareBindings } from '@/types';

interface PerformanceAnalysisResponse {
  currentPnL: number;
  targetProgress: number;
  winRate: number;
  avgWinSize: number;
  avgLossSize: number;
  profitFactor: number;
  recommendation: 'CONTINUE' | 'SLOW_DOWN' | 'STOP';
  insights: string[];
  projectedEndOfDayPnL: number;
}

export class PerformanceAnalystAgent extends AIAgent implements IPerformanceAgent {
  private env?: CloudflareBindings;
  
  // Performance parameters
  private readonly DAILY_PROFIT_TARGET = 300; // $300 daily target
  private readonly DAILY_LOSS_LIMIT = 300; // $300 max loss
  private readonly MIN_WIN_RATE = 0.4; // 40% minimum win rate
  // private readonly TARGET_PROFIT_FACTOR = 1.5; // Target 1.5:1 profit factor - unused
  
  // Performance tracking
  private dailyMetrics: PerformanceStatus = {
    dailyPnL: 0,
    dailyTarget: this.DAILY_PROFIT_TARGET,
    targetProgress: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    currentDrawdown: 0,
    shouldStop: false
  };
  
  constructor(config: AgentConfig, env?: CloudflareBindings) {
    super(AgentType.PERFORMANCE_ANALYST, {
      ...config,
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      temperature: 0.2, // Low temperature for consistent analysis
      maxTokens: 2048,
      systemPrompt: `You are a performance analyst AI for a trading system.
        Your primary goal is to track daily P&L and ensure the system stops at $${300} profit.
        Analyze trading performance, identify patterns, and provide insights to improve results.
        Monitor win rates, profit factors, and drawdowns.
        Be objective in your analysis and prioritize achieving daily profit targets safely.`
    });
    this.env = env;
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Performance Analyst Agent initialized', {
      model: this.config.model,
      agentId: this.id,
      dailyTarget: this.DAILY_PROFIT_TARGET,
      dailyLossLimit: this.DAILY_LOSS_LIMIT
    });
    
    // Load saved performance metrics if available
    await this.loadDailyMetrics();
  }

  protected async handleMessage(message: AgentMessage): Promise<AgentMessage | null> {
    switch (message.type) {
      case MessageType.EXECUTION_RESULT:
        // Update metrics after trade execution
        const { trade, pnl } = message.payload as { trade: any; pnl: number };
        await this.updateTradeMetrics(trade, pnl);
        
        // Check if we should stop trading
        const status = await this.trackPerformance();
        
        if (status.shouldStop) {
          return this.createMessage(
            'BROADCAST',
            MessageType.STOP_TRADING,
            {
              reason: status.reason || 'Daily target reached',
              performance: status
            },
            MessagePriority.CRITICAL
          );
        }
        
        // Send performance update
        return this.createMessage(
          'BROADCAST',
          MessageType.PERFORMANCE_UPDATE,
          status,
          MessagePriority.NORMAL
        );
        
      case MessageType.MARKET_UPDATE:
        // Periodically check performance
        const currentStatus = await this.trackPerformance();
        
        if (currentStatus.shouldStop) {
          return this.createMessage(
            'BROADCAST',
            MessageType.STOP_TRADING,
            {
              reason: currentStatus.reason || 'Daily target reached',
              performance: currentStatus
            },
            MessagePriority.CRITICAL
          );
        }
        
        return null;
        
      default:
        this.logger.debug('Ignoring message type', { type: message.type });
        return null;
    }
  }

  protected async onShutdown(): Promise<void> {
    // Save current metrics
    await this.saveDailyMetrics();
    this.logger.info('Performance Analyst Agent shutting down', {
      finalMetrics: this.dailyMetrics
    });
  }

  /**
   * Track current performance and determine if we should stop
   */
  async trackPerformance(): Promise<PerformanceStatus> {
    // Calculate current metrics
    const targetProgress = (this.dailyMetrics.dailyPnL / this.DAILY_PROFIT_TARGET) * 100;
    const winRate = this.dailyMetrics.totalTrades > 0 
      ? this.dailyMetrics.winningTrades / this.dailyMetrics.totalTrades 
      : 0;
    
    // Update metrics
    this.dailyMetrics.targetProgress = targetProgress;
    
    // Check stop conditions
    let shouldStop = false;
    let reason: string | undefined;
    
    // 1. Daily profit target reached
    if (this.dailyMetrics.dailyPnL >= this.DAILY_PROFIT_TARGET) {
      shouldStop = true;
      reason = `Daily profit target reached: $${this.dailyMetrics.dailyPnL.toFixed(2)}`;
      this.logger.info('🎯 DAILY TARGET ACHIEVED!', {
        profit: this.dailyMetrics.dailyPnL,
        trades: this.dailyMetrics.totalTrades
      });
    }
    
    // 2. Daily loss limit reached
    if (this.dailyMetrics.dailyPnL <= -this.DAILY_LOSS_LIMIT) {
      shouldStop = true;
      reason = `Daily loss limit reached: $${Math.abs(this.dailyMetrics.dailyPnL).toFixed(2)}`;
      this.logger.warn('⚠️ DAILY LOSS LIMIT REACHED', {
        loss: this.dailyMetrics.dailyPnL,
        trades: this.dailyMetrics.totalTrades
      });
    }
    
    // 3. Poor performance after minimum trades
    if (this.dailyMetrics.totalTrades >= 10 && winRate < this.MIN_WIN_RATE) {
      shouldStop = true;
      reason = `Win rate too low: ${(winRate * 100).toFixed(1)}%`;
      this.logger.warn('Poor performance detected', {
        winRate,
        trades: this.dailyMetrics.totalTrades
      });
    }
    
    this.dailyMetrics.shouldStop = shouldStop;
    this.dailyMetrics.reason = reason;
    
    // Generate AI insights if needed
    if (this.dailyMetrics.totalTrades > 0 && this.dailyMetrics.totalTrades % 5 === 0) {
      await this.generatePerformanceInsights();
    }
    
    return { ...this.dailyMetrics };
  }

  /**
   * Check if daily target has been reached
   */
  async checkDailyTarget(): Promise<boolean> {
    return this.dailyMetrics.dailyPnL >= this.DAILY_PROFIT_TARGET;
  }

  /**
   * Generate performance report
   */
  async generateReport(): Promise<string> {
    const winRate = this.dailyMetrics.totalTrades > 0 
      ? (this.dailyMetrics.winningTrades / this.dailyMetrics.totalTrades * 100).toFixed(1)
      : '0.0';
    
    const report = `
📊 Daily Performance Report
═══════════════════════════

💰 P&L: $${this.dailyMetrics.dailyPnL.toFixed(2)} / $${this.DAILY_PROFIT_TARGET}
📈 Progress: ${this.dailyMetrics.targetProgress.toFixed(1)}%
📊 Total Trades: ${this.dailyMetrics.totalTrades}
✅ Winning Trades: ${this.dailyMetrics.winningTrades}
❌ Losing Trades: ${this.dailyMetrics.losingTrades}
🎯 Win Rate: ${winRate}%
📉 Current Drawdown: ${(this.dailyMetrics.currentDrawdown * 100).toFixed(1)}%

${this.dailyMetrics.shouldStop ? `⛔ TRADING STOPPED: ${this.dailyMetrics.reason}` : '✅ Trading Active'}
    `;
    
    return report.trim();
  }

  /**
   * Update metrics after a trade
   */
  private async updateTradeMetrics(trade: any, pnl: number): Promise<void> {
    this.dailyMetrics.totalTrades++;
    this.dailyMetrics.dailyPnL += pnl;
    
    if (pnl > 0) {
      this.dailyMetrics.winningTrades++;
    } else if (pnl < 0) {
      this.dailyMetrics.losingTrades++;
    }
    
    // Update drawdown
    if (this.dailyMetrics.dailyPnL < 0) {
      this.dailyMetrics.currentDrawdown = Math.abs(this.dailyMetrics.dailyPnL) / this.DAILY_PROFIT_TARGET;
    } else {
      this.dailyMetrics.currentDrawdown = 0;
    }
    
    // Log trade result
    this.logger.info('Trade completed', {
      symbol: trade.symbol,
      pnl,
      totalDailyPnL: this.dailyMetrics.dailyPnL,
      targetProgress: this.dailyMetrics.targetProgress
    });
  }

  /**
   * Generate AI-powered performance insights
   */
  private async generatePerformanceInsights(): Promise<void> {
    const prompt = `
      Analyze this trading performance:
      
      Daily P&L: $${this.dailyMetrics.dailyPnL.toFixed(2)}
      Target: $${this.DAILY_PROFIT_TARGET}
      Total Trades: ${this.dailyMetrics.totalTrades}
      Winning Trades: ${this.dailyMetrics.winningTrades}
      Losing Trades: ${this.dailyMetrics.losingTrades}
      Win Rate: ${(this.dailyMetrics.winningTrades / this.dailyMetrics.totalTrades * 100).toFixed(1)}%
      
      Provide performance analysis in JSON format:
      {
        "currentPnL": ${this.dailyMetrics.dailyPnL},
        "targetProgress": ${this.dailyMetrics.targetProgress},
        "winRate": 0.6,
        "avgWinSize": 50,
        "avgLossSize": 30,
        "profitFactor": 1.5,
        "recommendation": "CONTINUE",
        "insights": [
          "Strong momentum in morning session",
          "Consider tightening stops after 3 consecutive wins"
        ],
        "projectedEndOfDayPnL": 350
      }
    `;
    
    try {
      if (this.env?.AI) {
        const result = await this.env.AI.run(
          this.config.model as any,
          {
            prompt,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
          }
        );
        
        const analysis = JSON.parse((result as any).response || '{}') as PerformanceAnalysisResponse;
        
        // Log insights
        this.logger.info('Performance insights generated', {
          insights: analysis.insights,
          recommendation: analysis.recommendation,
          projectedPnL: analysis.projectedEndOfDayPnL
        });
      }
    } catch (error) {
      this.logger.error('Failed to generate insights', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Load daily metrics from storage
   */
  private async loadDailyMetrics(): Promise<void> {
    // In production, this would load from KV or D1
    // For now, start fresh each day
    // const todayKey = `performance:${new Date().toISOString().split('T')[0]}`; // For future KV storage
    
    // Reset metrics at start of day
    this.dailyMetrics = {
      dailyPnL: 0,
      dailyTarget: this.DAILY_PROFIT_TARGET,
      targetProgress: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      currentDrawdown: 0,
      shouldStop: false
    };
  }

  /**
   * Save daily metrics to storage
   */
  private async saveDailyMetrics(): Promise<void> {
    // In production, save to KV or D1
    const todayKey = `performance:${new Date().toISOString().split('T')[0]}`;
    
    this.logger.info('Saving daily metrics', {
      key: todayKey,
      metrics: this.dailyMetrics
    });
  }

  /**
   * Reset daily metrics (called at midnight)
   */
  public override resetDailyMetrics(): void {
    this.logger.info('Resetting daily metrics', {
      previousMetrics: this.dailyMetrics
    });
    
    this.dailyMetrics = {
      dailyPnL: 0,
      dailyTarget: this.DAILY_PROFIT_TARGET,
      targetProgress: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      currentDrawdown: 0,
      shouldStop: false
    };
  }
}