/**
 * Gamma Scalping Strategy - TypeScript Implementation
 * 
 * This strategy maintains a delta-neutral portfolio by continuously rebalancing
 * stock positions against options positions as the underlying price moves.
 */

import type { TradingStrategy, MarketData, TradingOrder, BacktestResult } from '../types';
import type { Account } from '../types/trading';
import { AssetClass } from '../types/trading';
import type { OptionContract } from '../types/options';
import { AlpacaTradingService as _AlpacaTradingService } from '../services/alpaca/AlpacaTradingService';
import { AlpacaMarketData as _AlpacaMarketData } from '../services/alpaca/AlpacaMarketData';
import { BlackScholesEngine } from '../utils/options-pricing';

// Define missing types for now
interface Signal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  quantity: number;
  confidence: number;
}

interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}


interface Position {
  symbol: string;
  quantity: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
}

interface Order {
  symbol: string;
  side: OrderSide;
  quantity: number;
  type: OrderType;
  limitPrice?: number;
}

type OrderSide = 'buy' | 'sell';
type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
type AssetClass = 'us_equity' | 'us_option';

interface OptionContract {
  symbol: string;
  strike: number;
  expiration: Date;
  right: 'call' | 'put';
}

interface OptionQuote {
  bid: number;
  ask: number;
  last: number;
  bidSize: number;
  askSize: number;
}

interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

// Placeholder for implied volatility calculation
const calculateImpliedVolatility = (_price: number, _params: any): number => 
  // Simplified IV calculation
   0.25
;

export interface GammaScalpingConfig {
  underlyingSymbol: string;
  maxAbsNotionalDelta: number;
  riskFreeRate: number;
  minExpiration: number; // days
  maxExpiration: number; // days
  minStrike?: number; // percentage above current price
  maxContracts?: number; // max option contracts to hold
  rebalanceThreshold?: number; // delta threshold for rebalancing
}

export interface PositionState {
  [symbol: string]: {
    assetClass: AssetClass;
    underlyingSymbol?: string;
    expirationDate?: Date;
    strikePrice?: number;
    optionType?: 'call' | 'put';
    contractSize?: number;
    position: number;
    initialPosition: number;
    lastPrice?: number;
    greeks?: Greeks;
  };
}

/**
 * Gamma Scalping Strategy Implementation
 * 
 * Key features:
 * - Maintains delta-neutral portfolio
 * - Profits from gamma (convexity) of options
 * - Automatically rebalances as underlying moves
 */
export class GammaScalpingStrategy extends TradingStrategy {
  private readonly config: GammaScalpingConfig;
  private readonly alpaca: AlpacaService;
  private readonly marketData: MarketDataService;
  private readonly bsEngine: BlackScholesEngine;
  private positions: PositionState = {};
  private isInitialized = false;

  constructor(
    config: GammaScalpingConfig,
    alpaca: AlpacaService,
    marketData: MarketDataService
  ) {
    super();
    this.config = {
      minStrike: 1.01, // 1% above current price
      maxContracts: 3,
      rebalanceThreshold: 0.1,
      ...config
    };
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
      // Initialize positions if not done
      if (!this.isInitialized) {
        await this.initializePositions();
        this.isInitialized = true;
      }

      // Update current prices and calculate Greeks
      await this.updatePositionGreeks();

      // Calculate portfolio delta
      const portfolioDelta = this.calculatePortfolioDelta();
      console.log(`Portfolio Delta: ${portfolioDelta.toFixed(2)}`);

      // Check if rebalancing is needed
      const deltaNotional = Math.abs(portfolioDelta * marketData.price);
      if (deltaNotional > this.config.maxAbsNotionalDelta) {
        const rebalanceSignal = this.generateRebalanceSignal(portfolioDelta, marketData.price);
        if (rebalanceSignal) {
          signals.push(rebalanceSignal);
        }
      }

      // Monitor option positions for adjustments
      const adjustmentSignals = await this.checkOptionAdjustments();
      signals.push(...adjustmentSignals);

      return signals;
    } catch (error) {
      console.error('Error executing Gamma Scalping strategy:', error);
      throw error;
    }
  }

  /**
   * Validate strategy can be executed
   */
  async validate(account: Account): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check account permissions
    if (!account.optionsApproved) {
      errors.push('Options trading not approved for this account');
    }

    // Check buying power
    const requiredBuyingPower = this.estimateRequiredCapital();
    if (account.buyingPower < requiredBuyingPower) {
      errors.push(`Insufficient buying power. Required: $${requiredBuyingPower.toFixed(2)}`);
    }

    // Check if market is open
    if (!account.marketOpen) {
      warnings.push('Market is currently closed');
    }

    // Validate underlying symbol
    try {
      await this.marketData.validateSymbol(this.config.underlyingSymbol);
    } catch (error) {
      errors.push(`Invalid underlying symbol: ${this.config.underlyingSymbol}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Initialize option positions
   */
  private async initializePositions(): Promise<void> {
    console.log(`Initializing positions for ${this.config.underlyingSymbol}`);

    // Clear existing positions related to this underlying
    await this.liquidateExistingPositions();

    // Add underlying to positions
    this.positions[this.config.underlyingSymbol] = {
      assetClass: AssetClass.US_EQUITY,
      position: 0,
      initialPosition: 0
    };

    // Get current underlying price
    const underlyingPrice = await this.marketData.getStockPrice(this.config.underlyingSymbol);
    const minStrike = underlyingPrice * (this.config.minStrike || 1.01);

    // Search for suitable option contracts
    const optionChain = await this.alpaca.getOptionContracts({
      underlyingSymbol: this.config.underlyingSymbol,
      minExpiration: this.config.minExpiration,
      maxExpiration: this.config.maxExpiration,
      optionType: 'call',
      minStrike,
      limit: 10
    });

    // Select top contracts based on liquidity and Greeks
    const selectedContracts = this.selectBestContracts(optionChain, underlyingPrice);

    // Add selected contracts to positions
    for (const contract of selectedContracts) {
      this.positions[contract.symbol] = {
        assetClass: AssetClass.US_OPTION,
        underlyingSymbol: contract.underlyingSymbol,
        expirationDate: new Date(contract.expirationDate),
        strikePrice: contract.strikePrice,
        optionType: contract.type,
        contractSize: contract.contractSize,
        position: 0,
        initialPosition: 1 // Start with 1 contract each
      };
    }

    // Execute initial trades
    await this.executeInitialTrades();
  }

  /**
   * Select best option contracts based on criteria
   */
  private selectBestContracts(
    contracts: OptionContract[],
    underlyingPrice: number
  ): OptionContract[] {
    // Filter and sort contracts
    const suitable = contracts
      .filter(contract => {
        const moneyness = (contract as any).strikePrice / underlyingPrice;
        return moneyness >= 1.01 && moneyness <= 1.10; // 1-10% OTM
      })
      .sort((a, b) => {
        // Prefer contracts with better liquidity (volume/OI)
        const liquidityA = ((a as any).volume || 0) + ((a as any).openInterest || 0);
        const liquidityB = ((b as any).volume || 0) + ((b as any).openInterest || 0);
        return liquidityB - liquidityA;
      });

    // Return top N contracts
    return suitable.slice(0, this.config.maxContracts || 3);
  }

  /**
   * Update Greeks for all option positions
   */
  private async updatePositionGreeks(): Promise<void> {
    const underlyingPrice = await this.marketData.getStockPrice(this.config.underlyingSymbol);

    for (const [_symbol, position] of Object.entries(this.positions)) {
      if (position.assetClass === AssetClass.US_OPTION && position.position !== 0) {
        // Get option quote
        const quote = await this.marketData.getOptionQuote(symbol);
        const midPrice = (quote.bidPrice + quote.askPrice) / 2;
        
        // Calculate time to expiration
        const now = new Date();
        const expiry = position.expirationDate!;
        const daysToExpiry = Math.max(1, (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const timeToExpiry = daysToExpiry / 365;

        // Calculate implied volatility
        const iv = calculateImpliedVolatility({
          optionPrice: midPrice,
          underlyingPrice,
          strikePrice: position.strikePrice!,
          timeToExpiry,
          riskFreeRate: this.config.riskFreeRate,
          optionType: position.optionType!
        });

        // Calculate Greeks
        position.greeks = this.bsEngine.calculateGreeks({
          underlyingPrice,
          strikePrice: position.strikePrice!,
          timeToExpiry,
          volatility: iv,
          optionType: position.optionType!
        });

        position.lastPrice = midPrice;
      }
    }
  }

  /**
   * Calculate total portfolio delta
   */
  private calculatePortfolioDelta(): number {
    let totalDelta = 0;

    for (const [_symbol, position] of Object.entries(this.positions)) {
      if (position.assetClass === AssetClass.US_EQUITY) {
        // Stock has delta of 1
        totalDelta += position.position;
      } else if (position.assetClass === AssetClass.US_OPTION && position.greeks) {
        // Option delta scaled by position and contract size
        totalDelta += position.greeks.delta * position.position * (position.contractSize || 100);
      }
    }

    return totalDelta;
  }

  /**
   * Generate rebalancing signal to maintain delta neutrality
   */
  private generateRebalanceSignal(currentDelta: number, underlyingPrice: number): Signal | null {
    const targetDelta = 0; // Delta neutral
    const deltaToAdjust = targetDelta - currentDelta;

    if (Math.abs(deltaToAdjust) < this.config.rebalanceThreshold) {
      return null; // No adjustment needed
    }

    // Determine side and quantity
    const side: OrderSide = deltaToAdjust > 0 ? 'buy' : 'sell';
    const quantity = Math.round(Math.abs(deltaToAdjust));

    return {
      action: 'rebalance',
      symbol: this.config.underlyingSymbol,
      side,
      quantity,
      orderType: 'market' as OrderType,
      timeInForce: 'day',
      reason: `Delta rebalance: current=${currentDelta.toFixed(2)}, adjustment=${deltaToAdjust.toFixed(2)}`,
      confidence: 0.95,
      expectedReturn: 0, // Gamma scalping profits from volatility, not directional moves
      risk: {
        maxLoss: quantity * underlyingPrice * 0.02, // 2% adverse move
        probability: 0.1
      }
    };
  }

  /**
   * Check if option positions need adjustment
   */
  private async checkOptionAdjustments(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const underlyingPrice = await this.marketData.getStockPrice(this.config.underlyingSymbol);

    for (const [_symbol, position] of Object.entries(this.positions)) {
      if (position.assetClass !== AssetClass.US_OPTION || position.position === 0) {
        continue;
      }

      // Check if option is too far ITM or OTM
      const moneyness = position.strikePrice! / underlyingPrice;
      
      if (position.optionType === 'call' && moneyness < 0.95) {
        // Call is too deep ITM, consider rolling
        signals.push({
          action: 'roll',
          symbol,
          side: 'sell',
          quantity: position.position,
          orderType: 'market' as OrderType,
          timeInForce: 'day',
          reason: `Option too deep ITM (moneyness: ${moneyness.toFixed(3)})`,
          confidence: 0.8
        });
      } else if (position.optionType === 'call' && moneyness > 1.15) {
        // Call is too far OTM, consider rolling
        signals.push({
          action: 'roll',
          symbol,
          side: 'sell',
          quantity: position.position,
          orderType: 'market' as OrderType,
          timeInForce: 'day',
          reason: `Option too far OTM (moneyness: ${moneyness.toFixed(3)})`,
          confidence: 0.8
        });
      }

      // Check days to expiration
      const daysToExpiry = Math.ceil(
        (position.expirationDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysToExpiry < 7) {
        // Close positions nearing expiration
        signals.push({
          action: 'close',
          symbol,
          side: position.position > 0 ? 'sell' : 'buy',
          quantity: Math.abs(position.position),
          orderType: 'market' as OrderType,
          timeInForce: 'day',
          reason: `Approaching expiration (${daysToExpiry} days)`,
          confidence: 0.9
        });
      }
    }

    return signals;
  }

  /**
   * Execute initial option trades
   */
  private async executeInitialTrades(): Promise<void> {
    console.log('Executing initial option trades');

    for (const [_symbol, position] of Object.entries(this.positions)) {
      if (position.assetClass === AssetClass.US_OPTION && position.initialPosition !== 0) {
        const order: Order = {
          symbol,
          side: position.initialPosition > 0 ? 'buy' : 'sell',
          quantity: Math.abs(position.initialPosition),
          orderType: 'market',
          timeInForce: 'day'
        };

        console.log(`Submitting order: ${order.side} ${order.quantity} ${symbol}`);
        await this.alpaca.submitOrder(order);
      }
    }
  }

  /**
   * Liquidate existing positions
   */
  private async liquidateExistingPositions(): Promise<void> {
    console.log(`Liquidating existing positions for ${this.config.underlyingSymbol}`);
    
    const allPositions = await this.alpaca.getAllPositions();
    
    for (const position of allPositions) {
      if (position.assetClass === AssetClass.US_OPTION) {
        const contract = await this.alpaca.getOptionContract(position.symbol);
        if (contract.underlyingSymbol === this.config.underlyingSymbol) {
          console.log(`Closing position: ${position.quantity} ${position.symbol}`);
          await this.alpaca.closePosition(position.symbol);
        }
      } else if (position.symbol === this.config.underlyingSymbol) {
        console.log(`Closing position: ${position.quantity} ${position.symbol}`);
        await this.alpaca.closePosition(position.symbol);
      }
    }
  }

  /**
   * Estimate required capital for the strategy
   */
  private estimateRequiredCapital(): number {
    // Rough estimate: need enough to buy 100 shares + option premiums
    // This should be refined based on actual market prices
    return 10000; // $10k minimum
  }

  /**
   * Handle position updates from trading events
   */
  async onPositionUpdate(symbol: string, newQuantity: number): Promise<void> {
    if (symbol in this.positions) {
      const oldQuantity = this.positions[symbol].position;
      this.positions[symbol].position = newQuantity;
      
      console.log(`Position update: ${symbol} from ${oldQuantity} to ${newQuantity}`);
      
      // Trigger rebalance check after position update
      const marketData = await this.marketData.getLatestData(this.config.underlyingSymbol);
      await this.execute(marketData);
    }
  }

  /**
   * Get current strategy state for monitoring
   */
  getStrategyState(): any {
    const portfolioDelta = this.calculatePortfolioDelta();
    const portfolioGamma = this.calculatePortfolioGamma();
    
    return {
      name: 'Gamma Scalping',
      underlying: this.config.underlyingSymbol,
      positions: this.positions,
      metrics: {
        delta: portfolioDelta,
        gamma: portfolioGamma,
        deltaNotional: portfolioDelta * (this.positions[this.config.underlyingSymbol]?.lastPrice || 0),
        optionCount: Object.values(this.positions).filter(p => p.assetClass === AssetClass.US_OPTION).length
      },
      config: this.config
    };
  }

  /**
   * Calculate total portfolio gamma
   */
  private calculatePortfolioGamma(): number {
    let totalGamma = 0;

    for (const position of Object.values(this.positions)) {
      if (position.assetClass === AssetClass.US_OPTION && position.greeks) {
        totalGamma += position.greeks.gamma * position.position * (position.contractSize || 100);
      }
    }

    return totalGamma;
  }
}