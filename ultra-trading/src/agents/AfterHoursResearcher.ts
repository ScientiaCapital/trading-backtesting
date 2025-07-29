/**
 * ULTRA Trading Platform - After Hours Researcher Agent
 * Analyzes today's trades and prepares for tomorrow (4:30 PM activation)
 */

import { AIAgent } from './base/BaseAgent';
import type { 
  CloudflareBindings, 
  AgentConfig, 
  AgentResponse,
  AgentMessage
} from '../types';
import { AgentType, MessagePriority } from '../types/agents';
import type { StrategyParameters } from '../types/backtesting';
import { FastquantBacktester } from '../services/backtesting/FastquantBacktester';
import { AlpacaTradingService } from '../services/alpaca/AlpacaTradingService';
import { AlpacaMarketData } from '../services/alpaca/AlpacaMarketData';
import { OptionsFlowAnalyst } from './OptionsFlowAnalyst';
import { TradingTime } from '../utils/TradingTime';

interface AfterHoursAnalysis {
  todaysSummary: {
    totalTrades: number;
    realizedPnL: number;
    winRate: number;
    bestTrade: TradeDetail;
    worstTrade: TradeDetail;
  };
  tomorrowsSetup: {
    watchlist: WatchlistItem[];
    odteSetups: OptionSetup[];
    optimizedStrategies: StrategyRecommendation[];
    marketOutlook: string;
  };
  overnightGaps: GapAnalysis[];
  riskAdjustments: RiskRecommendation[];
}

interface TradeDetail {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  holdingPeriod: number; // minutes
}

interface WatchlistItem {
  symbol: string;
  reason: string;
  expectedMove: number;
  confidence: number;
  strategy: string;
}

interface OptionSetup {
  symbol: string;
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  expectedPremium: number;
  volumeRatio: number;
}

interface StrategyRecommendation {
  symbol: string;
  strategy: string;
  parameters: StrategyParameters;
  expectedReturn: number;
  confidence: number;
}

interface GapAnalysis {
  symbol: string;
  afterHoursMove: number;
  volume: number;
  news: boolean;
  gapFillProbability: number;
}

interface RiskAdjustment {
  multiplier?: number;
  tighten?: number;
  strategy?: string;
  duration?: string;
}

interface RiskRecommendation {
  type: 'position_size' | 'stop_loss' | 'strategy_disable';
  reason: string;
  adjustment: RiskAdjustment;
}

export class AfterHoursResearcher extends AIAgent {
  private backtester!: FastquantBacktester;
  private tradingService!: AlpacaTradingService;
  private marketData!: AlpacaMarketData;
  private optionsAnalyst!: OptionsFlowAnalyst;
  private tradingTime!: TradingTime;

  protected env!: CloudflareBindings;
  protected requestId!: string;
  
  constructor(config: AgentConfig) {
    super(AgentType.AFTER_HOURS_RESEARCHER, config);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize services when env is available
  }
  
  protected async onShutdown(): Promise<void> {
    // Cleanup resources
  }
  
  setEnvironment(env: CloudflareBindings, requestId: string): void {
    this.env = env;
    this.requestId = requestId;
    this.backtester = new FastquantBacktester(env, requestId);
    this.tradingService = new AlpacaTradingService(env, requestId);
    this.marketData = new AlpacaMarketData(env, requestId);
    this.optionsAnalyst = new OptionsFlowAnalyst(this.config);
    this.tradingTime = new TradingTime();
  }

  protected async handleMessage(message: AgentMessage): Promise<AgentMessage | null> {
    // Initialize services if needed
    interface ExtendedMessage extends AgentMessage {
      env?: CloudflareBindings;
      requestId?: string;
    }
    const extMessage = message as ExtendedMessage;
    if (!this.env && extMessage.env) {
      this.setEnvironment(extMessage.env, extMessage.requestId || this.id);
    }
    
    const response = await this.processAfterHoursMessage(message.payload as { forceRun?: boolean });
    return this.createMessage(
      message.from,
      'ANALYSIS_RESULT',
      response,
      message.priority || MessagePriority.NORMAL
    );
  }
  
  async processAfterHoursMessage(payload: { forceRun?: boolean }): Promise<AgentResponse> {
    try {
      // Check if it's after hours (after 4:30 PM ET)
      const now = this.tradingTime.getCurrentEasternTime();
      const activationTime = new Date(now);
      activationTime.setHours(16, 30, 0, 0); // 4:30 PM ET

      if (now < activationTime && !payload.forceRun) {
        return {
          success: true,
          action: 'WAIT',
          data: {
            message: 'AfterHoursResearcher activates at 4:30 PM ET',
            nextRunTime: activationTime.toISOString()
          },
          confidence: 1.0
        };
      }

      // Perform after-hours analysis
      const analysis = await this.performAfterHoursAnalysis();

      // Generate morning briefing
      const briefing = this.generateMorningBriefing(analysis);

      // Store results for tomorrow's trading
      await this.storeAnalysisResults(analysis);

      return {
        success: true,
        action: 'ANALYSIS_COMPLETE',
        data: {
          analysis,
          briefing,
          nextMarketOpen: this.tradingTime.getNextMarketOpen().toISOString()
        },
        confidence: 0.9
      };
    } catch (error) {
      console.error(`[${this.requestId}] After-hours analysis failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  private async performAfterHoursAnalysis(): Promise<AfterHoursAnalysis> {
    // 1. Analyze today's closed positions
    const todaysSummary = await this.analyzeTodaysTrades();

    // 2. Scan options flow for tomorrow's 0DTE setups
    const odteSetups = await this.scanTomorrowsOptionsFlow();

    // 3. Run strategy optimization
    const optimizedStrategies = await this.optimizeStrategiesForTomorrow();

    // 4. Analyze overnight gaps
    const overnightGaps = await this.analyzeOvernightGaps();

    // 5. Generate watchlist
    const watchlist = await this.generateWatchlist(
      todaysSummary,
      odteSetups,
      optimizedStrategies
    );

    // 6. Calculate risk adjustments
    const riskAdjustments = this.calculateRiskAdjustments(todaysSummary);

    // 7. Generate market outlook
    const marketOutlook = await this.generateMarketOutlook();

    return {
      todaysSummary,
      tomorrowsSetup: {
        watchlist,
        odteSetups,
        optimizedStrategies,
        marketOutlook
      },
      overnightGaps,
      riskAdjustments
    };
  }

  private async analyzeTodaysTrades(): Promise<AfterHoursAnalysis['todaysSummary']> {
    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await this.tradingService.getOrders(
      'closed',
      500,
      today.toISOString()
    );

    // Calculate metrics
    let totalPnL = 0;
    let winningTrades = 0;
    let bestTrade: TradeDetail | null = null;
    let worstTrade: TradeDetail | null = null;

    const trades: TradeDetail[] = [];

    for (const order of orders) {
      if (order.filled_qty && order.filled_avg_price) {
        // This is simplified - in production, match buy/sell pairs
        const trade: TradeDetail = {
          symbol: order.symbol,
          side: order.side as 'buy' | 'sell',
          quantity: parseFloat(order.filled_qty),
          entryPrice: parseFloat(order.filled_avg_price),
          exitPrice: parseFloat(order.filled_avg_price), // Would need exit order
          pnl: 0, // Calculate based on matched orders
          holdingPeriod: 0 // Calculate from timestamps
        };

        trades.push(trade);

        if (trade.pnl > 0) winningTrades++;
        totalPnL += trade.pnl;

        if (!bestTrade || trade.pnl > bestTrade.pnl) {
          bestTrade = trade;
        }
        if (!worstTrade || trade.pnl < worstTrade.pnl) {
          worstTrade = trade;
        }
      }
    }

    return {
      totalTrades: trades.length,
      realizedPnL: totalPnL,
      winRate: trades.length > 0 ? winningTrades / trades.length : 0,
      bestTrade: bestTrade || this.getEmptyTrade(),
      worstTrade: worstTrade || this.getEmptyTrade()
    };
  }

  private async scanTomorrowsOptionsFlow(): Promise<OptionSetup[]> {
    // Get tomorrow's date for 0DTE
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiryDate = tomorrow.toISOString().split('T')[0];

    // Get options flow analysis
    this.optionsAnalyst.setEnvironment(this.env);
    const flowSignals = await this.optionsAnalyst.analyzeOptionsFlow();

    const setups: OptionSetup[] = [];

    for (const signal of flowSignals) {
      if (signal.expiration === expiryDate) {
        setups.push({
          symbol: signal.symbol,
          strike: signal.strike,
          expiry: signal.expiration,
          type: signal.type,
          expectedPremium: signal.takeProfit,
          volumeRatio: signal.volumeRatio
        });
      }
    }

    return setups.slice(0, 5); // Top 5 setups
  }

  private async optimizeStrategiesForTomorrow(): Promise<StrategyRecommendation[]> {
    const symbols = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'TSLA'];
    
    try {
      const report = await this.backtester.generateOptimizationReport(symbols);
      
      return report.map(item => ({
        symbol: item.symbol,
        strategy: item.strategy,
        parameters: item.parameters,
        expectedReturn: item.expectedReturn,
        confidence: item.confidence
      }));
    } catch (error) {
      console.error(`[${this.requestId}] Strategy optimization failed:`, error);
      return [];
    }
  }

  private async analyzeOvernightGaps(): Promise<GapAnalysis[]> {
    const watchSymbols = ['BTC/USD', 'ETH/USD', 'GLD', 'USO', 'VXX'];
    const gaps: GapAnalysis[] = [];

    for (const symbol of watchSymbols) {
      try {
        const snapshot = await this.marketData.getSnapshots([symbol]);
        const data = snapshot[symbol];

        if (data?.dailyBar && data.prevDailyBar) {
          const afterHoursMove = 
            ((data.dailyBar.c - data.prevDailyBar.c) / data.prevDailyBar.c) * 100;

          gaps.push({
            symbol,
            afterHoursMove,
            volume: data.dailyBar.v,
            news: Math.abs(afterHoursMove) > 2, // Simplified news detection
            gapFillProbability: this.calculateGapFillProbability(afterHoursMove)
          });
        }
      } catch (error) {
        console.error(`[${this.requestId}] Failed to analyze gap for ${symbol}:`, error);
      }
    }

    return gaps;
  }

  private async generateWatchlist(
    _todaysSummary: AfterHoursAnalysis['todaysSummary'],
    odteSetups: OptionSetup[],
    optimizedStrategies: StrategyRecommendation[]
  ): Promise<WatchlistItem[]> {
    const watchlist: WatchlistItem[] = [];

    // Add optimized strategy picks
    for (const strategy of optimizedStrategies) {
      if (strategy.confidence > 0.7) {
        watchlist.push({
          symbol: strategy.symbol,
          reason: `${strategy.strategy} optimization`,
          expectedMove: strategy.expectedReturn / 252, // Daily expected return
          confidence: strategy.confidence,
          strategy: strategy.strategy
        });
      }
    }

    // Add high-volume options flow
    for (const setup of odteSetups) {
      if (setup.volumeRatio > 5) {
        watchlist.push({
          symbol: setup.symbol,
          reason: `High options volume (${setup.volumeRatio}x)`,
          expectedMove: setup.type === 'call' ? 1 : -1,
          confidence: Math.min(0.9, setup.volumeRatio / 10),
          strategy: '0DTE_OPTIONS'
        });
      }
    }

    // Sort by confidence
    watchlist.sort((a, b) => b.confidence - a.confidence);

    return watchlist.slice(0, 10); // Top 10
  }

  private calculateRiskAdjustments(
    todaysSummary: AfterHoursAnalysis['todaysSummary']
  ): RiskRecommendation[] {
    const adjustments: RiskRecommendation[] = [];

    // Adjust based on today's performance
    if (todaysSummary.winRate < 0.3) {
      adjustments.push({
        type: 'position_size',
        reason: 'Low win rate today',
        adjustment: { multiplier: 0.5 }
      });
    }

    if (todaysSummary.realizedPnL < -500) {
      adjustments.push({
        type: 'stop_loss',
        reason: 'Significant losses today',
        adjustment: { tighten: 0.8 } // 80% of normal stop
      });
    }

    if (todaysSummary.worstTrade.pnl < -300) {
      adjustments.push({
        type: 'strategy_disable',
        reason: 'Large single loss',
        adjustment: { 
          strategy: 'HIGH_RISK',
          duration: '1d'
        }
      });
    }

    return adjustments;
  }

  private async generateMarketOutlook(): Promise<string> {
    const prompt = `Based on today's market action and after-hours movement, 
    provide a brief outlook for tomorrow's trading session. Consider volatility, 
    major indices performance, and any significant news events.`;

    try {
      const analysis = await this.callAIModel(prompt);

      return analysis;
    } catch (error) {
      return 'Market outlook analysis unavailable';
    }
  }

  private generateMorningBriefing(analysis: AfterHoursAnalysis): string {
    const briefing = [
      '📊 **Morning Trading Briefing**',
      '',
      `**Yesterday's Performance:**`,
      `- Total Trades: ${analysis.todaysSummary.totalTrades}`,
      `- Realized P&L: $${analysis.todaysSummary.realizedPnL.toFixed(2)}`,
      `- Win Rate: ${(analysis.todaysSummary.winRate * 100).toFixed(1)}%`,
      '',
      `**Top Watchlist Items:**`
    ];

    for (const item of analysis.tomorrowsSetup.watchlist.slice(0, 5)) {
      briefing.push(
        `- ${item.symbol}: ${item.reason} (${(item.confidence * 100).toFixed(0)}% confidence)`
      );
    }

    briefing.push('', `**Market Outlook:**`, analysis.tomorrowsSetup.marketOutlook);

    if (analysis.riskAdjustments.length > 0) {
      briefing.push('', `**Risk Adjustments:**`);
      for (const adj of analysis.riskAdjustments) {
        briefing.push(`- ${adj.reason}`);
      }
    }

    return briefing.join('\n');
  }

  private async storeAnalysisResults(analysis: AfterHoursAnalysis): Promise<void> {
    const key = `after-hours-analysis:${new Date().toISOString().split('T')[0]}`;
    
    await this.env.CACHE.put(key, JSON.stringify(analysis), {
      expirationTtl: 86400 * 7 // Keep for 7 days
    });

    // Also store in R2 for long-term analysis
    await this.env.R2.put(
      `analysis/after-hours/${key}.json`,
      JSON.stringify(analysis)
    );
  }

  private calculateGapFillProbability(gapPercent: number): number {
    // Simplified gap fill probability
    const absGap = Math.abs(gapPercent);
    
    if (absGap < 0.5) return 0.8;
    if (absGap < 1) return 0.6;
    if (absGap < 2) return 0.4;
    return 0.2;
  }

  private getEmptyTrade(): TradeDetail {
    return {
      symbol: 'N/A',
      side: 'buy',
      quantity: 0,
      entryPrice: 0,
      exitPrice: 0,
      pnl: 0,
      holdingPeriod: 0
    };
  }
}