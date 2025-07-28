/**
 * Real-time Updates Durable Object
 * Manages WebSocket connections for real-time trading updates
 */

import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';

interface Client {
  id: string;
  websocket: WebSocket;
  subscribedChannels: Set<string>;
  connectedAt: number;
}

interface UpdateMessage {
  type: 'subscribe' | 'unsubscribe' | 'broadcast';
  channel?: string;
  data?: any;
}

interface BroadcastMessage {
  channel: string;
  type: string;
  data: any;
  timestamp: string;
}

export class RealtimeUpdates {
  private state: DurableObjectState;
  // private storage: DurableObjectStorage;
  private clients: Map<string, Client> = new Map();
  private channels: Map<string, Set<string>> = new Map(); // channel -> client IDs
  
  constructor(state: DurableObjectState) {
    this.state = state;
    // this.storage = state.storage;
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }
    
    // Handle REST API endpoints
    switch (url.pathname) {
      case '/broadcast':
        return this.handleBroadcast(request);
        
      case '/status':
        return this.getStatus();
        
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Handle WebSocket upgrade request
   */
  private handleWebSocketUpgrade(_request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    if (!server) {
      throw new Error('Failed to create WebSocket server');
    }
    
    // Accept the WebSocket connection
    this.state.acceptWebSocket(server);
    
    // Generate unique client ID
    const clientId = crypto.randomUUID();
    
    // Store client information
    const clientInfo: Client = {
      id: clientId,
      websocket: server as any, // Type cast for Cloudflare Workers WebSocket
      subscribedChannels: new Set(),
      connectedAt: Date.now()
    };
    
    this.clients.set(clientId, clientInfo);
    
    // Set up event handlers
    server.addEventListener('message', (event) => {
      this.handleClientMessage(clientId, event.data as string);
    });
    
    server.addEventListener('close', () => {
      this.handleClientDisconnect(clientId);
    });
    
    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleClientDisconnect(clientId);
    });
    
    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    }));
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Handle messages from WebSocket clients
   */
  private async handleClientMessage(clientId: string, data: string): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;
      
      const message = JSON.parse(data) as UpdateMessage;
      
      switch (message.type) {
        case 'subscribe':
          if (message.channel) {
            await this.subscribeToChannel(clientId, message.channel);
          }
          break;
          
        case 'unsubscribe':
          if (message.channel) {
            await this.unsubscribeFromChannel(clientId, message.channel);
          }
          break;
          
        case 'broadcast':
          // Only allow broadcast from authorized sources
          // In production, add authentication check here
          if (message.channel && message.data) {
            await this.broadcastToChannel(message.channel, message.data);
          }
          break;
          
        default:
          client.websocket.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type'
          }));
      }
    } catch (error) {
      console.error('Error handling client message:', error);
      
      const client = this.clients.get(clientId);
      if (client) {
        client.websocket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    }
  }

  /**
   * Subscribe client to a channel
   */
  private async subscribeToChannel(clientId: string, channel: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Add to client's subscriptions
    client.subscribedChannels.add(channel);
    
    // Add to channel's subscribers
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(clientId);
    
    // Confirm subscription
    client.websocket.send(JSON.stringify({
      type: 'subscribed',
      channel,
      timestamp: new Date().toISOString()
    }));
    
    console.log(`Client ${clientId} subscribed to channel: ${channel}`);
  }

  /**
   * Unsubscribe client from a channel
   */
  private async unsubscribeFromChannel(clientId: string, channel: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Remove from client's subscriptions
    client.subscribedChannels.delete(channel);
    
    // Remove from channel's subscribers
    const subscribers = this.channels.get(channel);
    if (subscribers) {
      subscribers.delete(clientId);
      
      // Clean up empty channels
      if (subscribers.size === 0) {
        this.channels.delete(channel);
      }
    }
    
    // Confirm unsubscription
    client.websocket.send(JSON.stringify({
      type: 'unsubscribed',
      channel,
      timestamp: new Date().toISOString()
    }));
    
    console.log(`Client ${clientId} unsubscribed from channel: ${channel}`);
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Remove from all channels
    for (const channel of client.subscribedChannels) {
      const subscribers = this.channels.get(channel);
      if (subscribers) {
        subscribers.delete(clientId);
        
        // Clean up empty channels
        if (subscribers.size === 0) {
          this.channels.delete(channel);
        }
      }
    }
    
    // Remove client
    this.clients.delete(clientId);
    
    console.log(`Client ${clientId} disconnected`);
  }

  /**
   * Handle broadcast request via REST API
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const message = await request.json() as BroadcastMessage;
      
      await this.broadcastToChannel(message.channel, {
        type: message.type,
        data: message.data,
        timestamp: message.timestamp || new Date().toISOString()
      });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid broadcast message' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Broadcast message to all subscribers of a channel
   */
  private async broadcastToChannel(channel: string, data: any): Promise<void> {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) {
      console.log(`No subscribers for channel: ${channel}`);
      return;
    }
    
    const message = JSON.stringify({
      channel,
      ...data
    });
    
    // Send to all subscribers
    const disconnectedClients: string[] = [];
    
    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (!client) {
        disconnectedClients.push(clientId);
        continue;
      }
      
      try {
        client.websocket.send(message);
      } catch (error) {
        console.error(`Failed to send to client ${clientId}:`, error);
        disconnectedClients.push(clientId);
      }
    }
    
    // Clean up disconnected clients
    for (const clientId of disconnectedClients) {
      this.handleClientDisconnect(clientId);
    }
    
    console.log(`Broadcast to ${channel}: ${subscribers.size - disconnectedClients.length} clients`);
  }

  /**
   * Get status of real-time connections
   */
  private async getStatus(): Promise<Response> {
    const status = {
      totalClients: this.clients.size,
      channels: Array.from(this.channels.entries()).map(([channel, subscribers]) => ({
        channel,
        subscribers: subscribers.size
      })),
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        subscribedChannels: Array.from(client.subscribedChannels),
        connectedAt: new Date(client.connectedAt).toISOString()
      }))
    };
    
    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Broadcast channels for different update types
 */
export const CHANNELS = {
  // Trading updates
  ORDERS: 'orders',
  POSITIONS: 'positions',
  EXECUTIONS: 'executions',
  
  // Market data
  QUOTES: 'quotes',
  TRADES: 'trades',
  BARS: 'bars',
  
  // Agent updates
  AGENT_STATUS: 'agent_status',
  AGENT_DECISIONS: 'agent_decisions',
  AGENT_ANALYSIS: 'agent_analysis',
  
  // Performance updates
  PERFORMANCE: 'performance',
  DAILY_PNL: 'daily_pnl',
  ALERTS: 'alerts',
  
  // System updates
  SYSTEM_STATUS: 'system_status',
  ERRORS: 'errors'
};