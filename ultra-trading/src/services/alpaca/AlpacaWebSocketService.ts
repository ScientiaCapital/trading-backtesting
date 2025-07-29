/**
 * ULTRA Trading Platform - Alpaca WebSocket Service
 * Real-time streaming data via WebSocket connections
 */

import type { CloudflareBindings } from '../../types';
import { AlpacaClient } from './AlpacaClient';
import { AppError, sleep } from '../../utils';

/**
 * WebSocket Connection State
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error'
}

/**
 * Stream Types
 */
export type StreamType = 'trades' | 'quotes' | 'bars' | 'dailyBars' | 'statuses' | 'lulds';

/**
 * WebSocket Message Types
 */
export interface AlpacaWebSocketMessage {
  T: string; // Message type
  msg?: string; // Message content
  code?: number; // Response code
  trades?: unknown[]; // Trade data
  quotes?: unknown[]; // Quote data
  bars?: unknown[]; // Bar data
  dailyBars?: unknown[]; // Daily bar data
  statuses?: unknown[]; // Status updates
  lulds?: unknown[]; // Limit up/limit down messages
}

/**
 * Subscription Request
 */
export interface SubscriptionRequest extends Record<string, unknown> {
  trades?: string[];
  quotes?: string[];
  bars?: string[];
  dailyBars?: string[];
  statuses?: string[];
  lulds?: string[];
}

/**
 * WebSocket Event Handlers
 */
interface TradeData {
  symbol: string;
  price: number;
  size: number;
  timestamp: string;
  [key: string]: unknown;
}

interface QuoteData {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  timestamp: string;
  [key: string]: unknown;
}

interface BarData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
  [key: string]: unknown;
}

interface StatusData {
  symbol: string;
  status: string;
  timestamp: string;
  [key: string]: unknown;
}

interface LuldData {
  symbol: string;
  limitUpPrice: number;
  limitDownPrice: number;
  timestamp: string;
  [key: string]: unknown;
}

export interface WebSocketHandlers {
  onTrade?: (trade: TradeData) => void;
  onQuote?: (quote: QuoteData) => void;
  onBar?: (bar: BarData) => void;
  onDailyBar?: (dailyBar: BarData) => void;
  onStatus?: (status: StatusData) => void;
  onLuld?: (luld: LuldData) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onAuthenticated?: () => void;
}

/**
 * Alpaca WebSocket Service
 */
export class AlpacaWebSocketService {
  private client: AlpacaClient;
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private handlers: WebSocketHandlers = {};
  private subscriptions: SubscriptionRequest = {};
  private pingInterval: number | null = null;
  private readonly logger;
  private readonly env: CloudflareBindings;

  constructor(
    env: CloudflareBindings,
    private readonly requestId: string
  ) {
    this.env = env;
    this.client = new AlpacaClient(env, requestId);
    
    // Create logger
    this.logger = {
      debug: (message: string, meta?: Record<string, unknown>) => 
        console.log(JSON.stringify({ level: 'debug', message, requestId: this.requestId, ...meta })),
      info: (message: string, meta?: Record<string, unknown>) => 
        console.log(JSON.stringify({ level: 'info', message, requestId: this.requestId, ...meta })),
      warn: (message: string, meta?: Record<string, unknown>) => 
        console.log(JSON.stringify({ level: 'warn', message, requestId: this.requestId, ...meta })),
      error: (message: string, meta?: Record<string, unknown>) => 
        console.log(JSON.stringify({ level: 'error', message, requestId: this.requestId, ...meta }))
    };
  }

  /**
   * Connect to WebSocket
   */
  async connect(handlers: WebSocketHandlers = {}): Promise<void> {
    if (this.state !== ConnectionState.DISCONNECTED) {
      this.logger.warn('WebSocket already connected or connecting');
      return;
    }

    this.handlers = handlers;
    this.state = ConnectionState.CONNECTING;
    
    try {
      const config = this.client.getConfig();
      const wsUrl = `${config.streamUrl}/stocks`;
      
      this.logger.info('Connecting to Alpaca WebSocket', { url: wsUrl });
      
      // Note: In Cloudflare Workers, WebSocket client is not directly available
      // This is a placeholder implementation. In production, you would:
      // 1. Use a Durable Object for WebSocket connections
      // 2. Or proxy WebSocket through a separate service
      // 3. Or use Server-Sent Events (SSE) as an alternative
      
      // For now, we'll throw an error indicating WebSocket needs special handling
      throw new AppError(
        'WEBSOCKET_NOT_SUPPORTED',
        'WebSocket connections require Durable Objects in Cloudflare Workers',
        501,
        {
          suggestion: 'Implement WebSocket handling via Durable Objects or use polling/SSE instead'
        }
      );
      
    } catch (error) {
      this.state = ConnectionState.ERROR;
      this.logger.error('Failed to connect to WebSocket', {
        error: (error as Error).message
      });
      
      if (this.handlers.onError) {
        this.handlers.onError(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    if (this.state === ConnectionState.DISCONNECTED) {
      return;
    }

    this.logger.info('Disconnecting from WebSocket');
    this.state = ConnectionState.DISCONNECTING;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = ConnectionState.DISCONNECTED;

    if (this.handlers.onDisconnect) {
      this.handlers.onDisconnect();
    }
  }

  /**
   * Subscribe to streams
   */
  async subscribe(request: SubscriptionRequest): Promise<void> {
    if (this.state !== ConnectionState.AUTHENTICATED) {
      throw new AppError(
        'WEBSOCKET_ERROR',
        'WebSocket not authenticated',
        400
      );
    }

    this.logger.info('Subscribing to streams', request);
    
    // Store subscriptions for reconnection
    this.subscriptions = {
      ...this.subscriptions,
      ...request
    };

    // Send subscription message
    this.sendMessage({
      action: 'subscribe',
      ...request
    } as Record<string, unknown>);
  }

  /**
   * Unsubscribe from streams
   */
  async unsubscribe(request: SubscriptionRequest): Promise<void> {
    if (this.state !== ConnectionState.AUTHENTICATED) {
      throw new AppError(
        'WEBSOCKET_ERROR',
        'WebSocket not authenticated',
        400
      );
    }

    this.logger.info('Unsubscribing from streams', request);

    // Update stored subscriptions
    if (request.trades) {
      this.subscriptions.trades = this.subscriptions.trades?.filter(
        s => request.trades && !request.trades.includes(s)
      ) || [];
    }
    if (request.quotes) {
      this.subscriptions.quotes = this.subscriptions.quotes?.filter(
        s => request.quotes && !request.quotes.includes(s)
      ) || [];
    }
    if (request.bars) {
      this.subscriptions.bars = this.subscriptions.bars?.filter(
        s => request.bars && !request.bars.includes(s)
      ) || [];
    }

    // Send unsubscribe message
    this.sendMessage({
      action: 'unsubscribe',
      ...request
    } as Record<string, unknown>);
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(message: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new AppError(
        'WEBSOCKET_ERROR',
        'WebSocket not connected',
        400
      );
    }

    const messageStr = JSON.stringify(message);
    this.logger.debug('Sending WebSocket message', { message: messageStr });
    this.ws.send(messageStr);
  }












  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.AUTHENTICATED;
  }

  /**
   * Alternative: Poll for real-time data (for Cloudflare Workers)
   * This is a workaround for WebSocket limitations in Workers
   */
  async startPolling(
    symbols: string[],
    interval: number = 1000,
    handlers: {
      onData?: (data: any) => void;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<() => void> {
    let isPolling = true;
    
    const poll = async () => {
      while (isPolling) {
        try {
          // Fetch latest data
          const marketData = new (await import('./AlpacaMarketData')).AlpacaMarketData(
            this.env,
            this.requestId
          );
          
          const snapshots = await marketData.getSnapshots(symbols);
          
          if (handlers.onData) {
            handlers.onData(snapshots);
          }
        } catch (error) {
          this.logger.error('Polling error', {
            error: (error as Error).message
          });
          
          if (handlers.onError) {
            handlers.onError(error as Error);
          }
        }
        
        await sleep(interval);
      }
    };
    
    // Start polling in background
    poll().catch(error => {
      this.logger.error('Polling failed', {
        error: (error as Error).message
      });
    });
    
    // Return stop function
    return () => {
      isPolling = false;
    };
  }
}