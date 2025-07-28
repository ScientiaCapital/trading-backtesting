/**
 * Agent Coordinator Durable Object
 * Manages communication and coordination between AI agents
 */

import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';
import {
  IAgent,
  AgentType,
  AgentMessage,
  CoordinatorState,
  CoordinatorConfig,
  TradingDecision,
  TradingAction,
  MessagePriority,
  MessageType,
  PerformanceStatus
} from '@/types/agents';
import { MarketAnalystAgent } from '@/agents/MarketAnalystAgent';
import { StrategyOptimizerAgent } from '@/agents/StrategyOptimizerAgent';
import { RiskManagerAgent } from '@/agents/RiskManagerAgent';
import { PerformanceAnalystAgent } from '@/agents/PerformanceAnalystAgent';
import { ExecutionAgent } from '@/agents/ExecutionAgent';
import { OptionsFlowAnalyst } from '@/agents/OptionsFlowAnalyst';
import { MarketHoursResearcher } from '@/agents/MarketHoursResearcher';
import { CloudflareBindings } from '@/types';
import { FastDecisionService } from '@/services/FastDecisionService';
import { SmartFastDecisionService } from '@/services/SmartFastDecisionService';

export class AgentCoordinator {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: CloudflareBindings;
  
  private agents: Map<AgentType, IAgent> = new Map();
  private messageQueue: AgentMessage[] = [];
  private activeDecisions: Map<string, TradingDecision> = new Map();
  private config: CoordinatorConfig;
  private fastDecisionService: FastDecisionService;
  private smartFastDecisionService: SmartFastDecisionService;
  
  constructor(state: DurableObjectState, env: CloudflareBindings) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    
    this.config = {
      maxConcurrentDecisions: 5,
      decisionTimeout: 5000, // 5 seconds - reduced from 30 seconds for faster trading
      consensusThreshold: 0.7
    };
    
    // Initialize fast decision services
    this.fastDecisionService = new FastDecisionService(env);
    this.smartFastDecisionService = new SmartFastDecisionService(env);
    
    // Initialize coordinator on first request
    this.state.blockConcurrencyWhile(async () => {
      await this.initialize();
    });
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      switch (url.pathname) {
        case '/message':
          return await this.handleMessage(request);
          
        case '/status':
          return await this.getStatus();
          
        case '/decision':
          return await this.makeDecision(request);
          
        case '/performance':
          return await this.getPerformance();
          
        case '/reset':
          return await this.resetAgents();
          
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Coordinator error:', error);
      return new Response(
        JSON.stringify({ error: (error as Error).message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Initialize coordinator and agents
   */
  private async initialize(): Promise<void> {
    // Load saved state
    const savedState = await this.storage.get<Partial<CoordinatorState>>('state');
    if (savedState?.performance) {
      // Restore performance metrics
      await this.storage.put('performance', savedState.performance);
    }
    
    // Initialize agents
    await this.initializeAgents();
    
    // Set up periodic tasks
    this.setupPeriodicTasks();
  }

  /**
   * Initialize all AI agents
   */
  private async initializeAgents(): Promise<void> {
    // Market Analyst Agent
    const marketAnalyst = new MarketAnalystAgent(
      { agentType: AgentType.MARKET_ANALYST },
      this.env
    );
    await marketAnalyst.initialize();
    this.agents.set(AgentType.MARKET_ANALYST, marketAnalyst);
    
    // Strategy Optimizer Agent
    const strategyOptimizer = new StrategyOptimizerAgent(
      { agentType: AgentType.STRATEGY_OPTIMIZER },
      this.env
    );
    await strategyOptimizer.initialize();
    this.agents.set(AgentType.STRATEGY_OPTIMIZER, strategyOptimizer);
    
    // Risk Manager Agent
    const riskManager = new RiskManagerAgent(
      { agentType: AgentType.RISK_MANAGER },
      this.env
    );
    await riskManager.initialize();
    this.agents.set(AgentType.RISK_MANAGER, riskManager);
    
    // Performance Analyst Agent
    const performanceAnalyst = new PerformanceAnalystAgent(
      { agentType: AgentType.PERFORMANCE_ANALYST },
      this.env
    );
    await performanceAnalyst.initialize();
    this.agents.set(AgentType.PERFORMANCE_ANALYST, performanceAnalyst);
    
    // Execution Agent
    const executionAgent = new ExecutionAgent(
      { agentType: AgentType.EXECUTION },
      this.env
    );
    await executionAgent.initialize();
    this.agents.set(AgentType.EXECUTION, executionAgent);
    
    // Options Flow Analyst Agent
    const optionsFlowAnalyst = new OptionsFlowAnalyst(
      { agentType: AgentType.OPTIONS_FLOW_ANALYST },
      this.env
    );
    await optionsFlowAnalyst.initialize();
    this.agents.set(AgentType.OPTIONS_FLOW_ANALYST, optionsFlowAnalyst);
    
    // Market Hours Researcher Agent
    const marketHoursResearcher = new MarketHoursResearcher(
      { agentType: AgentType.MARKET_HOURS_RESEARCHER },
      this.env
    );
    await marketHoursResearcher.initialize();
    this.agents.set(AgentType.MARKET_HOURS_RESEARCHER, marketHoursResearcher);
    
    console.log('All AI agents initialized successfully!');
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(request: Request): Promise<Response> {
    const message = await request.json() as AgentMessage;
    
    // Add to queue
    this.messageQueue.push(message);
    
    // Process immediately if high priority
    if (message.priority === MessagePriority.CRITICAL) {
      await this.processMessage(message);
    }
    
    return new Response(
      JSON.stringify({ success: true, messageId: message.id }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Process a message
   */
  private async processMessage(message: AgentMessage): Promise<void> {
    // Route to appropriate agent(s)
    if (message.to === 'BROADCAST') {
      // Send to all agents
      const responses = await Promise.all(
        Array.from(this.agents.values()).map(agent => agent.process(message))
      );
      
      // Process responses
      for (const response of responses) {
        if (response) {
          this.messageQueue.push(response);
        }
      }
    } else {
      // Send to specific agent
      const agent = this.agents.get(message.to as AgentType);
      if (agent) {
        const response = await agent.process(message);
        if (response) {
          this.messageQueue.push(response);
        }
      }
    }
    
    // Save state
    await this.saveState();
  }

  /**
   * Make a trading decision
   */
  private async makeDecision(request: Request): Promise<Response> {
    const { context, useQuickDecision = true } = await request.json() as { 
      context: any; 
      useQuickDecision?: boolean;
    };
    
    const decisionId = `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Try smart fast decision first if enabled (for time-critical trades with proper risk management)
    if (useQuickDecision && context.marketData && context.positions && context.dailyPnL !== undefined) {
      try {
        // Use SmartFastDecisionService for better decision quality
        const accountValue = context.account?.portfolio_value || 100000;
        const smartDecision = await this.smartFastDecisionService.getQuickDecision(
          context.marketData,
          context.positions,
          context.dailyPnL,
          accountValue
        );
        
        // Log decision details for monitoring
        const decisionTime = Date.now() - parseInt(decisionId.split('-')[1] || '0');
        console.log(`Smart fast decision made in ${decisionTime}ms`, {
          action: smartDecision.action,
          confidence: smartDecision.confidence,
          reasoning: smartDecision.reasoning,
          metadata: smartDecision.metadata
        });
        
        // Always use smart decision (it has built-in validation)
        this.activeDecisions.set(decisionId, smartDecision);
        
        return new Response(
          JSON.stringify(smartDecision),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Smart fast decision failed, falling back to AI agents:', error);
      }
    }
    
    // Fall back to AI agent consensus for complex decisions
    const marketMessage: AgentMessage = {
      id: `msg-${decisionId}`,
      from: AgentType.MARKET_ANALYST,
      to: 'BROADCAST',
      type: MessageType.MARKET_UPDATE,
      payload: context.marketData,
      timestamp: Date.now(),
      priority: MessagePriority.HIGH
    };
    
    // Process through agents
    await this.processMessage(marketMessage);
    
    // Wait for responses (with timeout)
    const decision = await this.waitForConsensus(decisionId);
    
    // Store decision
    this.activeDecisions.set(decisionId, decision);
    
    return new Response(
      JSON.stringify(decision),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Wait for agent consensus on a decision
   */
  private async waitForConsensus(decisionId: string): Promise<TradingDecision> {
    const timeout = this.config.decisionTimeout;
    const startTime = Date.now();
    
    // Collect agent responses
    const responses = new Map<AgentType, any>();
    
    while (Date.now() - startTime < timeout) {
      // Check message queue for relevant responses
      const relevantMessages = this.messageQueue.filter(
        msg => msg.type === MessageType.ANALYSIS_RESULT || 
               msg.type === MessageType.STRATEGY_ADJUSTMENT
      );
      
      for (const msg of relevantMessages) {
        responses.set(msg.from, msg.payload);
      }
      
      // Check if we have enough responses (at least 2 agents)
      if (responses.size >= 2) {
        console.log(`Consensus reached with ${responses.size} agents in ${Date.now() - startTime}ms`);
        break;
      }
      
      // Check if timeout is approaching - use whatever we have
      if (Date.now() - startTime > timeout * 0.8 && responses.size > 0) {
        console.warn(`Timeout approaching, using ${responses.size} agent responses`);
        break;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms
    }
    
    // If timeout reached with no responses, return conservative decision
    if (responses.size === 0) {
      console.error(`No agent responses received within ${timeout}ms`);
      return {
        id: decisionId,
        timestamp: Date.now(),
        action: TradingAction.WAIT,
        signals: [],
        confidence: 0.1,
        reasoning: 'Timeout - no agent responses received'
      };
    }
    
    // Build consensus decision
    return this.buildConsensusDecision(decisionId, responses);
  }

  /**
   * Build consensus decision from agent responses
   */
  private buildConsensusDecision(
    decisionId: string,
    responses: Map<AgentType, any>
  ): TradingDecision {
    // Simplified consensus - in production, this would be more sophisticated
    const marketAnalysis = responses.get(AgentType.MARKET_ANALYST);
    const strategyOptimization = responses.get(AgentType.STRATEGY_OPTIMIZER);
    
    let action: TradingAction = TradingAction.WAIT;
    let confidence = 0.5;
    
    if (marketAnalysis && strategyOptimization) {
      // Determine action based on analysis
      if (marketAnalysis.recommendation === 'BUY' || marketAnalysis.recommendation === 'STRONG_BUY') {
        action = TradingAction.ENTER_POSITION;
        confidence = marketAnalysis.confidence;
      } else if (marketAnalysis.recommendation === 'SELL' || marketAnalysis.recommendation === 'STRONG_SELL') {
        action = TradingAction.EXIT_POSITION;
        confidence = marketAnalysis.confidence;
      }
    }
    
    return {
      id: decisionId,
      timestamp: Date.now(),
      action,
      signals: [], // Would be populated based on strategy
      confidence,
      reasoning: 'Based on market analysis and strategy optimization',
      riskAssessment: {
        portfolioRisk: 0.1,
        positionRisks: [],
        correlationRisk: 0.05,
        maxDrawdownRisk: 0.15,
        alerts: [],
        recommendation: 'PROCEED' as any
      },
      expectedOutcome: {
        profit: 300, // Daily target
        loss: 150,
        probability: confidence,
        timeframe: '1D'
      }
    };
  }

  /**
   * Get coordinator status
   */
  private async getStatus(): Promise<Response> {
    const agentStatuses = Array.from(this.agents.entries()).map(([type, agent]) => ({
      type,
      status: agent.getStatus()
    }));
    
    const status = {
      agents: agentStatuses,
      messageQueueSize: this.messageQueue.length,
      activeDecisions: this.activeDecisions.size,
      uptime: Date.now() - (await this.storage.get<number>('startTime') || Date.now())
    };
    
    return new Response(
      JSON.stringify(status),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get performance metrics
   */
  private async getPerformance(): Promise<Response> {
    const performance = await this.storage.get<PerformanceStatus>('performance') || {
      dailyPnL: 0,
      dailyTarget: 300,
      targetProgress: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      currentDrawdown: 0,
      shouldStop: false
    };
    
    return new Response(
      JSON.stringify(performance),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Reset agents and clear state
   */
  private async resetAgents(): Promise<Response> {
    // Shutdown existing agents
    for (const agent of this.agents.values()) {
      await agent.shutdown();
    }
    
    // Clear state
    this.agents.clear();
    this.messageQueue = [];
    this.activeDecisions.clear();
    
    // Reinitialize
    await this.initializeAgents();
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Save coordinator state
   */
  private async saveState(): Promise<void> {
    const state: Partial<CoordinatorState> = {
      messageQueue: this.messageQueue.slice(-100), // Keep last 100 messages
      performance: await this.storage.get<PerformanceStatus>('performance')
    };
    
    await this.storage.put('state', state);
  }

  /**
   * Set up periodic tasks
   */
  private setupPeriodicTasks(): void {
    // Process message queue every second
    setInterval(async () => {
      if (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          await this.processMessage(message);
        }
      }
    }, 1000);
    
    // Pre-compute indicators for fast decisions every 30 seconds
    setInterval(async () => {
      try {
        const symbols = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA']; // Main trading symbols
        for (const symbol of symbols) {
          // Pre-compute for both services
          await this.fastDecisionService.precomputeIndicators(symbol);
          // SmartFastDecisionService doesn't need pre-computation as it analyzes in real-time
        }
      } catch (error) {
        console.error('Failed to pre-compute indicators:', error);
      }
    }, 30000);
    
    // Clean up old decisions every minute
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      for (const [id, decision] of this.activeDecisions) {
        if (decision.timestamp < oneHourAgo) {
          this.activeDecisions.delete(id);
        }
      }
    }, 60000);
    
    // Reset daily metrics at midnight
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        await this.resetDailyMetrics();
      }
    }, 60000);
  }

  /**
   * Reset daily metrics
   */
  private async resetDailyMetrics(): Promise<void> {
    const performance = await this.storage.get<PerformanceStatus>('performance') || {
      dailyPnL: 0,
      dailyTarget: 300,
      targetProgress: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      currentDrawdown: 0,
      shouldStop: false
    };
    
    // Reset daily values
    performance.dailyPnL = 0;
    performance.targetProgress = 0;
    performance.totalTrades = 0;
    performance.winningTrades = 0;
    performance.losingTrades = 0;
    performance.shouldStop = false;
    
    await this.storage.put('performance', performance);
    
    // Reset agent metrics
    for (const agent of this.agents.values()) {
      if ('resetDailyMetrics' in agent) {
        (agent as any).resetDailyMetrics();
      }
    }
  }
}