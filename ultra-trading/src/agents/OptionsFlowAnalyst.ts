/**
 * Options Flow Analyst Agent
 * Tracks institutional options flow for 0DTE opportunities
 */

import { BaseAgent } from './base/BaseAgent';
import { 
  AgentType, 
  AgentStatus, 
  AgentMessage, 
  MessageType,
  MessagePriority,
  TradingAction
} from '@/types/agents';
import { CloudflareBindings } from '@/types';
import { AlpacaClient } from '@/services/alpaca/AlpacaClient';
import { 
  OptionContract, 
  OptionChainRequest,
  OptionQuote 
} from '@/types/options';
import { Signal } from '@/types/strategy';

interface OptionsFlowSignal {
  symbol: string;
  contractSymbol: string;
  type: 'call' | 'put';
  strike: number;
  expiration: string;
  action: 'BUY' | 'SELL';
  confidence: number;
  volumeRatio: number; // Current volume / average volume
  flowDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  premiumFlow: number; // Dollar volume
  stopLoss: number; // 50% of entry
  takeProfit: number; // 100% gain
  reasoning: string;
}

interface OptionsFlowMetrics {
  totalVolume: number;
  callVolume: number;
  putVolume: number;
  putCallRatio: number;
  netPremiumFlow: number;
  unusualActivityCount: number;
}

export class OptionsFlowAnalyst extends BaseAgent {
  private alpacaClient: AlpacaClient;
  private watchlist = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA'];
  private flowCache: Map<string, OptionsFlowSignal[]> = new Map();
  private metricsCache: Map<string, OptionsFlowMetrics> = new Map();
  
  // 0DTE thresholds
  private readonly VOLUME_SPIKE_THRESHOLD = 3.0; // 3x average volume
  private readonly PREMIUM_FLOW_THRESHOLD = 100000; // $100k minimum
  private readonly NEAR_THE_MONEY_RANGE = 0.02; // 2% from current price
  private readonly MIN_CONFIDENCE = 0.7;
  private readonly STOP_LOSS_PERCENT = 0.5; // 50%
  private readonly TAKE_PROFIT_PERCENT = 1.0; // 100%

  constructor(config: { agentType: AgentType }, env: CloudflareBindings) {
    super(config, env);
    this.alpacaClient = new AlpacaClient(env, 'options-flow-analyst');
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.logger.info('Options Flow Analyst initialized', {
      watchlist: this.watchlist,
      thresholds: {
        volumeSpike: this.VOLUME_SPIKE_THRESHOLD,
        premiumFlow: this.PREMIUM_FLOW_THRESHOLD,
        nearMoney: this.NEAR_THE_MONEY_RANGE
      }
    });
  }

  /**
   * Analyze options flow for 0DTE opportunities
   */
  async analyzeOptionsFlow(): Promise<OptionsFlowSignal[]> {
    this.updateStatus(AgentStatus.ANALYZING);
    const signals: OptionsFlowSignal[] = [];

    try {
      // Get current date for 0DTE
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Analyze each symbol in watchlist
      for (const symbol of this.watchlist) {
        try {
          // Get current stock price
          const quote = await this.alpacaClient.marketData.getLatestQuote(symbol);
          const currentPrice = (quote.bid_price + quote.ask_price) / 2;

          // Get 0DTE options chain
          const chainRequest: OptionChainRequest = {
            underlyingSymbol: symbol,
            minExpiration: today,
            maxExpiration: today,
            minStrike: currentPrice * (1 - this.NEAR_THE_MONEY_RANGE),
            maxStrike: currentPrice * (1 + this.NEAR_THE_MONEY_RANGE),
            limit: 100
          };

          const contracts = await this.alpacaClient.getOptionContracts(chainRequest);
          
          // Analyze flow for each contract
          const symbolSignals = await this.analyzeContractFlow(
            contracts.filter(c => c.expirationDate === todayStr),
            currentPrice,
            symbol
          );

          signals.push(...symbolSignals);
        } catch (error) {
          this.logger.error(`Failed to analyze ${symbol}`, { error });
        }
      }

      // Sort by confidence and take top 3
      const topSignals = signals
        .filter(s => s.confidence >= this.MIN_CONFIDENCE)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      // Cache results
      this.flowCache.set('latest', topSignals);
      
      this.updateStatus(AgentStatus.IDLE);
      return topSignals;

    } catch (error) {
      this.logger.error('Options flow analysis failed', { error });
      this.updateStatus(AgentStatus.ERROR);
      return [];
    }
  }

  /**
   * Analyze individual contract flow
   */
  private async analyzeContractFlow(
    contracts: OptionContract[],
    stockPrice: number,
    underlying: string
  ): Promise<OptionsFlowSignal[]> {
    const signals: OptionsFlowSignal[] = [];

    for (const contract of contracts) {
      try {
        // Get contract quote data
        const quote = await this.getOptionQuote(contract.symbol);
        if (!quote) continue;

        // Calculate metrics
        const midPrice = (quote.bidPrice + quote.askPrice) / 2;
        const spread = quote.askPrice - quote.bidPrice;
        const spreadPercent = spread / midPrice;

        // Skip if spread is too wide
        if (spreadPercent > 0.1) continue; // 10% max spread

        // Detect unusual volume
        const avgVolume = contract.volume || 1;
        const volumeRatio = quote.volume / avgVolume;
        
        if (volumeRatio < this.VOLUME_SPIKE_THRESHOLD) continue;

        // Calculate premium flow
        const premiumFlow = quote.volume * midPrice * 100; // Contract size = 100
        if (premiumFlow < this.PREMIUM_FLOW_THRESHOLD) continue;

        // Determine flow direction
        const flowDirection = this.detectFlowDirection(
          contract.type,
          quote,
          stockPrice,
          contract.strikePrice
        );

        // Calculate confidence
        const confidence = this.calculateConfidence(
          volumeRatio,
          premiumFlow,
          spreadPercent,
          flowDirection
        );

        if (confidence >= this.MIN_CONFIDENCE) {
          signals.push({
            symbol: underlying,
            contractSymbol: contract.symbol,
            type: contract.type,
            strike: contract.strikePrice,
            expiration: contract.expirationDate,
            action: flowDirection === 'BULLISH' ? 'BUY' : 'SELL',
            confidence,
            volumeRatio,
            flowDirection,
            premiumFlow,
            stopLoss: midPrice * this.STOP_LOSS_PERCENT,
            takeProfit: midPrice * (1 + this.TAKE_PROFIT_PERCENT),
            reasoning: this.generateReasoning(
              contract,
              volumeRatio,
              premiumFlow,
              flowDirection
            )
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to analyze contract ${contract.symbol}`, { error });
      }
    }

    return signals;
  }

  /**
   * Get option quote data
   */
  private async getOptionQuote(symbol: string): Promise<OptionQuote | null> {
    try {
      // In production, this would fetch real option quotes
      // For now, generate realistic test data
      return {
        symbol,
        bidPrice: 2.50 + Math.random() * 2,
        askPrice: 2.60 + Math.random() * 2,
        bidSize: Math.floor(Math.random() * 100) + 10,
        askSize: Math.floor(Math.random() * 100) + 10,
        lastPrice: 2.55 + Math.random() * 2,
        lastSize: Math.floor(Math.random() * 50) + 1,
        volume: Math.floor(Math.random() * 5000) + 1000,
        openInterest: Math.floor(Math.random() * 10000) + 1000,
        impliedVolatility: 0.25 + Math.random() * 0.5,
        delta: contract.type === 'call' ? 0.5 + Math.random() * 0.5 : -0.5 - Math.random() * 0.5,
        gamma: 0.01 + Math.random() * 0.05,
        theta: -0.05 - Math.random() * 0.1,
        vega: 0.1 + Math.random() * 0.2,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Failed to get quote for ${symbol}`, { error });
      return null;
    }
  }

  /**
   * Detect flow direction based on various factors
   */
  private detectFlowDirection(
    optionType: 'call' | 'put',
    quote: OptionQuote,
    stockPrice: number,
    strike: number
  ): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const moneyness = stockPrice / strike;
    const bidAskRatio = quote.bidSize / quote.askSize;
    
    // Analyze based on option type and positioning
    if (optionType === 'call') {
      // Call buying is bullish
      if (bidAskRatio < 0.5 && moneyness > 0.98 && moneyness < 1.02) {
        return 'BULLISH'; // Near-the-money call buying
      }
      // Call selling might be neutral/bearish
      if (bidAskRatio > 2 && moneyness > 1.02) {
        return 'NEUTRAL'; // OTM call selling
      }
    } else {
      // Put buying is bearish
      if (bidAskRatio < 0.5 && moneyness > 0.98 && moneyness < 1.02) {
        return 'BEARISH'; // Near-the-money put buying
      }
      // Put selling might be neutral/bullish
      if (bidAskRatio > 2 && moneyness < 0.98) {
        return 'NEUTRAL'; // OTM put selling
      }
    }

    return 'NEUTRAL';
  }

  /**
   * Calculate signal confidence
   */
  private calculateConfidence(
    volumeRatio: number,
    premiumFlow: number,
    spreadPercent: number,
    flowDirection: string
  ): number {
    let confidence = 0.5; // Base confidence

    // Volume spike contribution (0-0.25)
    const volumeScore = Math.min(volumeRatio / 10, 0.25);
    confidence += volumeScore;

    // Premium flow contribution (0-0.15)
    const premiumScore = Math.min(premiumFlow / 1000000, 0.15); // $1M max
    confidence += premiumScore;

    // Spread tightness contribution (0-0.1)
    const spreadScore = Math.max(0, 0.1 - spreadPercent);
    confidence += spreadScore;

    // Directional clarity bonus
    if (flowDirection !== 'NEUTRAL') {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    contract: OptionContract,
    volumeRatio: number,
    premiumFlow: number,
    flowDirection: string
  ): string {
    const parts = [];

    parts.push(`${volumeRatio.toFixed(1)}x volume spike detected`);
    parts.push(`$${(premiumFlow / 1000).toFixed(0)}k premium flow`);
    
    if (flowDirection === 'BULLISH') {
      parts.push('aggressive call buying indicates bullish sentiment');
    } else if (flowDirection === 'BEARISH') {
      parts.push('aggressive put buying indicates bearish sentiment');
    } else {
      parts.push('likely premium selling strategy');
    }

    parts.push(`0DTE ${contract.type} strike ${contract.strikePrice}`);

    return parts.join(', ');
  }

  /**
   * Process incoming messages
   */
  async process(message: AgentMessage): Promise<AgentMessage | null> {
    switch (message.type) {
      case MessageType.MARKET_UPDATE:
        // Trigger flow analysis on market updates
        const signals = await this.analyzeOptionsFlow();
        
        if (signals.length > 0) {
          return {
            id: `options-flow-${Date.now()}`,
            from: this.type,
            to: AgentType.EXECUTION,
            type: MessageType.SIGNAL_GENERATED,
            payload: {
              signals: signals.map(s => this.convertToSignal(s)),
              analysis: {
                totalOpportunities: signals.length,
                avgConfidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
                totalPremiumFlow: signals.reduce((sum, s) => sum + s.premiumFlow, 0)
              }
            },
            timestamp: Date.now(),
            priority: MessagePriority.HIGH
          };
        }
        break;

      case MessageType.PERFORMANCE_UPDATE:
        // Adjust thresholds based on performance
        const performance = message.payload as any;
        if (performance.winRate < 0.4) {
          // Increase confidence threshold if losing
          this.MIN_CONFIDENCE = Math.min(0.8, this.MIN_CONFIDENCE + 0.05);
          this.logger.info('Increased confidence threshold', {
            newThreshold: this.MIN_CONFIDENCE
          });
        }
        break;
    }

    return null;
  }

  /**
   * Convert options flow signal to standard signal format
   */
  private convertToSignal(flowSignal: OptionsFlowSignal): Signal {
    return {
      symbol: flowSignal.contractSymbol,
      action: flowSignal.action as 'BUY' | 'SELL' | 'HOLD',
      quantity: 1, // 1 contract for 0DTE
      confidence: flowSignal.confidence,
      reasoning: flowSignal.reasoning,
      stopLoss: flowSignal.stopLoss,
      takeProfit: flowSignal.takeProfit,
      metadata: {
        type: 'options',
        underlying: flowSignal.symbol,
        strike: flowSignal.strike,
        expiration: flowSignal.expiration,
        optionType: flowSignal.type,
        volumeRatio: flowSignal.volumeRatio,
        premiumFlow: flowSignal.premiumFlow,
        flowDirection: flowSignal.flowDirection
      }
    };
  }

  /**
   * Get latest 0DTE opportunities
   */
  async getLatestOpportunities(): Promise<OptionsFlowSignal[]> {
    return this.flowCache.get('latest') || [];
  }

  /**
   * Get flow metrics for a symbol
   */
  async getFlowMetrics(symbol: string): Promise<OptionsFlowMetrics | null> {
    return this.metricsCache.get(symbol) || null;
  }
}