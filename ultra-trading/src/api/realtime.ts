/**
 * Real-time API Routes
 * Manages WebSocket connections and real-time updates
 */

import { Hono } from 'hono';
import type { ApiContext } from '@/types';
import { RealtimeService } from '@/services/RealtimeService';

const app = new Hono<ApiContext>();

/**
 * Get real-time connection status
 */
app.get('/status', async (c) => {
  try {
    const realtimeService = new RealtimeService(c.env);
    const status = await realtimeService.getStatus();
    
    return c.json({
      success: true,
      data: status,
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'REALTIME_STATUS_ERROR',
        message: 'Failed to get real-time status',
        details: { error: error.message }
      }
    }, 500);
  }
});

/**
 * Broadcast a custom message (admin only)
 */
app.post('/broadcast', async (c) => {
  try {
    const body = await c.req.json();
    const { channel, type, data } = body;
    
    if (!channel || !type || !data) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: channel, type, data'
        }
      }, 400);
    }
    
    const realtimeService = new RealtimeService(c.env);
    await realtimeService.broadcast({
      channel,
      type,
      data,
      timestamp: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      data: {
        message: 'Broadcast sent successfully',
        channel,
        type
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'BROADCAST_ERROR',
        message: 'Failed to broadcast message',
        details: { error: error.message }
      }
    }, 500);
  }
});

/**
 * Get available channels
 */
app.get('/channels', async (c) => c.json({
    success: true,
    data: {
      channels: [
        {
          name: 'orders',
          description: 'Order updates (created, filled, cancelled)',
          types: ['order.created', 'order.filled', 'order.cancelled', 'order.updated']
        },
        {
          name: 'positions',
          description: 'Position updates (opened, closed, updated)',
          types: ['position.opened', 'position.closed', 'position.updated']
        },
        {
          name: 'agent_status',
          description: 'AI agent status updates',
          types: ['agent.status']
        },
        {
          name: 'agent_decisions',
          description: 'AI agent trading decisions',
          types: ['agent.decision']
        },
        {
          name: 'agent_analysis',
          description: 'AI agent market analysis',
          types: ['agent.analysis']
        },
        {
          name: 'performance',
          description: 'Performance metrics updates',
          types: ['performance.update']
        },
        {
          name: 'daily_pnl',
          description: 'Daily P&L updates',
          types: ['pnl.daily']
        },
        {
          name: 'alerts',
          description: 'System alerts and notifications',
          types: ['alert.info', 'alert.warning', 'alert.error', 'alert.critical']
        },
        {
          name: 'system_status',
          description: 'System status updates',
          types: ['system.status']
        },
        {
          name: 'errors',
          description: 'Error notifications',
          types: ['error.occurred']
        }
      ]
    }
  }));

/**
 * Send test notification
 */
app.post('/test', async (c) => {
  try {
    const realtimeService = new RealtimeService(c.env);
    
    // Send test notifications to different channels
    await realtimeService.broadcastAlert('info', 'This is a test notification', {
      source: 'API test endpoint',
      timestamp: new Date().toISOString()
    });
    
    await realtimeService.broadcastPerformanceUpdate({
      dailyPnL: 150.50,
      dailyTarget: 300,
      targetProgress: 50.17,
      totalTrades: 5,
      winningTrades: 3,
      losingTrades: 2,
      currentDrawdown: 0,
      shouldStop: false
    });
    
    await realtimeService.broadcastSystemStatus('online', {
      message: 'Test broadcast from API',
      test: true
    });
    
    return c.json({
      success: true,
      data: {
        message: 'Test notifications sent to multiple channels'
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'Failed to send test notifications',
        details: { error: error.message }
      }
    }, 500);
  }
});

export default app;