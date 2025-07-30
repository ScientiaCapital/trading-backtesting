/**
 * Automated Trading Pipeline
 * Orchestrates all AI agents to execute automated trading
 * Implements daily profit target of $300
 */

import { CloudflareBindings } from '@/types';
// import { AgentCoordinator } from '@/durable-objects/AgentCoordinator';
import { AlpacaTradingService } from './alpaca/AlpacaTradingService';
import { RealtimeService } from './RealtimeService';
// import { MarketDataService } from './market-data';
import {
  TradingDecision,
  TradingAction,
  PerformanceStatus,
  MessageType,
  MessagePriority,
  AgentMessage
} from '@/types/agents';

export interface PipelineConfig {
  dailyProfitTarget: number;
  dailyLossLimit: number;
  maxConcurrentTrades: number;
  enabledStrategies: string[];
  tradingHours: {
    start: string; // "09:30"
    end: string;   // "16:00"
  };
}

export interface PipelineStatus {
  isRunning: boolean;
  startedAt?: Date;
  stoppedAt?: Date;
  reason?: string;
  dailyPnL: number;
  tradesExecuted: number;
  currentPositions: number;
}

export class TradingPipeline {
  private env: CloudflareBindings;
  private config: PipelineConfig;
  private tradingService: AlpacaTradingService;
  private realtimeService: RealtimeService;
  // private marketDataService: MarketDataService;
  private status: PipelineStatus;
  private coordinatorStub?: DurableObjectStub;
  private readonly requestId: string;
  
  constructor(env: CloudflareBindings, config?: Partial<PipelineConfig>) {
    this.env = env;
    this.requestId = `pipeline-${Date.now()}`;
    this.config = {
      dailyProfitTarget: 300,
      dailyLossLimit: 300,
      maxConcurrentTrades: 5,
      enabledStrategies: ['gamma_scalping', 'iron_condor', 'wheel'],
      tradingHours: {
        start: '09:30',
        end: '16:00'
      },
      ...config
    };
    
    this.tradingService = new AlpacaTradingService(
      env,
      `pipeline-${Date.now()}`
    );
    
    this.realtimeService = new RealtimeService(env);
    
    // this.marketDataService = new MarketDataService(env);
    
    this.status = {
      isRunning: false,
      dailyPnL: 0,
      tradesExecuted: 0,
      currentPositions: 0
    };
  }

  /**
   * Start the automated trading pipeline
   */
  async start(): Promise<void> {
    if (this.status.isRunning) {
      throw new Error('Trading pipeline is already running');
    }

    console.log(`[${this.requestId}] Starting automated trading pipeline`, {
      config: this.config
    });

    // Initialize agent coordinator
    await this.initializeCoordinator();

    // Check market status
    const isMarketOpen = await this.tradingService.isMarketOpen();
    if (!isMarketOpen) {
      throw new Error('Market is closed');
    }

    // Update status
    this.status = {
      isRunning: true,
      startedAt: new Date(),
      dailyPnL: 0,
      tradesExecuted: 0,
      currentPositions: 0
    };

    // Broadcast system status
    await this.realtimeService.broadcastSystemStatus('online', {
      message: 'Trading pipeline started',
      config: this.config
    });

    // Start trading loop
    await this.runTradingLoop();
  }

  /**
   * Stop the automated trading pipeline
   */
  async stop(reason = 'Manual stop'): Promise<void> {
    console.log('Stopping automated trading pipeline', { reason });

    this.status.isRunning = false;
    this.status.stoppedAt = new Date();
    this.status.reason = reason;

    // Broadcast system status
    await this.realtimeService.broadcastSystemStatus('offline', {
      message: 'Trading pipeline stopped',
      reason,
      finalStatus: this.status
    });

    // Cancel all pending orders
    await this.cancelAllPendingOrders();

    // Send stop message to all agents
    if (this.coordinatorStub) {
      const stopMessage: AgentMessage = {
        id: `stop-${Date.now()}`,
        from: 'SYSTEM' as any,
        to: 'BROADCAST',
        type: MessageType.STOP_TRADING,
        payload: { reason },
        timestamp: Date.now(),
        priority: MessagePriority.CRITICAL
      };

      await this.sendToCoordinator('/message', stopMessage);
    }
  }

  /**
   * Get current pipeline status
   */
  getStatus(): PipelineStatus {
    return { ...this.status };
  }

  /**
   * Main trading loop
   */
  private async runTradingLoop(): Promise<void> {
    while (this.status.isRunning) {
      try {
        // Check if we're within trading hours
        if (!this.isWithinTradingHours()) {
          console.log('Outside trading hours, pausing...');
          await this.sleep(60000); // Check every minute
          continue;
        }

        // Get current performance
        const performance = await this.getPerformanceStatus();
        
        // Check daily profit target
        if (performance.dailyPnL >= this.config.dailyProfitTarget) {
          await this.stop(`Daily profit target reached: $${performance.dailyPnL.toFixed(2)}`);
          break;
        }

        // Check daily loss limit
        if (performance.dailyPnL <= -this.config.dailyLossLimit) {
          await this.stop(`Daily loss limit reached: $${Math.abs(performance.dailyPnL).toFixed(2)}`);
          break;
        }

        // Update status
        this.status.dailyPnL = performance.dailyPnL;

        // Broadcast performance update
        await this.realtimeService.broadcastPerformanceUpdate(performance);
        await this.realtimeService.broadcastDailyPnL(
          performance.dailyPnL,
          (performance.dailyPnL / this.config.dailyProfitTarget) * 100
        );

        // Run trading cycle
        await this.executeTradingCycle();

        // Wait before next cycle (30 seconds)
        await this.sleep(30000);

      } catch (error) {
        console.error('Trading loop error:', error);
        
        // Broadcast error
        await this.realtimeService.broadcastError(error as Error, 'Trading loop');
        
        // Don't stop on errors, just log and continue
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  /**
   * Execute one trading cycle
   */
  private async executeTradingCycle(): Promise<void> {
    // 1. Get current market data
    const marketData = await this.getMarketData();
    
    // 2. Get current positions
    const positions = await this.tradingService.getPositions();
    this.status.currentPositions = positions.length;

    // 3. Send market update to agents
    const marketUpdate: AgentMessage = {
      id: `market-${Date.now()}`,
      from: 'SYSTEM' as any,
      to: 'BROADCAST',
      type: MessageType.MARKET_UPDATE,
      payload: {
        marketData,
        positions,
        performance: this.status
      },
      timestamp: Date.now(),
      priority: MessagePriority.NORMAL
    };

    await this.sendToCoordinator('/message', marketUpdate);

    // 4. Request trading decision
    const decision = await this.requestTradingDecision({
      marketData,
      positions,
      enabledStrategies: this.config.enabledStrategies
    });

    // 5. Execute decision if approved
    if (decision && decision.action !== TradingAction.WAIT) {
      await this.executeTradingDecision(decision);
    }
  }

  /**
   * Request trading decision from AI agents
   */
  private async requestTradingDecision(context: any): Promise<TradingDecision | null> {
    try {
      const response = await this.sendToCoordinator('/decision', { context });
      
      if (response.ok) {
        const decision = await response.json() as TradingDecision;
        
        console.log('Trading decision received', {
          id: decision.id,
          action: decision.action,
          confidence: decision.confidence
        });
        
        // Broadcast decision
        await this.realtimeService.broadcastAgentDecision('COORDINATOR' as any, decision);
        
        return decision;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get trading decision:', error);
      return null;
    }
  }

  /**
   * Execute trading decision
   */
  private async executeTradingDecision(decision: TradingDecision): Promise<void> {
    // Check if we have room for more trades
    if (this.status.currentPositions >= this.config.maxConcurrentTrades && 
        decision.action === TradingAction.ENTER_POSITION) {
      console.log('Max concurrent trades reached, skipping entry');
      return;
    }

    // Send execution request to agents
    const executionRequest: AgentMessage = {
      id: `exec-${decision.id}`,
      from: 'SYSTEM' as any,
      to: 'EXECUTION' as any,
      type: MessageType.EXECUTION_REQUEST,
      payload: decision,
      timestamp: Date.now(),
      priority: MessagePriority.HIGH
    };

    await this.sendToCoordinator('/message', executionRequest);
    
    this.status.tradesExecuted++;
  }

  /**
   * Get current market data
   */
  private async getMarketData(): Promise<any> {
    // Get quotes for enabled symbols
    const symbols = ['SPY', 'QQQ', 'IWM']; // Main indices
    // For now, use mock data instead of MarketDataService
    // const marketDataService = new MarketDataService(this.env, this.requestId);
    // Mock market data for now
    const mockQuotes = symbols.map(symbol => ({
      symbol,
      price: symbol === 'SPY' ? 455.50 : symbol === 'QQQ' ? 395.25 : 220.75,
      bid: symbol === 'SPY' ? 455.45 : symbol === 'QQQ' ? 395.20 : 220.70,
      ask: symbol === 'SPY' ? 455.55 : symbol === 'QQQ' ? 395.30 : 220.80,
      volume: 1000000,
      timestamp: new Date().toISOString()
    }));

    return mockQuotes;
  }

  /**
   * Get performance status from coordinator
   */
  private async getPerformanceStatus(): Promise<PerformanceStatus> {
    try {
      const response = await this.sendToCoordinator('/performance', {});
      
      if (response.ok) {
        return await response.json();
      }
      
      // Return default if failed
      return {
        dailyPnL: 0,
        dailyTarget: this.config.dailyProfitTarget,
        targetProgress: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        currentDrawdown: 0,
        shouldStop: false
      };
    } catch (error) {
      console.error('Failed to get performance status:', error);
      return {
        dailyPnL: 0,
        dailyTarget: this.config.dailyProfitTarget,
        targetProgress: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        currentDrawdown: 0,
        shouldStop: false
      };
    }
  }

  /**
   * Initialize agent coordinator
   */
  private async initializeCoordinator(): Promise<void> {
    const id = this.env.AGENT_COORDINATOR.idFromName('main');
    this.coordinatorStub = this.env.AGENT_COORDINATOR.get(id) as any;
    
    // Initialize agents
    const response = await this.sendToCoordinator('/status', {});
    if (!response.ok) {
      throw new Error('Failed to initialize agent coordinator');
    }
  }

  /**
   * Send request to coordinator
   */
  private async sendToCoordinator(path: string, body: any): Promise<Response> {
    if (!this.coordinatorStub) {
      throw new Error('Coordinator not initialized');
    }

    return await this.coordinatorStub.fetch(
      new Request(`https://coordinator${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    );
  }

  /**
   * Cancel all pending orders
   */
  private async cancelAllPendingOrders(): Promise<void> {
    try {
      const orders = await this.tradingService.getOrders('open', 100);

      for (const order of orders) {
        await this.tradingService.cancelOrder(order.id);
      }

      console.log(`Cancelled ${orders.length} pending orders`);
    } catch (error) {
      console.error('Failed to cancel orders:', error);
    }
  }

  /**
   * Check if within trading hours
   */
  private isWithinTradingHours(): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    const startParts = this.config.tradingHours.start.split(':').map(Number);
    const endParts = this.config.tradingHours.end.split(':').map(Number);
    
    const startHour = startParts[0] ?? 9;
    const startMin = startParts[1] ?? 30;
    const endHour = endParts[0] ?? 16;
    const endMin = endParts[1] ?? 0;
    
    const startTime = startHour * 100 + startMin;
    const endTime = endHour * 100 + endMin;
    
    // Also check if it's a weekday
    const dayOfWeek = now.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    return isWeekday && currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}