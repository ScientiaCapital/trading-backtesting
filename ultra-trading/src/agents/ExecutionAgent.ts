/**
 * Execution Agent
 * Handles smart order routing, position management, and trade execution
 * Optimizes order placement for best fills and minimal slippage
 */

import { BaseAgent } from './base/BaseAgent';
import {
  AgentType,
  AgentMessage,
  MessageType,
  MessagePriority,
  AgentConfig,
  TradingDecision,
} from '@/types/agents';
import { Order, OrderType, TimeInForce, OrderSide, OrderStatus, AssetClass } from '@/types/trading';
import { Signal } from '@/types/strategy';
import { CloudflareBindings } from '@/types';
import { AlpacaTradingService } from '@/services/alpaca/AlpacaTradingService';

interface ExecutionPlan {
  orders: Order[];
  estimatedFillPrice: number;
  estimatedSlippage: number;
  executionStrategy: 'MARKET' | 'LIMIT' | 'ICEBERG' | 'TWAP';
  timeframe: string;
  reasoning: string;
}

interface ExecutionResult {
  orderId: string;
  symbol: string;
  filledQty: number;
  avgFillPrice: number;
  slippage: number;
  executionTime: number;
  status: 'FILLED' | 'PARTIAL' | 'REJECTED';
  pnl?: number;
}

export class ExecutionAgent extends BaseAgent {
  private tradingService?: AlpacaTradingService;
  private env?: CloudflareBindings;
  
  // Execution parameters
  private readonly MAX_SLIPPAGE = 0.002; // 0.2% max slippage
  private readonly MAX_ORDER_SIZE = 1000; // Max shares per order
  private readonly ICEBERG_CHUNK_SIZE = 100; // Size for iceberg orders
  private readonly EXECUTION_TIMEOUT = 30000; // 30 seconds timeout
  
  // Execution tracking
  private activeOrders: Map<string, Order> = new Map();
  private executionMetrics = {
    totalOrders: 0,
    filledOrders: 0,
    rejectedOrders: 0,
    avgSlippage: 0,
    totalVolume: 0
  };
  
  constructor(config: AgentConfig, env?: CloudflareBindings) {
    super(AgentType.EXECUTION, {
      ...config,
      model: '@cf/mistralai/mistral-small-3.1-24b-instruct',
      temperature: 0.1, // Low temperature for consistent execution decisions
      maxTokens: 2048,
      systemPrompt: `You are a professional trade execution agent.
        Your role is to execute trades with minimal market impact and slippage.
        Analyze market conditions and choose optimal execution strategies.
        Consider liquidity, spread, and volatility when placing orders.
        Prioritize fill quality over speed unless urgent.`
    });
    this.env = env;
  }

  protected async onInitialize(): Promise<void> {
    // Initialize trading service
    if (this.env) {
      this.tradingService = new AlpacaTradingService(
        this.env,
        `execution-${Date.now()}`
      );
    }
    
    this.logger.info('Execution Agent initialized', {
      agentId: this.id,
      maxSlippage: this.MAX_SLIPPAGE,
      maxOrderSize: this.MAX_ORDER_SIZE
    });
  }

  protected async handleMessage(message: AgentMessage): Promise<AgentMessage | null> {
    switch (message.type) {
      case MessageType.EXECUTION_REQUEST:
        const decision = message.payload as TradingDecision;
        
        // Execute the trading decision
        const results = await this.executeTradingDecision(decision);
        
        // Send execution results
        return this.createMessage(
          'BROADCAST',
          MessageType.EXECUTION_RESULT,
          {
            decisionId: decision.id,
            results,
            summary: this.summarizeExecution(results)
          },
          MessagePriority.HIGH
        );
        
      case MessageType.RISK_ALERT:
        // Handle risk alerts by potentially canceling orders
        const { recommendation } = message.payload as any;
        
        if (recommendation === 'STOP_TRADING' || recommendation === 'CLOSE') {
          await this.cancelAllOrders();
          return this.createMessage(
            message.from,
            MessageType.EXECUTION_RESULT,
            {
              action: 'ORDERS_CANCELED',
              canceledCount: this.activeOrders.size
            }
          );
        }
        
        return null;
        
      default:
        this.logger.debug('Ignoring message type', { type: message.type });
        return null;
    }
  }

  protected async onShutdown(): Promise<void> {
    // Cancel any remaining orders
    await this.cancelAllOrders();
    
    this.logger.info('Execution Agent shutting down', {
      metrics: this.executionMetrics
    });
  }

  /**
   * Execute a trading decision
   */
  private async executeTradingDecision(
    decision: TradingDecision
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    try {
      // Generate execution plan
      const plan = await this.createExecutionPlan(decision);
      
      this.logger.info('Executing trading decision', {
        decisionId: decision.id,
        action: decision.action,
        orderCount: plan.orders.length,
        strategy: plan.executionStrategy
      });
      
      // Execute orders based on strategy
      switch (plan.executionStrategy) {
        case 'MARKET':
          results.push(...await this.executeMarketOrders(plan.orders));
          break;
          
        case 'LIMIT':
          results.push(...await this.executeLimitOrders(plan.orders));
          break;
          
        case 'ICEBERG':
          results.push(...await this.executeIcebergOrders(plan.orders));
          break;
          
        case 'TWAP':
          results.push(...await this.executeTWAPOrders(plan.orders));
          break;
      }
      
      // Update metrics
      this.updateExecutionMetrics(results);
      
    } catch (error) {
      this.logger.error('Execution failed', {
        error: (error as Error).message,
        decisionId: decision.id
      });
      
      // Return failed execution result
      results.push({
        orderId: `failed-${Date.now()}`,
        symbol: decision.signals[0]?.symbol || 'UNKNOWN',
        filledQty: 0,
        avgFillPrice: 0,
        slippage: 0,
        executionTime: 0,
        status: 'REJECTED'
      });
    }
    
    return results;
  }

  /**
   * Create execution plan based on decision
   */
  private async createExecutionPlan(
    decision: TradingDecision
  ): Promise<ExecutionPlan> {
    const orders: Order[] = [];
    
    // Convert signals to orders
    for (const signal of decision.signals) {
      // Determine execution strategy based on order size and urgency
      let orderType: OrderType = OrderType.MARKET;
      let timeInForce: TimeInForce = TimeInForce.DAY;
      
      if ((signal.quantity || 0) > this.MAX_ORDER_SIZE) {
        // Large order - use iceberg or TWAP
        return {
          orders: this.splitIntoChunks(signal),
          estimatedFillPrice: signal.limitPrice || 0,
          estimatedSlippage: this.MAX_SLIPPAGE,
          executionStrategy: 'ICEBERG',
          timeframe: '5m',
          reasoning: 'Large order size requires iceberg execution'
        };
      }
      
      // Check market conditions for execution type
      const spread = await this.getMarketSpread(signal.symbol);
      
      if (spread > 0.001) { // Wide spread
        orderType = OrderType.LIMIT;
        timeInForce = TimeInForce.GTC;
      }
      
      orders.push({
        id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol: signal.symbol,
        assetClass: AssetClass.US_EQUITY,
        quantity: signal.quantity || 0,
        filledQuantity: 0,
        side: signal.action === 'buy' ? OrderSide.BUY : OrderSide.SELL,
        orderType,
        timeInForce,
        limitPrice: orderType === OrderType.LIMIT ? signal.limitPrice || 0 : undefined,
        status: OrderStatus.PENDING_NEW,
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedAt: new Date()
      });
    }
    
    return {
      orders,
      estimatedFillPrice: decision.signals[0]?.limitPrice || 0,
      estimatedSlippage: 0.001,
      executionStrategy: orders[0]?.orderType === OrderType.MARKET ? 'MARKET' : 'LIMIT',
      timeframe: 'immediate',
      reasoning: 'Standard execution for normal market conditions'
    };
  }

  /**
   * Execute market orders
   */
  private async executeMarketOrders(orders: Order[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const order of orders) {
      try {
        if (!this.tradingService) throw new Error('Trading service not initialized');
        
        const startTime = Date.now();
        
        // Place market order
        const placedOrder = await this.tradingService.submitOrder({
          symbol: order.symbol,
          qty: order.quantity,
          side: order.side,
          type: 'market',
          time_in_force: 'day'
        });
        
        // Track active order
        this.activeOrders.set(placedOrder.id, order);
        
        // Wait for fill
        const filledOrder = await this.waitForFill(placedOrder.id);
        
        results.push({
          orderId: filledOrder.id,
          symbol: filledOrder.symbol,
          filledQty: Number(filledOrder.filled_qty),
          avgFillPrice: Number(filledOrder.filled_avg_price || 0),
          slippage: this.calculateSlippage(order.limitPrice || 0, Number(filledOrder.filled_avg_price || 0)),
          executionTime: Date.now() - startTime,
          status: 'FILLED'
        });
        
        // Remove from active orders
        this.activeOrders.delete(placedOrder.id);
        
      } catch (error) {
        this.logger.error('Market order failed', {
          error: (error as Error).message,
          order
        });
        
        results.push({
          orderId: order.id,
          symbol: order.symbol,
          filledQty: 0,
          avgFillPrice: 0,
          slippage: 0,
          executionTime: 0,
          status: 'REJECTED'
        });
      }
    }
    
    return results;
  }

  /**
   * Execute limit orders
   */
  private async executeLimitOrders(orders: Order[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const order of orders) {
      try {
        if (!this.tradingService) throw new Error('Trading service not initialized');
        
        const startTime = Date.now();
        
        // Place limit order
        const placedOrder = await this.tradingService.submitOrder({
          symbol: order.symbol,
          qty: order.quantity,
          side: order.side,
          type: 'limit',
          time_in_force: 'gtc',
          limit_price: order.limitPrice
        });
        
        // Track active order
        this.activeOrders.set(placedOrder.id, order);
        
        // Wait for fill with timeout
        const filledOrder = await this.waitForFill(placedOrder.id, this.EXECUTION_TIMEOUT);
        
        results.push({
          orderId: filledOrder.id,
          symbol: filledOrder.symbol,
          filledQty: Number(filledOrder.filled_qty),
          avgFillPrice: Number(filledOrder.filled_avg_price || 0),
          slippage: 0, // No slippage on limit orders
          executionTime: Date.now() - startTime,
          status: filledOrder.filled_qty === filledOrder.qty ? 'FILLED' : 'PARTIAL'
        });
        
        // Remove from active orders
        this.activeOrders.delete(placedOrder.id);
        
      } catch (error) {
        this.logger.error('Limit order failed', {
          error: (error as Error).message,
          order
        });
        
        results.push({
          orderId: order.id,
          symbol: order.symbol,
          filledQty: 0,
          avgFillPrice: 0,
          slippage: 0,
          executionTime: 0,
          status: 'REJECTED'
        });
      }
    }
    
    return results;
  }

  /**
   * Execute iceberg orders (split into smaller chunks)
   */
  private async executeIcebergOrders(orders: Order[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const order of orders) {
      const chunks = this.splitIntoChunks({
        symbol: order.symbol,
        action: order.side === OrderSide.BUY ? 'buy' : 'sell',
        quantity: order.quantity,
        orderType: 'market',
        timeInForce: 'day',
        limitPrice: order.limitPrice,
        reason: 'Iceberg execution for large order',
        confidence: 0.8
      });
      
      // Execute each chunk
      for (const chunk of chunks) {
        const chunkOrder: Order = {
          ...order,
          quantity: chunk.quantity,
          id: `${order.id}-chunk-${chunks.indexOf(chunk)}`
        };
        
        const chunkResults = await this.executeMarketOrders([chunkOrder]);
        results.push(...chunkResults);
        
        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Execute TWAP orders (Time-Weighted Average Price)
   */
  private async executeTWAPOrders(orders: Order[]): Promise<ExecutionResult[]> {
    // Simplified TWAP - split into time-based chunks
    const results: ExecutionResult[] = [];
    const chunks = 5; // Split into 5 time periods
    
    for (const order of orders) {
      const chunkSize = Math.floor(order.quantity / chunks);
      
      for (let i = 0; i < chunks; i++) {
        const chunkOrder: Order = {
          ...order,
          quantity: i === chunks - 1 ? order.quantity - (chunkSize * (chunks - 1)) : chunkSize,
          id: `${order.id}-twap-${i}`
        };
        
        const chunkResults = await this.executeMarketOrders([chunkOrder]);
        results.push(...chunkResults);
        
        // Wait between chunks (1 minute)
        if (i < chunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    }
    
    return results;
  }

  /**
   * Split large orders into chunks
   */
  private splitIntoChunks(signal: Signal): Order[] {
    const chunks: Order[] = [];
    const totalQty = signal.quantity || 0;
    let remaining = totalQty;
    
    while (remaining > 0) {
      const chunkSize = Math.min(remaining, this.ICEBERG_CHUNK_SIZE);
      
      chunks.push({
        id: `order-${Date.now()}-${chunks.length}`,
        symbol: signal.symbol,
        assetClass: AssetClass.US_EQUITY,
        quantity: chunkSize,
        filledQuantity: 0,
        side: signal.action === 'buy' ? OrderSide.BUY : OrderSide.SELL,
        orderType: OrderType.MARKET,
        timeInForce: TimeInForce.DAY,
        status: OrderStatus.PENDING_NEW,
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedAt: new Date()
      });
      
      remaining -= chunkSize;
    }
    
    return chunks;
  }

  /**
   * Wait for order to fill
   */
  private async waitForFill(orderId: string, timeout = 60000): Promise<any> {
    if (!this.tradingService) throw new Error('Trading service not initialized');
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const order = await this.tradingService.getOrder(orderId);
      
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }
      
      if (order.status === 'filled' || order.status === 'partially_filled') {
        return order;
      }
      
      if (order.status === 'canceled' || order.status === 'rejected') {
        throw new Error(`Order ${order.status}: ${orderId}`);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Order timeout: ${orderId}`);
  }

  /**
   * Get market spread for a symbol
   */
  private async getMarketSpread(_symbol: string): Promise<number> {
    // In production, get real-time quote
    // For now, return mock spread
    return 0.0005; // 0.05%
  }

  /**
   * Calculate slippage
   */
  private calculateSlippage(expectedPrice: number, actualPrice: number): number {
    if (expectedPrice === 0) return 0;
    return Math.abs(actualPrice - expectedPrice) / expectedPrice;
  }

  /**
   * Cancel all active orders
   */
  private async cancelAllOrders(): Promise<void> {
    if (!this.tradingService) return;
    
    for (const orderId of this.activeOrders.keys()) {
      try {
        await this.tradingService.cancelOrder(orderId);
        this.activeOrders.delete(orderId);
      } catch (error) {
        this.logger.error('Failed to cancel order', {
          orderId,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Update execution metrics
   */
  private updateExecutionMetrics(results: ExecutionResult[]): void {
    for (const result of results) {
      this.executionMetrics.totalOrders++;
      
      if (result.status === 'FILLED') {
        this.executionMetrics.filledOrders++;
        this.executionMetrics.totalVolume += result.filledQty;
        
        // Update average slippage
        const prevAvg = this.executionMetrics.avgSlippage;
        const prevCount = this.executionMetrics.filledOrders - 1;
        this.executionMetrics.avgSlippage = 
          (prevAvg * prevCount + result.slippage) / this.executionMetrics.filledOrders;
          
      } else if (result.status === 'REJECTED') {
        this.executionMetrics.rejectedOrders++;
      }
    }
  }

  /**
   * Summarize execution results
   */
  private summarizeExecution(results: ExecutionResult[]): string {
    const filled = results.filter(r => r.status === 'FILLED').length;
    const partial = results.filter(r => r.status === 'PARTIAL').length;
    const rejected = results.filter(r => r.status === 'REJECTED').length;
    const avgSlippage = results
      .filter(r => r.status === 'FILLED')
      .reduce((sum, r) => sum + r.slippage, 0) / filled || 0;
    
    return `Executed ${results.length} orders: ${filled} filled, ${partial} partial, ${rejected} rejected. Avg slippage: ${(avgSlippage * 100).toFixed(3)}%`;
  }
}