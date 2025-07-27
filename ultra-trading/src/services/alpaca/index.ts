/**
 * ULTRA Trading Platform - Alpaca Services
 * Export all Alpaca service modules
 */

export { AlpacaClient } from './AlpacaClient';
export type { 
  AlpacaConfig, 
  AlpacaRequestOptions, 
  AlpacaResponse, 
  RateLimitInfo 
} from './AlpacaClient';

export { AlpacaMarketData } from './AlpacaMarketData';
export type {
  AlpacaBar,
  AlpacaTrade,
  AlpacaQuote,
  AlpacaSnapshot,
  MarketDataOptions,
  PaginatedResponse
} from './AlpacaMarketData';

export { AlpacaTradingService } from './AlpacaTradingService';
export type {
  AlpacaAccount,
  AlpacaPosition,
  AlpacaOrder,
  OrderRequest,
  PortfolioSummary
} from './AlpacaTradingService';

export { AlpacaWebSocketService, ConnectionState } from './AlpacaWebSocketService';
export type {
  StreamType,
  AlpacaWebSocketMessage,
  SubscriptionRequest,
  WebSocketHandlers
} from './AlpacaWebSocketService';

/**
 * Create all Alpaca services with shared configuration
 */
export const createAlpacaServices = async (env: any, requestId: string) => {
  const { AlpacaClient } = await import('./AlpacaClient');
  const { AlpacaMarketData } = await import('./AlpacaMarketData');
  const { AlpacaTradingService } = await import('./AlpacaTradingService');
  const { AlpacaWebSocketService } = await import('./AlpacaWebSocketService');
  
  return {
    client: new AlpacaClient(env, requestId),
    marketData: new AlpacaMarketData(env, requestId),
    trading: new AlpacaTradingService(env, requestId),
    webSocket: new AlpacaWebSocketService(env, requestId)
  };
};