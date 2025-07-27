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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
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
    this.reconnectAttempts = 0;

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
   * Handle WebSocket message
   * @internal Currently unused - WebSocket implementation requires Durable Objects
   */
  private _handleMessage(data: string): void {
    try {
      const messages = data.split('\n').filter(m => m.trim());
      
      for (const messageStr of messages) {
        const message = JSON.parse(messageStr) as AlpacaWebSocketMessage;
        
        switch (message.T) {
          case 'success':
            this.handleAuthSuccess(message);
            break;
          case 'error':
            this.handleError(message);
            break;
          case 't':
            this.handleTrades(message.trades || []);
            break;
          case 'q':
            this.handleQuotes(message.quotes || []);
            break;
          case 'b':
            this.handleBars(message.bars || []);
            break;
          case 'd':
            this.handleDailyBars(message.dailyBars || []);
            break;
          case 's':
            this.handleStatuses(message.statuses || []);
            break;
          case 'l':
            this.handleLulds(message.lulds || []);
            break;
          default:
            this.logger.debug('Unknown message type', { type: message.T });
        }
      }
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', {
        error: (error as Error).message,
        data
      });
    }
  }

  /**
   * Handle authentication success
   */
  private handleAuthSuccess(_message: AlpacaWebSocketMessage): void {
    this.logger.info('WebSocket authenticated successfully');
    this.state = ConnectionState.AUTHENTICATED;
    this.reconnectAttempts = 0;

    if (this.handlers.onAuthenticated) {
      this.handlers.onAuthenticated();
    }

    // Re-subscribe to previous subscriptions
    if (Object.keys(this.subscriptions).length > 0) {
      this.subscribe(this.subscriptions).catch(error => {
        this.logger.error('Failed to re-subscribe', {
          error: (error as Error).message
        });
      });
    }

    // Start ping interval
    this.startPingInterval();
  }

  /**
   * Handle error message
   */
  private handleError(message: AlpacaWebSocketMessage): void {
    const error = new AppError(
      'WEBSOCKET_ERROR',
      message.msg || 'Unknown WebSocket error',
      500,
      { code: message.code }
    );

    this.logger.error('WebSocket error received', {
      message: message.msg,
      code: message.code
    });

    if (this.handlers.onError) {
      this.handlers.onError(error);
    }
  }

  /**
   * Handle trade messages
   */
  private handleTrades(trades: unknown[]): void {
    if (!this.handlers.onTrade) return;
    
    for (const trade of trades) {
      this.handlers.onTrade(trade as TradeData);
    }
  }

  /**
   * Handle quote messages
   */
  private handleQuotes(quotes: unknown[]): void {
    if (!this.handlers.onQuote) return;
    
    for (const quote of quotes) {
      this.handlers.onQuote(quote as QuoteData);
    }
  }

  /**
   * Handle bar messages
   */
  private handleBars(bars: unknown[]): void {
    if (!this.handlers.onBar) return;
    
    for (const bar of bars) {
      this.handlers.onBar(bar as BarData);
    }
  }

  /**
   * Handle daily bar messages
   */
  private handleDailyBars(dailyBars: any[]): void {
    if (!this.handlers.onDailyBar) return;
    
    for (const dailyBar of dailyBars) {
      this.handlers.onDailyBar(dailyBar);
    }
  }

  /**
   * Handle status messages
   */
  private handleStatuses(statuses: unknown[]): void {
    if (!this.handlers.onStatus) return;
    
    for (const status of statuses) {
      this.handlers.onStatus(status as StatusData);
    }
  }

  /**
   * Handle LULD messages
   */
  private handleLulds(lulds: unknown[]): void {
    if (!this.handlers.onLuld) return;
    
    for (const luld of lulds) {
      this.handlers.onLuld(luld as LuldData);
    }
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
    }

    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ action: 'ping' });
      }
    }, 30000) as unknown as number;
  }

  /**
   * Handle reconnection
   */
  private async _handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.state = ConnectionState.ERROR;
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    this.logger.info('Attempting to reconnect', {
      attempt: this.reconnectAttempts,
      delay
    });

    await sleep(delay);

    try {
      await this.connect(this.handlers);
    } catch (error) {
      this.logger.error('Reconnection failed', {
        error: (error as Error).message
      });
      await this._handleReconnect();
    }
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