/**
 * Wheel Strategy - TypeScript Implementation
 * 
 * A conservative options strategy that generates income through
 * selling cash-secured puts and covered calls
 */

import { TradingStrategy } from '@/types/strategy';
import type { Signal, MarketData, ValidationResult, Account } from '@/types/strategy';
import { AssetClass } from '@/types/trading';
import type { Order, OrderSide, OrderType, Position } from '@/types/trading';
import type { OptionContract, OptionQuote } from '@/types/options';
import { AlpacaService } from '@/services/alpaca/trading-client';
import { MarketDataService } from '@/services/market-data';
import { BlackScholesEngine } from '@/utils/options-pricing';
import { calculateImpliedVolatility } from '@/utils/options-pricing';

export interface WheelStrategyConfig {
  underlyingSymbol: string;
  buyingPowerLimit: number; // Percentage of buying power to use
  riskFreeRate: number;
  minExpiration: number; // days
  maxExpiration: number; // days
  strikePercentage: number; // Percentage below current price for puts
  targetDelta?: number; // Target delta for option selection
  atrMultiplier?: number; // Multiplier for ATR-based strike selection
  atrPeriod?: number; // Period for ATR calculation
}

export enum WheelState {
  SELLING_PUTS = 'selling_puts',
  STOCK_ASSIGNED = 'stock_assigned',
  SELLING_CALLS = 'selling_calls',
  IDLE = 'idle'
}

interface WheelPosition {
  state: WheelState;
  currentOption?: OptionContract;
  stockQuantity: number;
  avgStockPrice?: number;
  lastPutStrike?: number;
  putSoldPrice?: number;
  callSoldPrice?: number;
}

/**
 * Wheel Strategy Implementation
 * 
 * Key features:
 * - Sells cash-secured puts to collect premium
 * - If assigned, holds stock and sells covered calls
 * - If called away, returns to selling puts
 * - Uses ATR for dynamic strike selection
 */
export class WheelStrategy extends TradingStrategy {
  name = 'Wheel Strategy';
  
  private readonly config: WheelStrategyConfig;
  private readonly alpaca: AlpacaService;
  private readonly marketData: MarketDataService;
  private readonly bsEngine: BlackScholesEngine;
  private position: WheelPosition;
  private atr?: number;

  constructor(
    config: WheelStrategyConfig,
    alpaca: AlpacaService,
    marketData: MarketDataService
  ) {
    super();
    this.config = {
      ...config
    };
    
    this.alpaca = alpaca;
    this.marketData = marketData;
    this.bsEngine = new BlackScholesEngine(config.riskFreeRate);
    
    this.position = {
      state: WheelState.IDLE,
      stockQuantity: 0
    };
  }

  /**
   * Execute the Wheel strategy
   */
  async execute(marketData: MarketData): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      // Update ATR for dynamic strike selection
      await this.updateATR();

      // Check current positions
      await this.updatePositionState();

      // Execute based on current state
      switch (this.position.state) {
        case WheelState.IDLE:
        case WheelState.SELLING_PUTS:
          const putSignal = await this.sellCashSecuredPut(marketData);
          if (putSignal) signals.push(putSignal);
          break;
          
        case WheelState.STOCK_ASSIGNED:
        case WheelState.SELLING_CALLS:
          const callSignal = await this.sellCoveredCall(marketData);
          if (callSignal) signals.push(callSignal);
          break;
      }

      return signals;
    } catch (error) {
      console.error('Error executing Wheel strategy:', error);
      throw error;
    }
  }

  /**
   * Validate strategy can be executed
   */
  async validate(account: Account): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check options approval
    if (!account.optionsApproved) {
      errors.push('Options trading not approved for this account');
    }

    // Check cash for cash-secured puts
    const underlyingPrice = await this.marketData.getStockPrice(this.config.underlyingSymbol);
    const requiredCash = underlyingPrice * 100; // For 1 contract
    
    if (account.cash < requiredCash) {
      errors.push(`Insufficient cash for cash-secured put. Required: $${requiredCash.toFixed(2)}`);
    }

    // Check buying power limit
    const maxAllocation = account.buyingPower * this.config.buyingPowerLimit;
    if (requiredCash > maxAllocation) {
      warnings.push(`Position size exceeds buying power limit of ${(this.config.buyingPowerLimit * 100).toFixed(0)}%`);
    }

    if (!account.marketOpen) {
      warnings.push('Market is currently closed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update position state based on current holdings
   */
  private async updatePositionState(): Promise<void> {
    // Check for stock position
    const stockPosition = await this.alpaca.getPosition('system', this.config.underlyingSymbol);
    
    if (stockPosition && stockPosition.quantity > 0) {
      this.position.stockQuantity = stockPosition.quantity;
      this.position.avgStockPrice = stockPosition.avgEntryPrice;
      
      // Check if we have covered calls
      const hasCall = await this.hasActiveCallOption();
      this.position.state = hasCall ? WheelState.SELLING_CALLS : WheelState.STOCK_ASSIGNED;
    } else {
      this.position.stockQuantity = 0;
      
      // Check if we have puts
      const hasPut = await this.hasActivePutOption();
      this.position.state = hasPut ? WheelState.SELLING_PUTS : WheelState.IDLE;
    }
  }

  /**
   * Sell cash-secured put
   */
  private async sellCashSecuredPut(marketData: MarketData): Promise<Signal | null> {
    // Don't sell puts if we already have one
    if (await this.hasActivePutOption()) {
      return null;
    }

    const underlyingPrice = marketData.price;
    const targetStrike = this.calculatePutStrike(underlyingPrice);

    // Get put options
    const putOptions = await this.alpaca.getOptionContracts('system', {
      underlyingSymbol: this.config.underlyingSymbol,
      optionType: 'put',
      minStrike: targetStrike * 0.95,
      maxStrike: targetStrike * 1.05,
      minExpiration: this.config.minExpiration,
      maxExpiration: this.config.maxExpiration,
      limit: 50
    });

    // Select best put based on delta or premium
    const selectedPut = await this.selectOptimalPut(putOptions, underlyingPrice);
    
    if (!selectedPut) {
      console.log('No suitable put option found');
      return null;
    }

    // Get quote for the selected put
    const quote = await this.marketData.getOptionQuote(selectedPut.symbol);
    
    this.position.currentOption = selectedPut;
    this.position.lastPutStrike = selectedPut.strikePrice;
    this.position.putSoldPrice = quote.bidPrice;
    this.position.state = WheelState.SELLING_PUTS;

    return {
      action: 'sell',
      symbol: selectedPut.symbol,
      side: 'sell',
      quantity: 1,
      orderType: 'limit',
      timeInForce: 'day',
      limitPrice: quote.bidPrice,
      reason: `Wheel: Sell CSP at ${selectedPut.strikePrice} strike, ${this.calculateDaysToExpiry(selectedPut.expirationDate)} DTE`,
      confidence: 0.85,
      expectedReturn: quote.bidPrice * 100,
      risk: {
        maxLoss: (selectedPut.strikePrice - quote.bidPrice) * 100,
        probability: 0.3
      }
    };
  }

  /**
   * Sell covered call
   */
  private async sellCoveredCall(marketData: MarketData): Promise<Signal | null> {
    // Don't sell calls if we already have one or no stock
    if (await this.hasActiveCallOption() || this.position.stockQuantity < 100) {
      return null;
    }

    const underlyingPrice = marketData.price;
    const targetStrike = this.calculateCallStrike(underlyingPrice);

    // Get call options
    const callOptions = await this.alpaca.getOptionContracts('system', {
      underlyingSymbol: this.config.underlyingSymbol,
      optionType: 'call',
      minStrike: targetStrike * 0.95,
      maxStrike: targetStrike * 1.05,
      minExpiration: this.config.minExpiration,
      maxExpiration: this.config.maxExpiration,
      limit: 50
    });

    // Select best call
    const selectedCall = await this.selectOptimalCall(callOptions, underlyingPrice);
    
    if (!selectedCall) {
      console.log('No suitable call option found');
      return null;
    }

    // Get quote
    const quote = await this.marketData.getOptionQuote(selectedCall.symbol);
    
    this.position.currentOption = selectedCall;
    this.position.callSoldPrice = quote.bidPrice;
    this.position.state = WheelState.SELLING_CALLS;

    return {
      action: 'sell',
      symbol: selectedCall.symbol,
      side: 'sell',
      quantity: Math.floor(this.position.stockQuantity / 100), // 1 call per 100 shares
      orderType: 'limit',
      timeInForce: 'day',
      limitPrice: quote.bidPrice,
      reason: `Wheel: Sell CC at ${selectedCall.strikePrice} strike, ${this.calculateDaysToExpiry(selectedCall.expirationDate)} DTE`,
      confidence: 0.85,
      expectedReturn: quote.bidPrice * 100
    };
  }

  /**
   * Calculate put strike price
   */
  private calculatePutStrike(underlyingPrice: number): number {
    if (this.atr && this.config.atrMultiplier) {
      // ATR-based strike selection
      return underlyingPrice - (this.atr * this.config.atrMultiplier);
    } else {
      // Percentage-based strike selection
      return underlyingPrice * (1 - this.config.strikePercentage);
    }
  }

  /**
   * Calculate call strike price
   */
  private calculateCallStrike(underlyingPrice: number): number {
    // Ensure we sell above our cost basis if possible
    const minStrike = this.position.avgStockPrice || underlyingPrice;
    
    if (this.atr && this.config.atrMultiplier) {
      // ATR-based strike selection
      const atrStrike = underlyingPrice + (this.atr * this.config.atrMultiplier * 0.5);
      return Math.max(minStrike, atrStrike);
    } else {
      // Percentage-based strike selection
      const pctStrike = underlyingPrice * (1 + this.config.strikePercentage);
      return Math.max(minStrike, pctStrike);
    }
  }

  /**
   * Select optimal put option
   */
  private async selectOptimalPut(
    options: OptionContract[],
    underlyingPrice: number
  ): Promise<OptionContract | null> {
    if (options.length === 0) return null;

    // Calculate Greeks for each option
    const optionsWithGreeks = await Promise.all(
      options.map(async (option) => {
        const quote = await this.marketData.getOptionQuote(option.symbol);
        const midPrice = (quote.bidPrice + quote.askPrice) / 2;
        const timeToExpiry = this.calculateTimeToExpiry(option.expirationDate);
        
        const iv = calculateImpliedVolatility({
          optionPrice: midPrice,
          underlyingPrice,
          strikePrice: option.strikePrice,
          timeToExpiry,
          riskFreeRate: this.config.riskFreeRate,
          optionType: 'put'
        });

        const greeks = this.bsEngine.calculateGreeks({
          underlyingPrice,
          strikePrice: option.strikePrice,
          timeToExpiry,
          volatility: iv,
          optionType: 'put'
        });

        return { option, quote, greeks };
      })
    );

    // Filter by target delta if specified
    let filtered = optionsWithGreeks;
    if (this.config.targetDelta) {
      filtered = optionsWithGreeks.filter(
        ({ greeks }) => Math.abs(greeks.delta - this.config.targetDelta!) < 0.1
      );
    }

    if (filtered.length === 0) filtered = optionsWithGreeks;

    // Select option with best premium/risk ratio
    return filtered.reduce((best, current) => {
      const bestRatio = best.quote.bidPrice / (underlyingPrice - best.option.strikePrice);
      const currentRatio = current.quote.bidPrice / (underlyingPrice - current.option.strikePrice);
      return currentRatio > bestRatio ? current : best;
    }).option;
  }

  /**
   * Select optimal call option
   */
  private async selectOptimalCall(
    options: OptionContract[],
    underlyingPrice: number
  ): Promise<OptionContract | null> {
    if (options.length === 0) return null;

    // Filter options above our cost basis
    const minStrike = this.position.avgStockPrice || underlyingPrice;
    const validOptions = options.filter(opt => opt.strikePrice >= minStrike);
    
    if (validOptions.length === 0) return null;

    // Calculate expected returns for each option
    const optionsWithReturns = await Promise.all(
      validOptions.map(async (option) => {
        const quote = await this.marketData.getOptionQuote(option.symbol);
        const daysToExpiry = this.calculateDaysToExpiry(option.expirationDate);
        
        // Annualized return if called away
        const returnIfCalled = (
          (option.strikePrice - (this.position.avgStockPrice || underlyingPrice) + quote.bidPrice) /
          (this.position.avgStockPrice || underlyingPrice)
        ) * (365 / daysToExpiry);

        return { option, quote, returnIfCalled };
      })
    );

    // Select option with best annualized return
    return optionsWithReturns.reduce((best, current) => current.returnIfCalled > best.returnIfCalled ? current : best).option;
  }

  /**
   * Update ATR for dynamic strike selection
   */
  private async updateATR(): Promise<void> {
    try {
      // Get historical data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      
      const historicalData = await this.marketData.getHistoricalData(
        this.config.underlyingSymbol,
        startDate,
        endDate,
        '1Day'
      );

      if (historicalData.length < this.config.atrPeriod!) {
        return;
      }

      // Calculate True Range
      const trueRanges: number[] = [];
      for (let i = 1; i < historicalData.length; i++) {
        const current = historicalData[i];
        const previous = historicalData[i - 1];
        
        const highLow = current.high! - current.low!;
        const highPrevClose = Math.abs(current.high! - previous.close!);
        const lowPrevClose = Math.abs(current.low! - previous.close!);
        
        trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
      }

      // Calculate ATR
      if (trueRanges.length >= this.config.atrPeriod!) {
        const recentTRs = trueRanges.slice(-this.config.atrPeriod!);
        this.atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / this.config.atrPeriod!;
      }
    } catch (error) {
      console.error('Error calculating ATR:', error);
    }
  }

  /**
   * Check if we have an active put option
   */
  private async hasActivePutOption(): Promise<boolean> {
    const positions = await this.alpaca.getAllPositions('system');
    
    return positions.some(pos => 
      pos.assetClass === AssetClass.US_OPTION &&
      pos.symbol.includes(this.config.underlyingSymbol) &&
      pos.symbol.includes('P') && // Put option
      pos.quantity < 0 // Short position
    );
  }

  /**
   * Check if we have an active call option
   */
  private async hasActiveCallOption(): Promise<boolean> {
    const positions = await this.alpaca.getAllPositions('system');
    
    return positions.some(pos => 
      pos.assetClass === AssetClass.US_OPTION &&
      pos.symbol.includes(this.config.underlyingSymbol) &&
      pos.symbol.includes('C') && // Call option
      pos.quantity < 0 // Short position
    );
  }

  /**
   * Calculate time to expiry in years
   */
  private calculateTimeToExpiry(expirationDate: string): number {
    const expiry = new Date(expirationDate);
    const now = new Date();
    const days = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(days / 365, 0.001);
  }

  /**
   * Calculate days to expiry
   */
  private calculateDaysToExpiry(expirationDate: string): number {
    const expiry = new Date(expirationDate);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Handle option assignment
   */
  async onPositionUpdate(symbol: string, quantity: number): Promise<void> {
    // Check if this is our underlying stock
    if (symbol === this.config.underlyingSymbol && quantity > 0) {
      console.log(`Wheel: Stock assigned - ${quantity} shares of ${symbol}`);
      this.position.state = WheelState.STOCK_ASSIGNED;
      this.position.stockQuantity = quantity;
    }
  }

  /**
   * Get current strategy state
   */
  getStrategyState(): any {
    return {
      name: this.name,
      state: this.position.state,
      stockQuantity: this.position.stockQuantity,
      avgStockPrice: this.position.avgStockPrice,
      currentOption: this.position.currentOption,
      atr: this.atr,
      config: this.config
    };
  }
}