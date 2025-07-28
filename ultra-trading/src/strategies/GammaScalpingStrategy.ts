/**
 * Gamma Scalping Strategy - TypeScript Implementation
 * 
 * This strategy maintains a delta-neutral portfolio by continuously rebalancing
 * stock positions against options positions as the underlying price moves.
 */

import { TradingStrategy, Signal, MarketData, ValidationResult, Account } from '@/types/strategy';
import { Order, OrderType, TimeInForce } from '@/types/trading';
import { OptionContract, OptionQuote } from '@/types/options';
import { AlpacaService } from '@/services/alpaca/trading-client';
import { MarketDataService } from '@/services/market-data';
import { BlackScholesEngine } from '@/utils/options-pricing';

export interface GammaScalpingConfig {
  deltaHedgeThreshold: number;  // e.g., 0.05 for 5 delta
  gammaThreshold: number;       // Minimum gamma to consider position
  hedgeInterval: number;        // Minutes between hedge checks
  maxPositionSize: number;      // Maximum option contracts
  stopLossPercent: number;      // Stop loss percentage
  takeProfitPercent: number;    // Take profit percentage
  underlyingSymbol: string;
  riskFreeRate: number;
}

interface GammaPosition {
  symbol: string;
  optionSymbol: string;
  quantity: number;
  delta: number;
  gamma: number;
  entryPrice: number;
  strikePrice: number;
  expirationDate: string;
}

interface OptionWithGreeks extends OptionContract {
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    iv: number;
  };
  quote?: OptionQuote;
}

/**
 * Gamma Scalping Strategy Implementation
 * 
 * Key features:
 * - Maintains delta-neutral portfolio
 * - Profits from gamma (realized volatility)
 * - Requires active management and rebalancing
 */
export class GammaScalpingStrategy extends TradingStrategy {
  name = 'Gamma Scalping';
  
  private readonly alpaca: AlpacaService;
  private readonly marketData: MarketDataService;
  private readonly bsEngine: BlackScholesEngine;
  private positions: Map<string, GammaPosition> = new Map();
  private config: GammaScalpingConfig;

  constructor(
    config: GammaScalpingConfig,
    alpaca: AlpacaService,
    marketData: MarketDataService
  ) {
    super();
    this.config = config;
    this.alpaca = alpaca;
    this.marketData = marketData;
    this.bsEngine = new BlackScholesEngine(config.riskFreeRate);
  }

  /**
   * Execute the gamma scalping strategy
   */
  async execute(marketData: MarketData): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    try {
      // Get current gamma exposure
      const gammaExposure = await this.calculateGammaExposure();
      
      if (Math.abs(gammaExposure) > this.config.gammaThreshold) {
        // Need to hedge
        const hedgeSignal = await this.generateHedgeSignal(marketData, gammaExposure);
        if (hedgeSignal) {
          signals.push(hedgeSignal);
        }
      }
      
      // Check for new opportunities
      const entrySignal = await this.scanForEntry(marketData);
      if (entrySignal) {
        signals.push(entrySignal);
      }
      
      // Check exit conditions
      const exitSignals = await this.checkExitConditions(marketData);
      signals.push(...exitSignals);
      
      return signals;
    } catch (error) {
      console.error('Error in gamma scalping strategy:', error);
      return [];
    }
  }

  /**
   * Validate strategy can be executed
   */
  async validate(account: Account): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if account has options trading enabled
    if (!account.optionsApproved) {
      errors.push('Options trading must be enabled for gamma scalping');
    }

    // Check if account has sufficient buying power
    if (account.buyingPower < 10000) {
      errors.push('Insufficient buying power. Minimum $10,000 required');
    }

    // Check if market is open
    if (!account.marketOpen) {
      warnings.push('Market is currently closed');
    }

    // Check if we have market data access
    try {
      await this.marketData.getQuote(this.config.underlyingSymbol);
    } catch (error) {
      errors.push('Unable to access market data for underlying symbol');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate total gamma exposure across all positions
   */
  private async calculateGammaExposure(): Promise<number> {
    let totalGamma = 0;
    
    for (const position of this.positions.values()) {
      const currentOption = await this.marketData.getOptionQuote(position.optionSymbol);
      if (currentOption && currentOption.greeks) {
        totalGamma += position.quantity * currentOption.greeks.gamma * 100; // Contract multiplier
      }
    }
    
    return totalGamma;
  }

  /**
   * Generate hedge signal based on gamma exposure
   */
  private async generateHedgeSignal(
    marketData: MarketData, 
    gammaExposure: number
  ): Promise<Signal | null> {
    // Calculate shares needed to hedge
    const sharesToHedge = Math.round(-gammaExposure * marketData.price);
    
    if (Math.abs(sharesToHedge) < 1) {
      return null;
    }

    return {
      action: sharesToHedge > 0 ? 'buy' : 'sell',
      symbol: marketData.symbol,
      side: sharesToHedge > 0 ? 'buy' : 'sell',
      quantity: Math.abs(sharesToHedge),
      orderType: 'market' as OrderType,
      timeInForce: 'day' as TimeInForce,
      reason: `Gamma hedge: ${gammaExposure.toFixed(2)} gamma exposure`,
      confidence: 0.9
    };
  }

  /**
   * Scan for new gamma scalping opportunities
   */
  private async scanForEntry(marketData: MarketData): Promise<Signal | null> {
    // Look for high gamma options near the money
    const atmStrike = Math.round(marketData.price / 5) * 5; // Round to nearest $5
    
    try {
      // Get option chain
      const options = await this.alpaca.getOptionContracts('system', {
        underlyingSymbol: this.config.underlyingSymbol,
        minStrike: atmStrike - 10,
        maxStrike: atmStrike + 10,
        minExpiration: 7,
        maxExpiration: 45
      });

      // Find option with highest gamma
      let bestOption: OptionWithGreeks | null = null;
      let highestGamma = 0;

      for (const option of options) {
        const quote = await this.marketData.getOptionQuote(option.symbol);
        if (quote && quote.greeks && quote.greeks.gamma > highestGamma) {
          highestGamma = quote.greeks.gamma;
          bestOption = { ...option, quote, greeks: quote.greeks };
        }
      }

      if (bestOption && highestGamma > this.config.gammaThreshold) {
        return {
          action: 'buy',
          symbol: bestOption.symbol,
          side: 'buy',
          quantity: 1,
          orderType: 'limit' as OrderType,
          timeInForce: 'day' as TimeInForce,
          limitPrice: bestOption.quote!.askPrice,
          reason: `High gamma opportunity: ${highestGamma.toFixed(4)}`,
          confidence: 0.7
        };
      }
    } catch (error) {
      console.error('Error scanning for entry:', error);
    }

    return null;
  }

  /**
   * Check exit conditions for existing positions
   */
  private async checkExitConditions(marketData: MarketData): Promise<Signal[]> {
    const signals: Signal[] = [];

    for (const [symbol, position] of this.positions) {
      const quote = await this.marketData.getOptionQuote(position.optionSymbol);
      if (!quote) continue;

      const currentValue = quote.lastPrice * 100 * position.quantity;
      const entryValue = position.entryPrice * 100 * position.quantity;
      const pnlPercent = (currentValue - entryValue) / entryValue;

      // Check stop loss
      if (pnlPercent <= -this.config.stopLossPercent) {
        signals.push({
          action: 'sell',
          symbol: position.optionSymbol,
          side: 'sell',
          quantity: position.quantity,
          orderType: 'market' as OrderType,
          timeInForce: 'day' as TimeInForce,
          reason: `Stop loss triggered: ${(pnlPercent * 100).toFixed(2)}% loss`,
          confidence: 1.0
        });
      }

      // Check take profit
      if (pnlPercent >= this.config.takeProfitPercent) {
        signals.push({
          action: 'sell',
          symbol: position.optionSymbol,
          side: 'sell',
          quantity: position.quantity,
          orderType: 'limit' as OrderType,
          timeInForce: 'day' as TimeInForce,
          limitPrice: quote.bidPrice,
          reason: `Take profit triggered: ${(pnlPercent * 100).toFixed(2)}% gain`,
          confidence: 0.9
        });
      }

      // Check if approaching expiration (< 7 days)
      const daysToExpiry = this.calculateDaysToExpiry(position.expirationDate);
      if (daysToExpiry < 7) {
        signals.push({
          action: 'roll',
          symbol: position.optionSymbol,
          side: 'sell',
          quantity: position.quantity,
          orderType: 'market' as OrderType,
          timeInForce: 'day' as TimeInForce,
          reason: `Rolling position: ${daysToExpiry} days to expiry`,
          confidence: 0.8
        });
      }
    }

    return signals;
  }

  /**
   * Calculate days to expiry
   */
  private calculateDaysToExpiry(expirationDate: string): number {
    const expiry = new Date(expirationDate);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);
  }

  /**
   * Get current strategy state
   */
  getState() {
    return {
      name: this.name,
      status: 'running' as const,
      positions: Array.from(this.positions.entries()).map(([symbol, pos]) => ({
        symbol,
        ...pos
      })),
      metrics: {
        totalPositions: this.positions.size,
        gammaExposure: 0 // Would calculate async
      },
      lastUpdate: new Date()
    };
  }
}