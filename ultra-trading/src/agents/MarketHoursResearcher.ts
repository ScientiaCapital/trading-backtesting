/**
 * Market Hours Researcher Agent
 * Real-time opportunity scanner during trading hours
 */

import { BaseAgent } from './base/BaseAgent';
import { 
  AgentType, 
  AgentStatus, 
  AgentMessage, 
  MessageType,
  MessagePriority
} from '@/types/agents';
import { CloudflareBindings } from '@/types';
import { AlpacaClient } from '@/services/alpaca/AlpacaClient';
import { IntradayPatternEngine, IntradayPattern } from '@/services/IntradayPatternEngine';
import { OptionsFlowAnalyst } from './OptionsFlowAnalyst';
import { Signal } from '@/types/strategy';

interface MarketSnapshot {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  timestamp: Date;
}

interface OpportunityAlert {
  id: string;
  type: 'SUDDEN_MOVE' | 'OPTIONS_FLOW' | 'CORRELATION_BREAK' | 'MEAN_REVERSION' | 'PATTERN';
  symbol: string;
  confidence: number;
  signal: Signal;
  reasoning: string;
  metrics: Record<string, any>;
  timestamp: Date;
}

interface PerformanceMetrics {
  scansCompleted: number;
  opportunitiesFound: number;
  alertsSent: number;
  avgScanTime: number;
  lastScanTime: number;
  successRate: number;
}

export class MarketHoursResearcher extends BaseAgent {
  private alpacaClient: AlpacaClient;
  private patternEngine: IntradayPatternEngine;
  private optionsFlowAnalyst: OptionsFlowAnalyst;
  
  private watchlist = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'META', 'AMZN'];
  private correlatedPairs = [
    ['SPY', 'QQQ'],
    ['AAPL', 'MSFT'],
    ['NVDA', 'AMD'],
    ['JPM', 'BAC']
  ];
  
  private performanceMetrics: PerformanceMetrics = {
    scansCompleted: 0,
    opportunitiesFound: 0,
    alertsSent: 0,
    avgScanTime: 0,
    lastScanTime: 0,
    successRate: 0
  };
  
  private rollingMetrics: Array<{
    timestamp: Date;
    opportunities: number;
    successfulAlerts: number;
  }> = [];
  
  // Scanning thresholds
  private readonly SUDDEN_MOVE_THRESHOLD = 0.02; // 2% in 5 minutes
  private readonly VOLUME_SPIKE_THRESHOLD = 3; // 3x average
  private readonly RSI_EXTREME_LOW = 20;
  private readonly RSI_EXTREME_HIGH = 80;
  private readonly CORRELATION_BREAK_THRESHOLD = 0.3; // 30% divergence
  private readonly MIN_ALERT_CONFIDENCE = 0.7;
  private readonly SCAN_INTERVAL = 30000; // 30 seconds

  constructor(config: { agentType: AgentType }, env: CloudflareBindings) {
    super(config, env);
    this.alpacaClient = new AlpacaClient(env, 'market-hours-researcher');
    this.patternEngine = new IntradayPatternEngine(env);
    this.optionsFlowAnalyst = new OptionsFlowAnalyst(
      { agentType: AgentType.OPTIONS_FLOW_ANALYST },
      env
    );
  }

  async initialize(): Promise<void> {
    await super.initialize();
    await this.optionsFlowAnalyst.initialize();
    
    // Start continuous scanning
    this.startContinuousScanning();
    
    this.logger.info('Market Hours Researcher initialized', {
      watchlist: this.watchlist,
      scanInterval: this.SCAN_INTERVAL,
      thresholds: {
        suddenMove: this.SUDDEN_MOVE_THRESHOLD,
        volumeSpike: this.VOLUME_SPIKE_THRESHOLD,
        minConfidence: this.MIN_ALERT_CONFIDENCE
      }
    });
  }

  /**
   * Start continuous market scanning
   */
  private startContinuousScanning(): void {
    // Only scan during market hours
    setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const marketTime = hour * 60 + minute;
      
      // Market hours: 9:30 AM - 4:00 PM ET
      if (marketTime >= 570 && marketTime <= 960) {
        await this.scanOpportunities();
      }
    }, this.SCAN_INTERVAL);
  }

  /**
   * Main scanning method - runs every 30 seconds
   */
  async scanOpportunities(): Promise<OpportunityAlert[]> {
    const startTime = Date.now();
    this.updateStatus(AgentStatus.ANALYZING);
    
    const alerts: OpportunityAlert[] = [];

    try {
      // Run all scans in parallel
      const [
        suddenMoves,
        optionsFlow,
        correlationBreaks,
        meanReversionSetups,
        patterns
      ] = await Promise.all([
        this.scanSnapshots(),
        this.monitorOptionsFlow(),
        this.trackCorrelationBreaks(),
        this.findMeanReversionSetups(),
        this.scanPatterns()
      ]);

      // Combine all opportunities
      alerts.push(...suddenMoves, ...optionsFlow, ...correlationBreaks, ...meanReversionSetups, ...patterns);

      // Filter by confidence
      const highConfidenceAlerts = alerts.filter(a => a.confidence >= this.MIN_ALERT_CONFIDENCE);

      // Update metrics
      const scanTime = Date.now() - startTime;
      this.updatePerformanceMetrics(alerts.length, highConfidenceAlerts.length, scanTime);

      // Send alerts to coordinator
      if (highConfidenceAlerts.length > 0) {
        await this.sendAlerts(highConfidenceAlerts);
      }

      this.updateStatus(AgentStatus.IDLE);
      return highConfidenceAlerts;

    } catch (error) {
      this.logger.error('Opportunity scan failed', { error });
      this.updateStatus(AgentStatus.ERROR);
      return [];
    }
  }

  /**
   * Scan for sudden price moves
   */
  private async scanSnapshots(): Promise<OpportunityAlert[]> {
    const alerts: OpportunityAlert[] = [];

    try {
      // Get snapshots for all watchlist symbols
      const snapshots = await Promise.all(
        this.watchlist.map(async symbol => {
          try {
            const snapshot = await this.getSnapshot(symbol);
            return { symbol, snapshot };
          } catch (error) {
            this.logger.warn(`Failed to get snapshot for ${symbol}`, { error });
            return null;
          }
        })
      );

      // Analyze each snapshot
      for (const data of snapshots) {
        if (!data) continue;
        
        const { symbol, snapshot } = data;
        
        // Check for sudden moves
        if (Math.abs(snapshot.changePercent) >= this.SUDDEN_MOVE_THRESHOLD) {
          const direction = snapshot.changePercent > 0 ? 'BUY' : 'SELL';
          
          alerts.push({
            id: `sudden-move-${symbol}-${Date.now()}`,
            type: 'SUDDEN_MOVE',
            symbol,
            confidence: this.calculateMoveConfidence(snapshot),
            signal: {
              symbol,
              action: direction,
              quantity: 100, // Default quantity
              confidence: this.calculateMoveConfidence(snapshot),
              reasoning: `${Math.abs(snapshot.changePercent * 100).toFixed(1)}% move detected with ${(snapshot.volume / 1000000).toFixed(1)}M volume`
            },
            reasoning: `Sudden ${Math.abs(snapshot.changePercent * 100).toFixed(1)}% move detected`,
            metrics: {
              changePercent: snapshot.changePercent,
              volume: snapshot.volume,
              price: snapshot.price
            },
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      this.logger.error('Snapshot scan failed', { error });
    }

    return alerts;
  }

  /**
   * Monitor options flow for opportunities
   */
  private async monitorOptionsFlow(): Promise<OpportunityAlert[]> {
    const alerts: OpportunityAlert[] = [];

    try {
      // Get latest 0DTE opportunities from options flow analyst
      const opportunities = await this.optionsFlowAnalyst.getLatestOpportunities();
      
      // Convert to alerts
      for (const opp of opportunities) {
        alerts.push({
          id: `options-flow-${opp.contractSymbol}-${Date.now()}`,
          type: 'OPTIONS_FLOW',
          symbol: opp.symbol,
          confidence: opp.confidence,
          signal: {
            symbol: opp.contractSymbol,
            action: opp.action,
            quantity: 1,
            confidence: opp.confidence,
            reasoning: opp.reasoning,
            stopLoss: opp.stopLoss,
            takeProfit: opp.takeProfit,
            metadata: {
              underlying: opp.symbol,
              strike: opp.strike,
              type: opp.type,
              expiration: opp.expiration
            }
          },
          reasoning: `Options flow: ${opp.reasoning}`,
          metrics: {
            volumeRatio: opp.volumeRatio,
            premiumFlow: opp.premiumFlow,
            flowDirection: opp.flowDirection
          },
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Options flow monitoring failed', { error });
    }

    return alerts;
  }

  /**
   * Track correlation breaks between related stocks
   */
  private async trackCorrelationBreaks(): Promise<OpportunityAlert[]> {
    const alerts: OpportunityAlert[] = [];

    try {
      for (const [symbol1, symbol2] of this.correlatedPairs) {
        const [snapshot1, snapshot2] = await Promise.all([
          this.getSnapshot(symbol1),
          this.getSnapshot(symbol2)
        ]);

        // Calculate divergence
        const divergence = Math.abs(snapshot1.changePercent - snapshot2.changePercent);
        
        if (divergence >= this.CORRELATION_BREAK_THRESHOLD) {
          // Determine which to buy/sell
          const longSymbol = snapshot1.changePercent < snapshot2.changePercent ? symbol1 : symbol2;
          const shortSymbol = longSymbol === symbol1 ? symbol2 : symbol1;
          
          alerts.push({
            id: `correlation-break-${symbol1}-${symbol2}-${Date.now()}`,
            type: 'CORRELATION_BREAK',
            symbol: longSymbol,
            confidence: this.calculateCorrelationConfidence(divergence),
            signal: {
              symbol: longSymbol,
              action: 'BUY',
              quantity: 100,
              confidence: this.calculateCorrelationConfidence(divergence),
              reasoning: `Correlation break: ${symbol1} vs ${symbol2} diverged ${(divergence * 100).toFixed(1)}%`,
              metadata: {
                pairSymbol: shortSymbol,
                divergence
              }
            },
            reasoning: `Pair divergence detected: ${(divergence * 100).toFixed(1)}%`,
            metrics: {
              symbol1Change: snapshot1.changePercent,
              symbol2Change: snapshot2.changePercent,
              divergence
            },
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      this.logger.error('Correlation tracking failed', { error });
    }

    return alerts;
  }

  /**
   * Find mean reversion setups on RSI extremes
   */
  private async findMeanReversionSetups(): Promise<OpportunityAlert[]> {
    const alerts: OpportunityAlert[] = [];

    try {
      // Get 1-minute bars for RSI calculation
      for (const symbol of this.watchlist) {
        const bars = await this.get1MinuteBars(symbol, 20);
        if (bars.length < 14) continue;

        const rsi = this.calculateRSI(bars.map(b => b.close));
        const currentPrice = bars[bars.length - 1].close;

        // Oversold setup
        if (rsi < this.RSI_EXTREME_LOW) {
          alerts.push({
            id: `mean-reversion-oversold-${symbol}-${Date.now()}`,
            type: 'MEAN_REVERSION',
            symbol,
            confidence: this.calculateRSIConfidence(rsi, true),
            signal: {
              symbol,
              action: 'BUY',
              quantity: 100,
              confidence: this.calculateRSIConfidence(rsi, true),
              reasoning: `Extreme oversold RSI ${rsi.toFixed(1)}`,
              stopLoss: currentPrice * 0.98,
              takeProfit: currentPrice * 1.015
            },
            reasoning: `RSI oversold at ${rsi.toFixed(1)}`,
            metrics: {
              rsi,
              price: currentPrice,
              condition: 'oversold'
            },
            timestamp: new Date()
          });
        }

        // Overbought setup
        if (rsi > this.RSI_EXTREME_HIGH) {
          alerts.push({
            id: `mean-reversion-overbought-${symbol}-${Date.now()}`,
            type: 'MEAN_REVERSION',
            symbol,
            confidence: this.calculateRSIConfidence(rsi, false),
            signal: {
              symbol,
              action: 'SELL',
              quantity: 100,
              confidence: this.calculateRSIConfidence(rsi, false),
              reasoning: `Extreme overbought RSI ${rsi.toFixed(1)}`,
              stopLoss: currentPrice * 1.02,
              takeProfit: currentPrice * 0.985
            },
            reasoning: `RSI overbought at ${rsi.toFixed(1)}`,
            metrics: {
              rsi,
              price: currentPrice,
              condition: 'overbought'
            },
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      this.logger.error('Mean reversion scan failed', { error });
    }

    return alerts;
  }

  /**
   * Scan for intraday patterns
   */
  private async scanPatterns(): Promise<OpportunityAlert[]> {
    const alerts: OpportunityAlert[] = [];

    try {
      for (const symbol of this.watchlist) {
        const bars = await this.get5MinuteBars(symbol, 50);
        const marketData = [{
          symbol,
          open: bars[bars.length - 1].open,
          high: bars[bars.length - 1].high,
          low: bars[bars.length - 1].low,
          close: bars[bars.length - 1].close,
          volume: bars[bars.length - 1].volume,
          timestamp: bars[bars.length - 1].timestamp
        }];

        const patterns = await this.patternEngine.detectPatterns(marketData, bars);
        
        // Convert patterns to alerts
        for (const pattern of patterns) {
          alerts.push({
            id: `pattern-${pattern.type}-${symbol}-${Date.now()}`,
            type: 'PATTERN',
            symbol,
            confidence: pattern.confidence,
            signal: {
              symbol,
              action: pattern.entryPrice > bars[bars.length - 1].close ? 'BUY' : 'SELL',
              quantity: 100,
              confidence: pattern.confidence,
              reasoning: `${pattern.type} pattern detected`,
              stopLoss: pattern.stopLoss,
              takeProfit: pattern.takeProfit,
              metadata: pattern.metadata
            },
            reasoning: `${pattern.type} pattern on ${pattern.timeframe}`,
            metrics: pattern.metadata,
            timestamp: pattern.timestamp
          });
        }
      }
    } catch (error) {
      this.logger.error('Pattern scan failed', { error });
    }

    return alerts;
  }

  /**
   * Send high-confidence alerts to coordinator
   */
  private async sendAlerts(alerts: OpportunityAlert[]): Promise<void> {
    for (const alert of alerts) {
      const message: AgentMessage = {
        id: `research-alert-${Date.now()}`,
        from: this.type,
        to: AgentType.EXECUTION,
        type: MessageType.SIGNAL_GENERATED,
        payload: {
          alert,
          signal: alert.signal,
          source: 'market_hours_research'
        },
        timestamp: Date.now(),
        priority: alert.confidence >= 0.8 ? MessagePriority.HIGH : MessagePriority.NORMAL
      };

      // Send to coordinator
      await this.sendMessage(message);
      
      this.logger.info('Opportunity alert sent', {
        type: alert.type,
        symbol: alert.symbol,
        confidence: alert.confidence
      });
    }
  }

  /**
   * Get market snapshot for a symbol
   */
  private async getSnapshot(symbol: string): Promise<MarketSnapshot> {
    const quote = await this.alpacaClient.marketData.getLatestQuote(symbol);
    const bars = await this.alpacaClient.marketData.getBars(symbol, {
      timeframe: '1Day',
      limit: 2
    });

    const currentBar = bars.bars[bars.bars.length - 1];
    const prevBar = bars.bars[bars.bars.length - 2];
    
    const change = currentBar.c - prevBar.c;
    const changePercent = change / prevBar.c;

    return {
      symbol,
      price: (quote.bid_price + quote.ask_price) / 2,
      change,
      changePercent,
      volume: currentBar.v,
      bid: quote.bid_price,
      ask: quote.ask_price,
      high: currentBar.h,
      low: currentBar.l,
      timestamp: new Date()
    };
  }

  /**
   * Get 1-minute bars
   */
  private async get1MinuteBars(symbol: string, limit: number): Promise<any[]> {
    const response = await this.alpacaClient.marketData.getBars(symbol, {
      timeframe: '1Min',
      limit
    });
    return response.bars;
  }

  /**
   * Get 5-minute bars
   */
  private async get5MinuteBars(symbol: string, limit: number): Promise<any[]> {
    const response = await this.alpacaClient.marketData.getBars(symbol, {
      timeframe: '5Min',
      limit
    });
    return response.bars;
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate subsequent values
    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate confidence scores
   */
  private calculateMoveConfidence(snapshot: MarketSnapshot): number {
    const priceStrength = Math.min(Math.abs(snapshot.changePercent) / 0.03, 1);
    const volumeStrength = Math.min(snapshot.volume / 10000000, 1); // 10M volume
    return 0.5 + (priceStrength * 0.3) + (volumeStrength * 0.2);
  }

  private calculateCorrelationConfidence(divergence: number): number {
    return 0.6 + Math.min(divergence / 0.5, 0.4); // Max 1.0 at 50% divergence
  }

  private calculateRSIConfidence(rsi: number, isOversold: boolean): number {
    if (isOversold) {
      return 0.6 + ((30 - rsi) / 30) * 0.4;
    } else {
      return 0.6 + ((rsi - 70) / 30) * 0.4;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(
    opportunitiesFound: number,
    alertsSent: number,
    scanTime: number
  ): void {
    this.performanceMetrics.scansCompleted++;
    this.performanceMetrics.opportunitiesFound += opportunitiesFound;
    this.performanceMetrics.alertsSent += alertsSent;
    this.performanceMetrics.lastScanTime = scanTime;
    
    // Update average scan time
    const totalScanTime = this.performanceMetrics.avgScanTime * (this.performanceMetrics.scansCompleted - 1) + scanTime;
    this.performanceMetrics.avgScanTime = totalScanTime / this.performanceMetrics.scansCompleted;

    // Update rolling 30-minute metrics
    const now = new Date();
    this.rollingMetrics.push({
      timestamp: now,
      opportunities: opportunitiesFound,
      successfulAlerts: alertsSent
    });

    // Keep only last 30 minutes
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    this.rollingMetrics = this.rollingMetrics.filter(m => m.timestamp > thirtyMinutesAgo);

    // Calculate success rate
    const totalRollingOpportunities = this.rollingMetrics.reduce((sum, m) => sum + m.opportunities, 0);
    const totalRollingAlerts = this.rollingMetrics.reduce((sum, m) => sum + m.successfulAlerts, 0);
    this.performanceMetrics.successRate = totalRollingOpportunities > 0 ? 
      totalRollingAlerts / totalRollingOpportunities : 0;

    this.logger.debug('Performance metrics updated', this.performanceMetrics);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Process messages from other agents
   */
  async process(message: AgentMessage): Promise<AgentMessage | null> {
    // Market hours researcher primarily sends messages, doesn't receive many
    switch (message.type) {
      case MessageType.PERFORMANCE_UPDATE:
        // Adjust scanning based on performance
        const performance = message.payload as any;
        if (performance.successRate < 0.3) {
          // Increase confidence threshold if too many false positives
          this.MIN_ALERT_CONFIDENCE = Math.min(0.8, this.MIN_ALERT_CONFIDENCE + 0.05);
          this.logger.info('Increased alert confidence threshold', {
            newThreshold: this.MIN_ALERT_CONFIDENCE
          });
        }
        break;
    }

    return null;
  }
}