/**
 * ULTRA Trading Platform - Watchlist Configuration
 * Trading symbols and their strategy configurations
 */

export interface WatchlistSymbol {
  symbol: string;
  name: string;
  sector: string;
  currentPrice?: number;
  strategies: StrategyConfig[];
  optionsEnabled: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface StrategyConfig {
  type: 'wheel' | 'iron_condor' | 'gamma_scalping';
  enabled: boolean;
  params: Record<string, any>;
}

/**
 * Current Alpaca Paper Trading Watchlist
 * Based on your actual watchlist: NEE, BE, GERN, PLTR, SG, NIO, MSTZ, SQQQ, OXY
 */
export const TRADING_WATCHLIST: WatchlistSymbol[] = [
  {
    symbol: 'NEE',
    name: 'NextEra Energy Inc',
    sector: 'Utilities',
    currentPrice: 71.66, // Updated from API
    optionsEnabled: true,
    riskLevel: 'low',
    strategies: [
      {
        type: 'wheel',
        enabled: true,
        params: {
          buyingPowerLimit: 0.15, // 15% of account
          strikePercentage: 0.05, // 5% below current price
          minExpiration: 15,
          maxExpiration: 45,
          targetDelta: 0.30
        }
      }
    ]
  },
  {
    symbol: 'BE',
    name: 'Bloom Energy Corp',
    sector: 'Energy',
    currentPrice: 34.33, // Updated from API
    optionsEnabled: true,
    riskLevel: 'medium',
    strategies: [
      {
        type: 'wheel',
        enabled: true,
        params: {
          buyingPowerLimit: 0.10,
          strikePercentage: 0.08,
          minExpiration: 10,
          maxExpiration: 30,
          targetDelta: 0.25
        }
      }
    ]
  },
  {
    symbol: 'GERN',
    name: 'Geron Corporation',
    sector: 'Biotechnology',
    currentPrice: 1.24, // Updated from API
    optionsEnabled: false, // Low price, limited options
    riskLevel: 'high',
    strategies: []
  },
  {
    symbol: 'PLTR',
    name: 'Palantir Technologies Inc',
    sector: 'Technology',
    currentPrice: 158.82, // Updated from API (ask price showing 0 - after hours)
    optionsEnabled: true,
    riskLevel: 'high',
    strategies: [
      {
        type: 'iron_condor',
        enabled: true,
        params: {
          strikeRange: 0.20, // 20% range
          buyingPowerLimit: 0.08,
          minExpiration: 7,
          maxExpiration: 21,
          targetProfitPercentage: 0.25
        }
      },
      {
        type: 'gamma_scalping',
        enabled: true,
        params: {
          buyingPowerLimit: 0.05,
          hedgeRatio: 0.5,
          rebalanceThreshold: 0.10
        }
      }
    ]
  },
  {
    symbol: 'SG',
    name: 'Sweetgreen Inc',
    sector: 'Consumer Services',
    currentPrice: 14.75, // Updated from API (ask price showing 0 - after hours)
    optionsEnabled: true,
    riskLevel: 'high',
    strategies: [
      {
        type: 'wheel',
        enabled: true,
        params: {
          buyingPowerLimit: 0.05,
          strikePercentage: 0.10,
          minExpiration: 7,
          maxExpiration: 21,
          targetDelta: 0.20
        }
      }
    ]
  },
  {
    symbol: 'NIO',
    name: 'NIO Inc',
    sector: 'Automotive',
    currentPrice: 4.93, // Updated from API
    optionsEnabled: true,
    riskLevel: 'high',
    strategies: [
      {
        type: 'wheel',
        enabled: true,
        params: {
          buyingPowerLimit: 0.08,
          strikePercentage: 0.12,
          minExpiration: 7,
          maxExpiration: 30,
          targetDelta: 0.25
        }
      }
    ]
  },
  {
    symbol: 'MSTZ',
    name: 'MicroStrategy 2x Strategy ETF',
    sector: 'ETF',
    currentPrice: 3.82, // Updated from API
    optionsEnabled: false, // Check if available
    riskLevel: 'high',
    strategies: []
  },
  {
    symbol: 'SQQQ',
    name: 'ProShares UltraPro Short QQQ',
    sector: 'ETF',
    currentPrice: 18.19, // Updated from API
    optionsEnabled: true,
    riskLevel: 'high',
    strategies: [
      {
        type: 'iron_condor',
        enabled: true,
        params: {
          strikeRange: 0.15,
          buyingPowerLimit: 0.03,
          minExpiration: 3,
          maxExpiration: 14,
          targetProfitPercentage: 0.30
        }
      }
    ]
  },
  {
    symbol: 'OXY',
    name: 'Occidental Petroleum Corp',
    sector: 'Energy',
    currentPrice: 44.69, // Updated from API (ask price showing 0 - after hours)
    optionsEnabled: true,
    riskLevel: 'medium',
    strategies: [
      {
        type: 'wheel',
        enabled: true,
        params: {
          buyingPowerLimit: 0.12,
          strikePercentage: 0.06,
          minExpiration: 14,
          maxExpiration: 35,
          targetDelta: 0.30
        }
      }
    ]
  }
];

/**
 * Strategy allocation limits
 */
export const STRATEGY_LIMITS = {
  maxPositionsPerStrategy: 3,
  maxTotalBuyingPowerUsed: 0.80, // 80% of account
  maxRiskPerTrade: 0.05, // 5% of account per trade
  emergencyStopLossPercentage: 0.15 // 15% portfolio loss triggers emergency stop
};

/**
 * Get enabled strategies for a symbol
 */
export function getEnabledStrategies(symbol: string): StrategyConfig[] {
  const watchlistEntry = TRADING_WATCHLIST.find(entry => entry.symbol === symbol);
  return watchlistEntry?.strategies.filter(strategy => strategy.enabled) || [];
}

/**
 * Get symbols by strategy type
 */
export function getSymbolsByStrategy(strategyType: 'wheel' | 'iron_condor' | 'gamma_scalping'): string[] {
  return TRADING_WATCHLIST
    .filter(entry => entry.strategies.some(strategy => strategy.type === strategyType && strategy.enabled))
    .map(entry => entry.symbol);
}

/**
 * Get high liquidity symbols suitable for live trading
 */
export function getHighLiquiditySymbols(): string[] {
  return TRADING_WATCHLIST
    .filter(entry => entry.optionsEnabled && entry.riskLevel !== 'high')
    .map(entry => entry.symbol);
}

/**
 * Market open preparation checklist
 */
export const MARKET_OPEN_CHECKLIST = {
  preMarket: [
    'Update current prices for all watchlist symbols',
    'Check overnight news and earnings announcements',
    'Verify account status and buying power',
    'Review open positions and pending orders',
    'Check VIX and market sentiment indicators'
  ],
  marketOpen: [
    'Monitor first 30 minutes for volatility',
    'Execute wheel strategy put sales if criteria met',
    'Monitor gamma scalping positions for rebalancing',
    'Check iron condor positions for early close opportunities',
    'Set stop losses and profit targets'
  ],
  intraday: [
    'Rebalance delta-neutral positions every 2 hours',
    'Monitor P&L and risk metrics',
    'Look for new trade opportunities',
    'Adjust position sizes based on volatility'
  ]
};