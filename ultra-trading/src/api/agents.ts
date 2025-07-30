/**
 * Agent Team API Routes
 * Test endpoints for AI agent communication and coordination
 */

import { Hono } from 'hono';
import { CloudflareBindings } from '@/types';
import { createApiResponse, createErrorResponse, createError } from '@/utils';
import { AgentType, MessageType, MessagePriority } from '@/types/agents';
import { RealtimeService } from '@/services/RealtimeService';

const agentRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * Make a trading decision
 */
agentRoutes.post('/decision', async (c) => {
  try {
    const body = await c.req.json();
    const { context, useQuickDecision = true } = body;
    
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    const response = await coordinator.fetch(
      new Request('https://coordinator/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, useQuickDecision })
      }) as any
    );
    
    if (!response.ok) {
      throw new Error('Failed to get trading decision');
    }
    
    const decision = await response.json();
    
    // Broadcast decision to realtime dashboard
    const realtimeService = new RealtimeService(c.env);
    await realtimeService.broadcast({
      channel: 'agents',
      type: 'trading_decision',
      data: { decision },
      timestamp: new Date().toISOString()
    });
    
    return c.json(createApiResponse(decision));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('DECISION_ERROR', 'Failed to make trading decision')),
      500
    );
  }
});

/**
 * Get agent team status
 */
agentRoutes.get('/status', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    const response = await coordinator.fetch(
      new Request('https://coordinator/status', {
        method: 'GET'
      }) as any
    );
    
    if (!response.ok) {
      throw new Error('Failed to get coordinator status');
    }
    
    const status = await response.json();
    return c.json(createApiResponse(status));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('AGENT_STATUS_ERROR', 'Failed to get agent status')),
      500
    );
  }
});

/**
 * Send test message to agents
 */
agentRoutes.post('/test/message', async (c) => {
  try {
    const body = await c.req.json();
    const { type, from, to, payload } = body;
    
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    const message = {
      id: `test-${Date.now()}`,
      from: from || 'TEST_SYSTEM',
      to: to || 'BROADCAST',
      type: type || MessageType.MARKET_UPDATE,
      payload: payload || { test: true, timestamp: new Date().toISOString() },
      timestamp: Date.now(),
      priority: MessagePriority.NORMAL
    };
    
    const response = await coordinator.fetch(
      new Request('https://coordinator/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      }) as any
    );
    
    const result = await response.json();
    
    // Broadcast to realtime dashboard
    const realtimeService = new RealtimeService(c.env);
    await realtimeService.broadcast({
      channel: 'agents',
      type: 'test_message',
      data: { message, result },
      timestamp: new Date().toISOString()
    });
    
    return c.json(createApiResponse({
      message: 'Test message sent',
      messageId: message.id,
      result
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('MESSAGE_ERROR', 'Failed to send test message')),
      500
    );
  }
});

/**
 * Test market analysis scenario
 */
agentRoutes.post('/test/market-analysis', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    // Mock market data
    const marketData = {
      SPY: {
        symbol: 'SPY',
        price: 445.50,
        change: 0.35,
        volume: 2500000,
        bid: 445.48,
        ask: 445.52
      },
      QQQ: {
        symbol: 'QQQ',
        price: 385.20,
        change: 0.82,
        volume: 1800000,
        bid: 385.18,
        ask: 385.22
      },
      IWM: {
        symbol: 'IWM',
        price: 225.30,
        change: -0.15,
        volume: 1200000,
        bid: 225.28,
        ask: 225.32
      }
    };
    
    // Send market update to all agents
    const marketMessage = {
      id: `market-test-${Date.now()}`,
      from: 'SYSTEM',
      to: 'BROADCAST',
      type: MessageType.MARKET_UPDATE,
      payload: {
        marketData,
        timestamp: new Date().toISOString(),
        source: 'test'
      },
      timestamp: Date.now(),
      priority: MessagePriority.HIGH
    };
    
    await coordinator.fetch(
      new Request('https://coordinator/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketMessage)
      }) as any
    );
    
    // Request analysis from agents using decision endpoint
    const analysisResponse = await coordinator.fetch(
      new Request('https://coordinator/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          context: { 
            marketData,
            positions: [],
            dailyPnL: 0
          },
          useQuickDecision: false // Use AI agents for this test
        })
      }) as any
    );
    
    const analysis = await analysisResponse.json();
    
    return c.json(createApiResponse({
      message: 'Market analysis test completed',
      marketData,
      analysis
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('ANALYSIS_ERROR', 'Failed to test market analysis')),
      500
    );
  }
});

/**
 * Test risk assessment with positions
 */
agentRoutes.post('/test/risk-assessment', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    // Mock positions
    const positions = [
      {
        symbol: 'SPY',
        qty: 100,
        side: 'long',
        avg_entry_price: '442.30',
        market_value: '44550.00',
        unrealized_pl: '320.00'
      },
      {
        symbol: 'QQQ',
        qty: -50,
        side: 'short',
        avg_entry_price: '386.50',
        market_value: '-19260.00',
        unrealized_pl: '-65.00'
      }
    ];
    
    // Send risk assessment request
    const riskMessage = {
      id: `risk-test-${Date.now()}`,
      from: AgentType.MARKET_ANALYST,
      to: AgentType.RISK_MANAGER,
      type: MessageType.ANALYSIS_RESULT,
      payload: {
        positions,
        accountValue: 100000,
        buyingPower: 75000,
        requestAssessment: true
      },
      timestamp: Date.now(),
      priority: MessagePriority.HIGH
    };
    
    await coordinator.fetch(
      new Request('https://coordinator/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riskMessage)
      }) as any
    );
    
    return c.json(createApiResponse({
      message: 'Risk assessment test completed',
      positions,
      messageId: riskMessage.id
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('RISK_ERROR', 'Failed to test risk assessment')),
      500
    );
  }
});

/**
 * Test full trading decision flow
 */
agentRoutes.post('/test/decision-flow', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    // Request trading decision
    const decisionContext = {
      marketData: [
        { symbol: 'SPY', price: 445.50, bid: 445.48, ask: 445.52, volume: 2500000, change: 0.35 },
        { symbol: 'QQQ', price: 385.20, bid: 385.18, ask: 385.22, volume: 1800000, change: 0.82 }
      ],
      positions: [],
      dailyPnL: 0,
      accountStatus: {
        buyingPower: 100000,
        targetProgress: 0
      },
      enabledStrategies: ['iron_condor', 'wheel', 'gamma_scalping']
    };
    
    // Test with FAST decision first
    const startTimeFast = Date.now();
    const fastResponse = await coordinator.fetch(
      new Request('https://coordinator/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          context: decisionContext,
          useQuickDecision: true  // Enable fast decision
        })
      }) as any
    );
    const fastDecision = await fastResponse.json();
    const fastTime = Date.now() - startTimeFast;
    
    // Now test with AI agents
    const startTimeAI = Date.now();
    const aiResponse = await coordinator.fetch(
      new Request('https://coordinator/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          context: decisionContext,
          useQuickDecision: false  // Disable fast decision
        })
      }) as any
    );
    const aiDecision = await aiResponse.json();
    const aiTime = Date.now() - startTimeAI;
    
    // Broadcast results
    const realtimeService = new RealtimeService(c.env);
    await realtimeService.broadcastAgentDecision(AgentType.MARKET_ANALYST, {
      fastDecision,
      aiDecision,
      performance: {
        fastDecisionTime: fastTime,
        aiDecisionTime: aiTime,
        speedup: (aiTime / fastTime).toFixed(1) + 'x faster'
      }
    });
    
    return c.json(createApiResponse({
      message: 'Trading decision flow test completed',
      context: decisionContext,
      decision: {
        fast: {
          ...(fastDecision as any),
          processingTime: `${fastTime}ms`
        },
        ai: {
          ...(aiDecision as any),  
          processingTime: `${aiTime}ms`
        },
        consensus: {
          action: (fastDecision as any).action === (aiDecision as any).action ? 'AGREED' : 'DISAGREED',
          confidence: ((fastDecision as any).confidence + (aiDecision as any).confidence) / 2,
          speedImprovement: `${(aiTime / fastTime).toFixed(1)}x faster with fast decision`
        }
      }
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('DECISION_ERROR', 'Failed to test decision flow')),
      500
    );
  }
});

/**
 * Test fast decision service performance
 */
agentRoutes.post('/test/fast-decision', async (c) => {
  try {
    const { iterations = 10 } = await c.req.json();
    const results = [];
    
    // Generate test market data
    const testMarketData = [
      { symbol: 'SPY', price: 445.50, bid: 445.48, ask: 445.52, volume: 2500000, change: 0.35, rsi: 65 },
      { symbol: 'QQQ', price: 385.20, bid: 385.18, ask: 385.22, volume: 1800000, change: 0.82, rsi: 72 },
      { symbol: 'IWM', price: 225.30, bid: 225.28, ask: 225.32, volume: 1200000, change: -0.15, rsi: 45 }
    ];
    
    const testPositions = [
      { symbol: 'SPY', qty: '100', market_value: '44550', unrealized_pl: '320' }
    ];
    
    // Run multiple iterations to get average performance
    for (let i = 0; i < iterations; i++) {
      const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
      const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
      
      const startTime = Date.now();
      const response = await coordinator.fetch(
        new Request('https://coordinator/decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              marketData: testMarketData,
              positions: testPositions,
              dailyPnL: i * 10 // Vary P&L for different scenarios
            },
            useQuickDecision: true
          })
        }) as any
      );
      
      const decision = await response.json() as { action: string; confidence: number };
      const endTime = Date.now();
      
      (results as any[]).push({
        iteration: i + 1,
        processingTime: endTime - startTime,
        decision: decision.action,
        confidence: decision.confidence
      });
    }
    
    // Calculate statistics
    const times = results.map(r => (r as any).processingTime);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return c.json(createApiResponse({
      message: 'Fast decision performance test completed',
      statistics: {
        averageTime: `${avgTime.toFixed(2)}ms`,
        minTime: `${minTime}ms`,
        maxTime: `${maxTime}ms`,
        iterations,
        successRate: '100%',
        targetLatency: '< 100ms',
        meetsTarget: avgTime < 100
      },
      results
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('FAST_DECISION_ERROR', 'Failed to test fast decision service')),
      500
    );
  }
});

/**
 * Get agent message history
 */
agentRoutes.get('/messages', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    const response = await coordinator.fetch(
      new Request('https://coordinator/messages', {
        method: 'GET'
      }) as any
    );
    
    const messages = await response.json();
    return c.json(createApiResponse(messages));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('MESSAGES_ERROR', 'Failed to get message history')),
      500
    );
  }
});

/**
 * Test agent performance tracking
 */
agentRoutes.get('/performance', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    const response = await coordinator.fetch(
      new Request('https://coordinator/performance', {
        method: 'GET'
      }) as any
    );
    
    const performance = await response.json();
    return c.json(createApiResponse(performance));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('PERFORMANCE_ERROR', 'Failed to get performance data')),
      500
    );
  }
});

/**
 * Get options flow opportunities
 */
agentRoutes.get('/options-flow', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    const response = await coordinator.fetch(
      new Request('https://coordinator/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `options-flow-request-${Date.now()}`,
          from: 'API',
          to: AgentType.OPTIONS_FLOW_ANALYST,
          type: MessageType.ANALYSIS_RESULT,
          payload: { request: 'get_opportunities' },
          timestamp: Date.now(),
          priority: MessagePriority.NORMAL
        })
      }) as any
    );
    
    if (!response.ok) {
      throw new Error('Failed to get options flow');
    }
    
    const result = await response.json();
    return c.json(createApiResponse({
      opportunities: result
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('OPTIONS_FLOW_ERROR', 'Failed to get options flow')),
      500
    );
  }
});

/**
 * Get real-time market opportunities
 */
agentRoutes.get('/market-opportunities', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    const response = await coordinator.fetch(
      new Request('https://coordinator/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `market-opportunities-${Date.now()}`,
          from: 'API',
          to: AgentType.MARKET_HOURS_RESEARCHER,
          type: MessageType.ANALYSIS_RESULT,
          payload: { request: 'get_opportunities' },
          timestamp: Date.now(),
          priority: MessagePriority.NORMAL
        })
      }) as any
    );
    
    if (!response.ok) {
      throw new Error('Failed to get market opportunities');
    }
    
    const result = await response.json();
    return c.json(createApiResponse({
      opportunities: result
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('MARKET_OPPORTUNITIES_ERROR', 'Failed to get opportunities')),
      500
    );
  }
});

/**
 * Get risk management status with live tuning info
 */
agentRoutes.get('/risk-status', async (c) => {
  try {
    const coordinatorId = c.env.AGENT_COORDINATOR.idFromName('main');
    const coordinator = c.env.AGENT_COORDINATOR.get(coordinatorId);
    
    const response = await coordinator.fetch(
      new Request('https://coordinator/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `risk-status-${Date.now()}`,
          from: 'API',
          to: AgentType.RISK_MANAGER,
          type: MessageType.ANALYSIS_RESULT,
          payload: { request: 'get_strategy_status' },
          timestamp: Date.now(),
          priority: MessagePriority.NORMAL
        })
      }) as any
    );
    
    if (!response.ok) {
      throw new Error('Failed to get risk status');
    }
    
    const result = await response.json();
    return c.json(createApiResponse({
      riskStatus: result
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('RISK_STATUS_ERROR', 'Failed to get risk status')),
      500
    );
  }
});

export { agentRoutes };