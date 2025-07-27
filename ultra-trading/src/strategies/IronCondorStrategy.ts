/**
 * Iron Condor Strategy - TypeScript Implementation
 * 
 * Four-leg options strategy that profits from low volatility
 * Combines a bull put spread with a bear call spread
 */

import { TradingStrategy, Signal, MarketData, ValidationResult, Account } from '@/types/strategy';
import { Order, OrderSide, OrderType, AssetClass } from '@/types/trading';
import { OptionContract, OptionQuote } from '@/types/options';
import { AlpacaService } from '@/services/alpaca/trading-client';
import { MarketDataService } from '@/services/market-data';
import { BlackScholesEngine } from '@/utils/options-pricing';
import { calculateImpliedVolatility } from '@/utils/options-pricing';

export interface IronCondorConfig {
  underlyingSymbol: string;
  strikeRange: number; // Percentage range around underlying price (e.g., 0.15 for 15%)
  buyingPowerLimit: number; // Percentage of buying power to use
  riskFreeRate: number;
  minExpiration: number; // days
  maxExpiration: number; // days
  openInterestThreshold: number;
  targetProfitPercentage: number;
  commonExpirationRange: [number, number]; // [min days, max days]
}

export interface IronCondorCriteria {
  longPut: {
    expirationRange: [number, number];
    ivRange: [number, number];
    deltaRange: [number, number];
    thetaRange: [number, number];
  };
  shortPut: {
    expirationRange: [number, number];
    ivRange: [number, number];
    deltaRange: [number, number];
    thetaRange: [number, number];
  };
  shortCall: {
    expirationRange: [number, number];
    ivRange: [number, number];
    deltaRange: [number, number];
    thetaRange: [number, number];
  };
  longCall: {
    expirationRange: [number, number];
    ivRange: [number, number];
    deltaRange: [number, number];
    thetaRange: [number, number];
  };
}

interface IronCondorLegs {
  longPut?: OptionContract;
  shortPut?: OptionContract;
  shortCall?: OptionContract;
  longCall?: OptionContract;
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
 * Iron Condor Strategy Implementation
 * 
 * Key features:
 * - Profits from range-bound markets with low volatility
 * - Limited risk, limited profit
 * - Four legs: long put, short put, short call, long call
 */
export class IronCondorStrategy extends TradingStrategy {
  name = 'Iron Condor';
  
  private readonly config: IronCondorConfig;
  private readonly alpaca: AlpacaService;
  private readonly marketData: MarketDataService;
  private readonly bsEngine: BlackScholesEngine;
  private readonly criteria: IronCondorCriteria;
  private currentPosition?: IronCondorLegs;
  private entryNetCredit?: number;

  constructor(
    config: IronCondorConfig,
    alpaca: AlpacaService,
    marketData: MarketDataService
  ) {
    super();
    this.config = {
      strikeRange: 0.15,
      buyingPowerLimit: 0.05,
      riskFreeRate: 0.01,
      minExpiration: 7,
      maxExpiration: 42,
      openInterestThreshold: 100,
      targetProfitPercentage: 0.4,
      commonExpirationRange: [14, 35],
      ...config
    };
    
    this.alpaca = alpaca;
    this.marketData = marketData;
    this.bsEngine = new BlackScholesEngine(config.riskFreeRate);

    // Define selection criteria for each leg
    this.criteria = {
      longPut: {
        expirationRange: this.config.commonExpirationRange,
        ivRange: [0.15, 0.50],
        deltaRange: [-0.20, -0.01],
        thetaRange: [-0.1, -0.005]
      },
      shortPut: {
        expirationRange: this.config.commonExpirationRange,
        ivRange: [0.10, 0.40],
        deltaRange: [-0.30, -0.03],
        thetaRange: [-0.2, -0.01]
      },
      shortCall: {
        expirationRange: this.config.commonExpirationRange,
        ivRange: [0.10, 0.40],
        deltaRange: [0.03, 0.30],
        thetaRange: [-0.2, -0.01]
      },
      longCall: {
        expirationRange: this.config.commonExpirationRange,
        ivRange: [0.15, 0.50],
        deltaRange: [0.01, 0.20],
        thetaRange: [-0.1, -0.005]
      }
    };
  }

  /**
   * Execute the Iron Condor strategy
   */
  async execute(marketData: MarketData): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      // Check if we have an existing position
      if (this.currentPosition) {
        // Monitor existing position for exit signals
        const exitSignals = await this.checkExitConditions(marketData);
        signals.push(...exitSignals);
      } else {
        // Look for entry opportunity
        const entrySignal = await this.findEntryOpportunity(marketData);
        if (entrySignal) {
          signals.push(...entrySignal);
        }
      }

      return signals;
    } catch (error) {
      console.error('Error executing Iron Condor strategy:', error);
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
    if (!account.optionsApproved || account.optionsLevel < 3) {
      errors.push('Options level 3 or higher required for Iron Condor');
    }

    // Check buying power
    const requiredBuyingPower = account.buyingPower * this.config.buyingPowerLimit;
    if (account.buyingPower < 5000) {
      errors.push('Insufficient buying power for Iron Condor strategy');
    }

    // Check if market is open
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
   * Find entry opportunity for Iron Condor
   */
  private async findEntryOpportunity(marketData: MarketData): Promise<Signal[]> {
    const underlyingPrice = marketData.price;
    
    // Get option chains for puts and calls
    const [putChain, callChain] = await Promise.all([
      this.getFilteredOptionChain('put', underlyingPrice),
      this.getFilteredOptionChain('call', underlyingPrice)
    ]);

    // Select best legs based on criteria
    const selectedLegs = await this.selectOptimalLegs(putChain, callChain, underlyingPrice);
    
    if (!this.validateLegs(selectedLegs)) {
      return [];
    }

    // Calculate net credit and risk
    const netCredit = this.calculateNetCredit(selectedLegs);
    const maxRisk = this.calculateMaxRisk(selectedLegs);
    
    if (netCredit <= 0) {
      console.log('Iron Condor would result in net debit, skipping');
      return [];
    }

    // Generate entry signals
    return this.generateEntrySignals(selectedLegs, netCredit, maxRisk);
  }

  /**
   * Get filtered option chain based on criteria
   */
  private async getFilteredOptionChain(
    optionType: 'call' | 'put',
    underlyingPrice: number
  ): Promise<OptionWithGreeks[]> {
    const minStrike = underlyingPrice * (1 - this.config.strikeRange);
    const maxStrike = underlyingPrice * (1 + this.config.strikeRange);

    const contracts = await this.alpaca.getOptionContracts('system', {
      underlyingSymbol: this.config.underlyingSymbol,
      optionType,
      minStrike,
      maxStrike,
      minExpiration: this.config.minExpiration,
      maxExpiration: this.config.maxExpiration,
      limit: 100
    });

    // Filter by open interest and calculate Greeks
    const filteredContracts: OptionWithGreeks[] = [];
    
    for (const contract of contracts) {
      if ((contract.openInterest || 0) < this.config.openInterestThreshold) {
        continue;
      }

      // Get quote and calculate Greeks
      const quote = await this.marketData.getOptionQuote(contract.symbol);
      const midPrice = (quote.bidPrice + quote.askPrice) / 2;
      
      const timeToExpiry = this.calculateTimeToExpiry(contract.expirationDate);
      
      // Calculate implied volatility
      const iv = calculateImpliedVolatility({
        optionPrice: midPrice,
        underlyingPrice,
        strikePrice: contract.strikePrice,
        timeToExpiry,
        riskFreeRate: this.config.riskFreeRate,
        optionType
      });

      // Calculate Greeks
      const greeks = this.bsEngine.calculateGreeks({
        underlyingPrice,
        strikePrice: contract.strikePrice,
        timeToExpiry,
        volatility: iv,
        optionType
      });

      filteredContracts.push({
        ...contract,
        quote,
        greeks: {
          ...greeks,
          iv
        }
      });
    }

    return filteredContracts;
  }

  /**
   * Select optimal legs based on criteria
   */
  private async selectOptimalLegs(
    putChain: OptionWithGreeks[],
    callChain: OptionWithGreeks[],
    underlyingPrice: number
  ): Promise<IronCondorLegs> {
    const legs: IronCondorLegs = {};

    // Sort puts by strike (descending) and calls by strike (ascending)
    putChain.sort((a, b) => b.strikePrice - a.strikePrice);
    callChain.sort((a, b) => a.strikePrice - b.strikePrice);

    // Select short put (higher strike)
    legs.shortPut = this.selectLeg(putChain, this.criteria.shortPut, 'shortPut');
    
    // Select long put (lower strike than short put)
    if (legs.shortPut) {
      const lowerPuts = putChain.filter(p => p.strikePrice < legs.shortPut!.strikePrice);
      legs.longPut = this.selectLeg(lowerPuts, this.criteria.longPut, 'longPut');
    }

    // Select short call (lower strike)
    legs.shortCall = this.selectLeg(callChain, this.criteria.shortCall, 'shortCall');
    
    // Select long call (higher strike than short call)
    if (legs.shortCall) {
      const higherCalls = callChain.filter(c => c.strikePrice > legs.shortCall!.strikePrice);
      legs.longCall = this.selectLeg(higherCalls, this.criteria.longCall, 'longCall');
    }

    return legs;
  }

  /**
   * Select best leg based on criteria
   */
  private selectLeg(
    options: OptionWithGreeks[],
    criteria: any,
    legType: string
  ): OptionWithGreeks | undefined {
    const validOptions = options.filter(opt => {
      if (!opt.greeks) return false;
      
      const { delta, theta, iv } = opt.greeks;
      const daysToExpiry = this.calculateDaysToExpiry(opt.expirationDate);
      
      return (
        daysToExpiry >= criteria.expirationRange[0] &&
        daysToExpiry <= criteria.expirationRange[1] &&
        iv >= criteria.ivRange[0] &&
        iv <= criteria.ivRange[1] &&
        delta >= criteria.deltaRange[0] &&
        delta <= criteria.deltaRange[1] &&
        theta >= criteria.thetaRange[0] &&
        theta <= criteria.thetaRange[1]
      );
    });

    if (validOptions.length === 0) {
      console.log(`No valid options found for ${legType}`);
      return undefined;
    }

    // Select option with best theta (least negative for income generation)
    return validOptions.reduce((best, current) => (current.greeks!.theta > best.greeks!.theta) ? current : best);
  }

  /**
   * Validate all legs are selected
   */
  private validateLegs(legs: IronCondorLegs): boolean {
    return !!(legs.longPut && legs.shortPut && legs.shortCall && legs.longCall);
  }

  /**
   * Calculate net credit from all legs
   */
  private calculateNetCredit(legs: IronCondorLegs): number {
    let credit = 0;

    if (legs.shortPut?.quote) {
      credit += (legs.shortPut.quote.bidPrice + legs.shortPut.quote.askPrice) / 2;
    }
    if (legs.longPut?.quote) {
      credit -= (legs.longPut.quote.bidPrice + legs.longPut.quote.askPrice) / 2;
    }
    if (legs.shortCall?.quote) {
      credit += (legs.shortCall.quote.bidPrice + legs.shortCall.quote.askPrice) / 2;
    }
    if (legs.longCall?.quote) {
      credit -= (legs.longCall.quote.bidPrice + legs.longCall.quote.askPrice) / 2;
    }

    return credit * 100; // Convert to dollar amount per contract
  }

  /**
   * Calculate maximum risk
   */
  private calculateMaxRisk(legs: IronCondorLegs): number {
    if (!this.validateLegs(legs)) return 0;

    const putSpread = legs.shortPut!.strikePrice - legs.longPut!.strikePrice;
    const callSpread = legs.longCall!.strikePrice - legs.shortCall!.strikePrice;
    const maxSpread = Math.max(putSpread, callSpread);
    
    return (maxSpread * 100) - this.calculateNetCredit(legs);
  }

  /**
   * Generate entry signals for all legs
   */
  private generateEntrySignals(
    legs: IronCondorLegs,
    netCredit: number,
    maxRisk: number
  ): Signal[] {
    const signals: Signal[] = [];
    this.entryNetCredit = netCredit;
    this.currentPosition = legs;

    // Long Put
    if (legs.longPut) {
      signals.push({
        action: 'buy',
        symbol: legs.longPut.symbol,
        side: 'buy',
        quantity: 1,
        orderType: 'limit',
        timeInForce: 'day',
        limitPrice: legs.longPut.quote!.askPrice,
        reason: `Iron Condor: Long Put leg at ${legs.longPut.strikePrice}`,
        confidence: 0.8,
        expectedReturn: netCredit,
        risk: { maxLoss: maxRisk, probability: 0.2 }
      });
    }

    // Short Put
    if (legs.shortPut) {
      signals.push({
        action: 'sell',
        symbol: legs.shortPut.symbol,
        side: 'sell',
        quantity: 1,
        orderType: 'limit',
        timeInForce: 'day',
        limitPrice: legs.shortPut.quote!.bidPrice,
        reason: `Iron Condor: Short Put leg at ${legs.shortPut.strikePrice}`,
        confidence: 0.8
      });
    }

    // Short Call
    if (legs.shortCall) {
      signals.push({
        action: 'sell',
        symbol: legs.shortCall.symbol,
        side: 'sell',
        quantity: 1,
        orderType: 'limit',
        timeInForce: 'day',
        limitPrice: legs.shortCall.quote!.bidPrice,
        reason: `Iron Condor: Short Call leg at ${legs.shortCall.strikePrice}`,
        confidence: 0.8
      });
    }

    // Long Call
    if (legs.longCall) {
      signals.push({
        action: 'buy',
        symbol: legs.longCall.symbol,
        side: 'buy',
        quantity: 1,
        orderType: 'limit',
        timeInForce: 'day',
        limitPrice: legs.longCall.quote!.askPrice,
        reason: `Iron Condor: Long Call leg at ${legs.longCall.strikePrice}`,
        confidence: 0.8
      });
    }

    return signals;
  }

  /**
   * Check exit conditions for existing position
   */
  private async checkExitConditions(marketData: MarketData): Promise<Signal[]> {
    if (!this.currentPosition || !this.entryNetCredit) return [];

    const signals: Signal[] = [];
    
    // Calculate current value of position
    const currentValue = await this.calculatePositionValue();
    const profit = this.entryNetCredit - currentValue;
    const profitPercentage = profit / this.entryNetCredit;

    // Exit if target profit reached
    if (profitPercentage >= this.config.targetProfitPercentage) {
      signals.push(...this.generateExitSignals('Target profit reached'));
      this.currentPosition = undefined;
      this.entryNetCredit = undefined;
    }

    // Exit if expiration is near (7 days)
    const daysToExpiry = this.calculateDaysToExpiry(
      this.currentPosition.shortPut?.expirationDate || ''
    );
    
    if (daysToExpiry <= 7) {
      signals.push(...this.generateExitSignals('Approaching expiration'));
      this.currentPosition = undefined;
      this.entryNetCredit = undefined;
    }

    return signals;
  }

  /**
   * Generate exit signals for all legs
   */
  private generateExitSignals(reason: string): Signal[] {
    if (!this.currentPosition) return [];

    const signals: Signal[] = [];

    // Close all legs
    if (this.currentPosition.longPut) {
      signals.push({
        action: 'close',
        symbol: this.currentPosition.longPut.symbol,
        side: 'sell',
        quantity: 1,
        orderType: 'market',
        timeInForce: 'day',
        reason: `Iron Condor exit: ${reason}`,
        confidence: 0.9
      });
    }

    if (this.currentPosition.shortPut) {
      signals.push({
        action: 'close',
        symbol: this.currentPosition.shortPut.symbol,
        side: 'buy',
        quantity: 1,
        orderType: 'market',
        timeInForce: 'day',
        reason: `Iron Condor exit: ${reason}`,
        confidence: 0.9
      });
    }

    if (this.currentPosition.shortCall) {
      signals.push({
        action: 'close',
        symbol: this.currentPosition.shortCall.symbol,
        side: 'buy',
        quantity: 1,
        orderType: 'market',
        timeInForce: 'day',
        reason: `Iron Condor exit: ${reason}`,
        confidence: 0.9
      });
    }

    if (this.currentPosition.longCall) {
      signals.push({
        action: 'close',
        symbol: this.currentPosition.longCall.symbol,
        side: 'sell',
        quantity: 1,
        orderType: 'market',
        timeInForce: 'day',
        reason: `Iron Condor exit: ${reason}`,
        confidence: 0.9
      });
    }

    return signals;
  }

  /**
   * Calculate current position value
   */
  private async calculatePositionValue(): Promise<number> {
    if (!this.currentPosition) return 0;

    let value = 0;

    // Get current quotes for all legs
    const legs = [
      this.currentPosition.longPut,
      this.currentPosition.shortPut,
      this.currentPosition.shortCall,
      this.currentPosition.longCall
    ].filter(leg => leg !== undefined);

    for (const leg of legs) {
      if (leg) {
        const quote = await this.marketData.getOptionQuote(leg.symbol);
        const midPrice = (quote.bidPrice + quote.askPrice) / 2;
        
        // Short positions have negative value
        const multiplier = (leg === this.currentPosition.shortPut || 
                          leg === this.currentPosition.shortCall) ? -1 : 1;
        
        value += midPrice * 100 * multiplier;
      }
    }

    return value;
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
   * Get current strategy state
   */
  getStrategyState(): any {
    return {
      name: this.name,
      hasPosition: !!this.currentPosition,
      position: this.currentPosition,
      entryCredit: this.entryNetCredit,
      config: this.config
    };
  }
}