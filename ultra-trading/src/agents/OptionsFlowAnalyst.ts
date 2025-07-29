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
import { 
  CloudflareBindings,
  AgentConfig,
  TradingDecision
} from '@/types';
import { AlpacaClient } from '@/services/alpaca/AlpacaClient';
import { 
  OptionContract, 
  OptionChainRequest
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
  private alpacaClient!: AlpacaClient;
  private watchlist = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA'];
  private flowCache: Map<string, OptionsFlowSignal[]> = new Map();
  private metricsCache: Map<string, OptionsFlowMetrics> = new Map();
  
  // 0DTE thresholds
  private readonly VOLUME_SPIKE_THRESHOLD = 3.0; // 3x average volume
  private readonly PREMIUM_FLOW_THRESHOLD = 100000; // $100k minimum
  private readonly NEAR_THE_MONEY_RANGE = 0.02; // 2% from current price
  private MIN_CONFIDENCE = 0.7;

  constructor(config: AgentConfig) {
    super(AgentType.OPTIONS_FLOW_ANALYST, config);
  }

  setEnvironment(env: CloudflareBindings): void {
    this.alpacaClient = new AlpacaClient(env, 'options-flow-analyst');
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Options Flow Analyst initialized', {
      watchlist: this.watchlist,
      thresholds: {
        volumeSpike: this.VOLUME_SPIKE_THRESHOLD,
        premiumFlow: this.PREMIUM_FLOW_THRESHOLD,
        nearMoney: this.NEAR_THE_MONEY_RANGE
      }
    });
  }

  protected async handleMessage(message: AgentMessage): Promise<AgentMessage | null> {
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
            priority: MessagePriority.HIGH,
            requiresResponse: false
          };
        }
        break;

      case MessageType.PERFORMANCE_UPDATE:
        // Adjust thresholds based on performance
        const performance = message.payload as { winRate: number };
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

  protected async onShutdown(): Promise<void> {
    this.logger.info('OptionsFlowAnalyst shutdown');
  }

  /**
   * Analyze options flow for 0DTE opportunities
   */
  async analyzeOptionsFlow(): Promise<OptionsFlowSignal[]> {
    this.status = AgentStatus.ANALYZING;
    const signals: OptionsFlowSignal[] = [];

    try {
      // Get current date for 0DTE
      const today = new Date();
      const expirationDate = today.toISOString().split('T')[0];

      // Analyze each symbol in watchlist
      for (const symbol of this.watchlist) {
        const opportunity = await this.analyzeSymbolFlow(symbol, expirationDate || '');
        if (opportunity) {
          signals.push(opportunity);
        }
      }

      // Sort by confidence and premium flow
      const topSignals = signals
        .sort((a, b) => {
          const scoreA = a.confidence * Math.log10(a.premiumFlow);
          const scoreB = b.confidence * Math.log10(b.premiumFlow);
          return scoreB - scoreA;
        })
        .slice(0, 5); // Top 5 opportunities

      // Cache results
      this.flowCache.set('latest', topSignals);
      
      this.status = AgentStatus.IDLE;
      return topSignals;

    } catch (error) {
      this.logger.error('Options flow analysis failed', { error });
      this.status = AgentStatus.ERROR;
      return [];
    }
  }

  /**
   * Analyze options flow for a specific symbol
   */
  private async analyzeSymbolFlow(
    symbol: string, 
    expiration: string
  ): Promise<OptionsFlowSignal | null> {
    try {
      // Get option chain for 0DTE
      const chain = await this.getOptionChain(symbol, expiration);
      if (!chain || chain.length === 0) return null;

      // Get current stock price
      const quote = await this.alpacaClient.marketData.getLatestQuote(symbol);
      const currentPrice = (quote.bid_price + quote.ask_price) / 2;

      // Filter for near-the-money options
      const ntmOptions = chain.filter(contract => {
        const moneyness = Math.abs(contract.strikePrice - currentPrice) / currentPrice;
        return moneyness <= this.NEAR_THE_MONEY_RANGE;
      });

      // Analyze flow for unusual activity
      let bestSignal: OptionsFlowSignal | null = null;
      let highestScore = 0;

      for (const contract of ntmOptions) {
        const flowMetrics = await this.analyzeContractFlow(contract, currentPrice);
        
        if (flowMetrics.volumeRatio >= this.VOLUME_SPIKE_THRESHOLD &&
            flowMetrics.premiumFlow >= this.PREMIUM_FLOW_THRESHOLD) {
          
          const signal = this.createFlowSignal(
            symbol,
            contract,
            flowMetrics,
            currentPrice
          );

          const score = signal.confidence * Math.log10(signal.premiumFlow);
          if (score > highestScore) {
            highestScore = score;
            bestSignal = signal;
          }
        }
      }

      return bestSignal;

    } catch (error) {
      this.logger.error('Symbol flow analysis failed', { symbol, error });
      return null;
    }
  }

  /**
   * Get option chain from Alpaca
   */
  private async getOptionChain(
    symbol: string, 
    expiration: string
  ): Promise<OptionContract[]> {
    try {
      const request: OptionChainRequest = {
        underlyingSymbols: symbol,
        expirationDate: expiration,
        type: 'all' // Both calls and puts
      };

      const response = await this.alpacaClient.getOptionChain(request);
      return response.snapshots || [];
    } catch (error) {
      this.logger.error('Failed to get option chain', { symbol, error });
      return [];
    }
  }

  /**
   * Analyze individual contract flow
   */
  private async analyzeContractFlow(
    contract: OptionContract,
    stockPrice: number
  ): Promise<{
    volumeRatio: number;
    premiumFlow: number;
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }> {
    // Get latest quote for the option
    const quote = await this.alpacaClient.getOptionQuote(contract.symbol);
    
    // Calculate volume ratio (current vs 20-day average)
    const volumeRatio = quote.volume / ((contract.openInterest || 1) / 20);
    
    // Calculate premium flow
    const midPrice = (quote.bidPrice + quote.askPrice) / 2;
    const premiumFlow = quote.volume * midPrice * 100; // Options are 100 shares

    // Determine flow direction
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    
    if (contract.type === 'call' && volumeRatio > this.VOLUME_SPIKE_THRESHOLD) {
      direction = 'BULLISH';
    } else if (contract.type === 'put' && volumeRatio > this.VOLUME_SPIKE_THRESHOLD) {
      direction = 'BEARISH';
    }

    // Check if it's likely a hedge (opposite of stock movement)
    const stockMovement = contract.underlyingPrice 
      ? (stockPrice - contract.underlyingPrice) / contract.underlyingPrice
      : 0;
    if (Math.abs(stockMovement) > 0.02) {
      if ((contract.type === 'call' && stockMovement < -0.02) ||
          (contract.type === 'put' && stockMovement > 0.02)) {
        direction = 'NEUTRAL'; // Likely hedging
      }
    }

    return { volumeRatio, premiumFlow, direction };
  }

  /**
   * Create flow signal from analysis
   */
  private createFlowSignal(
    symbol: string,
    contract: OptionContract,
    metrics: {
      volumeRatio: number;
      premiumFlow: number;
      direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    },
    currentPrice: number
  ): OptionsFlowSignal {
    // Calculate confidence based on multiple factors
    let confidence = 0.5;
    
    // Volume spike factor
    if (metrics.volumeRatio > 5) confidence += 0.2;
    else if (metrics.volumeRatio > 3) confidence += 0.1;
    
    // Premium flow factor
    if (metrics.premiumFlow > 500000) confidence += 0.2;
    else if (metrics.premiumFlow > 250000) confidence += 0.1;
    
    // Direction alignment
    if (metrics.direction !== 'NEUTRAL') confidence += 0.1;
    
    // Moneyness factor (prefer slightly OTM)
    const moneyness = (contract.strikePrice - currentPrice) / currentPrice;
    if (contract.type === 'call' && moneyness > 0 && moneyness < 0.01) {
      confidence += 0.1;
    } else if (contract.type === 'put' && moneyness < 0 && moneyness > -0.01) {
      confidence += 0.1;
    }

    confidence = Math.min(confidence, 0.95);

    return {
      symbol,
      contractSymbol: contract.symbol,
      type: contract.type,
      strike: contract.strikePrice,
      expiration: contract.expirationDate,
      action: metrics.direction === 'BULLISH' ? 'BUY' : 'SELL',
      confidence,
      volumeRatio: metrics.volumeRatio,
      flowDirection: metrics.direction,
      premiumFlow: metrics.premiumFlow,
      stopLoss: (contract.lastPrice || 1) * 0.5, // 50% stop loss
      takeProfit: (contract.lastPrice || 1) * 2.0, // 100% profit target
      reasoning: this.generateReasoning(symbol, contract, metrics)
    };
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    symbol: string,
    contract: OptionContract,
    metrics: {
      volumeRatio: number;
      premiumFlow: number;
      direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    }
  ): string {
    const parts: string[] = [];

    parts.push(`${symbol} ${metrics.volumeRatio.toFixed(1)}x volume spike`);
    parts.push(`$${(metrics.premiumFlow / 1000).toFixed(0)}k premium flow`);
    
    if (metrics.direction === 'BULLISH') {
      parts.push('bullish positioning detected');
    } else if (metrics.direction === 'BEARISH') {
      parts.push('bearish positioning detected');
    } else {
      parts.push('likely premium selling strategy');
    }

    parts.push(`0DTE ${contract.type} strike ${contract.strikePrice}`);

    return parts.join(', ');
  }

  /**
   * Convert flow signal to trading signal
   */
  private convertToSignal(flowSignal: OptionsFlowSignal): Signal {
    return {
      timestamp: Date.now(),
      symbol: flowSignal.contractSymbol,
      action: flowSignal.action === 'BUY' ? 'buy' : 'sell',
      quantity: 1, // Start with 1 contract
      confidence: flowSignal.confidence,
      orderType: 'market' as const,
      timeInForce: 'day' as const,
      reason: flowSignal.reasoning
    };
  }

  /**
   * Get current flow metrics
   */
  getFlowMetrics(): Map<string, OptionsFlowMetrics> {
    return this.metricsCache;
  }

  /**
   * Get latest flow signals
   */
  getLatestSignals(): OptionsFlowSignal[] {
    return this.flowCache.get('latest') || [];
  }

  /**
   * Generate trading decision for execution
   */
  async getRecommendation(_flowData: any): Promise<TradingDecision> {
    const signals = await this.analyzeOptionsFlow();
    
    if (signals.length === 0) {
      return {
        id: `decision-${Date.now()}`,
        timestamp: Date.now(),
        action: TradingAction.WAIT,
        signals: [],
        confidence: 0,
        reasoning: 'No high-confidence 0DTE opportunities detected'
      };
    }

    // Take the highest confidence signal
    const topSignal = signals[0];
    if (!topSignal) {
      return {
        id: `decision-${Date.now()}`,
        timestamp: Date.now(),
        action: TradingAction.WAIT,
        signals: [],
        confidence: 0,
        reasoning: 'No valid signals to execute'
      };
    }
    
    // Calculate position size based on confidence
    const quantity = Math.floor(topSignal.confidence * 5); // Max 5 contracts

    return {
      id: `decision-${Date.now()}`,
      timestamp: Date.now(),
      action: TradingAction.ENTER_POSITION,
      signals: [this.convertToSignal(topSignal)],
      confidence: topSignal.confidence,
      reasoning: topSignal.reasoning,
      symbol: topSignal.contractSymbol,
      quantity,
      stopLoss: topSignal.stopLoss,
      takeProfit: topSignal.takeProfit,
      metadata: {
        underlying: topSignal.symbol,
        optionType: topSignal.type,
        strike: topSignal.strike,
        expiration: topSignal.expiration,
        volumeRatio: topSignal.volumeRatio,
        premiumFlow: topSignal.premiumFlow,
        flowDirection: topSignal.flowDirection
      }
    };
  }

  /**
   * Calculate put/call ratio for market sentiment
   */
  async calculatePutCallRatio(): Promise<{
    ratio: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }> {
    let totalCalls = 0;
    let totalPuts = 0;

    for (const [_, metrics] of this.metricsCache) {
      totalCalls += metrics.callVolume;
      totalPuts += metrics.putVolume;
    }

    const ratio = totalPuts / (totalCalls || 1);
    
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (ratio < 0.7) sentiment = 'BULLISH';
    else if (ratio > 1.3) sentiment = 'BEARISH';

    return { ratio, sentiment };
  }
}