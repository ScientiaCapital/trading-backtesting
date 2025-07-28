/**
 * Real-time Update Service
 * Manages broadcasting updates to WebSocket clients
 */

import { CloudflareBindings } from '@/types';
import { CHANNELS } from '@/durable-objects/RealtimeUpdates';
import { Order } from '@/types/trading';
import { AgentType, AgentStatus } from '@/types/agents';

export interface RealtimeUpdate {
  channel: string;
  type: string;
  data: any;
  timestamp?: string;
}

export class RealtimeService {
  private env: CloudflareBindings;
  private realtimeStub?: DurableObjectStub;

  constructor(env: CloudflareBindings) {
    this.env = env;
  }

  /**
   * Initialize the service
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.realtimeStub) {
      const id = this.env.REALTIME_UPDATES.idFromName('global');
      this.realtimeStub = this.env.REALTIME_UPDATES.get(id);
    }
  }

  /**
   * Broadcast an update to a specific channel
   */
  async broadcast(update: RealtimeUpdate): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.realtimeStub) {
      console.error('Failed to initialize RealtimeUpdates stub');
      return;
    }

    try {
      const response = await this.realtimeStub.fetch(
        new Request('https://realtime/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: update.channel,
            type: update.type,
            data: update.data,
            timestamp: update.timestamp || new Date().toISOString()
          })
        })
      );

      if (!response.ok) {
        console.error('Failed to broadcast update:', await response.text());
      }
    } catch (error) {
      console.error('Error broadcasting update:', error);
    }
  }

  /**
   * Broadcast order update
   */
  async broadcastOrderUpdate(order: Order, eventType: 'created' | 'filled' | 'cancelled' | 'updated'): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.ORDERS,
      type: `order.${eventType}`,
      data: {
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        qty: order.quantity,
        type: order.orderType,
        status: order.status,
        filled_qty: order.filledQuantity,
        filled_avg_price: order.avgFillPrice
      }
    });
  }

  /**
   * Broadcast position update
   */
  async broadcastPositionUpdate(position: any, eventType: 'opened' | 'closed' | 'updated'): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.POSITIONS,
      type: `position.${eventType}`,
      data: {
        symbol: position.symbol,
        qty: position.qty,
        side: position.side,
        market_value: position.market_value,
        cost_basis: position.cost_basis,
        unrealized_pl: position.unrealized_pl,
        unrealized_plpc: position.unrealized_plpc
      }
    });
  }

  /**
   * Broadcast agent status update
   */
  async broadcastAgentStatus(agentType: AgentType, status: AgentStatus, details?: any): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.AGENT_STATUS,
      type: 'agent.status',
      data: {
        agent: agentType,
        status,
        details,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Broadcast agent decision
   */
  async broadcastAgentDecision(agentType: AgentType, decision: any): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.AGENT_DECISIONS,
      type: 'agent.decision',
      data: {
        agent: agentType,
        decision,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Broadcast agent analysis
   */
  async broadcastAgentAnalysis(agentType: AgentType, analysis: any): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.AGENT_ANALYSIS,
      type: 'agent.analysis',
      data: {
        agent: agentType,
        analysis,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Broadcast performance update
   */
  async broadcastPerformanceUpdate(performance: any): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.PERFORMANCE,
      type: 'performance.update',
      data: performance
    });
  }

  /**
   * Broadcast daily P&L update
   */
  async broadcastDailyPnL(pnl: number, targetProgress: number): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.DAILY_PNL,
      type: 'pnl.daily',
      data: {
        value: pnl,
        target: 300,
        progress: targetProgress,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Broadcast alert
   */
  async broadcastAlert(severity: 'info' | 'warning' | 'error' | 'critical', message: string, details?: any): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.ALERTS,
      type: `alert.${severity}`,
      data: {
        message,
        details,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Broadcast system status
   */
  async broadcastSystemStatus(status: 'online' | 'degraded' | 'offline', details?: any): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.SYSTEM_STATUS,
      type: 'system.status',
      data: {
        status,
        details,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Broadcast error
   */
  async broadcastError(error: Error, context?: string): Promise<void> {
    await this.broadcast({
      channel: CHANNELS.ERRORS,
      type: 'error.occurred',
      data: {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<any> {
    await this.ensureInitialized();
    
    if (!this.realtimeStub) {
      return { error: 'Not initialized' };
    }

    try {
      const response = await this.realtimeStub.fetch(
        new Request('https://realtime/status', {
          method: 'GET'
        })
      );

      if (response.ok) {
        return await response.json();
      }
      
      return { error: 'Failed to get status' };
    } catch (error) {
      return { error: error.message };
    }
  }
}