/**
 * Base Agent Class
 * Foundation for all AI agents in the trading system
 */

import {
  IAgent,
  AgentType,
  AgentStatus,
  AgentContext,
  AgentMessage,
  AgentMetrics,
  AgentConfig,
  MessagePriority,
  MessageType
} from '@/types/agents';
import { createLogger } from '@/utils/logger';

export abstract class BaseAgent implements IAgent {
  id: string;
  type: AgentType;
  status: AgentStatus = AgentStatus.IDLE;
  
  protected config: AgentConfig;
  protected metrics: AgentMetrics;
  protected logger: ReturnType<typeof createLogger>;
  protected lastUpdate: number = Date.now();
  
  constructor(type: AgentType, config: AgentConfig) {
    this.id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.config = config;
    this.logger = createLogger({ requestId: this.id });
    
    this.metrics = {
      decisionsToday: 0,
      successRate: 1.0,
      averageResponseTime: 0,
      errorCount: 0
    };
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing agent', { 
      agentId: this.id, 
      type: this.type 
    });
    
    this.status = AgentStatus.IDLE;
    this.lastUpdate = Date.now();
    
    // Agent-specific initialization
    await this.onInitialize();
  }

  /**
   * Process incoming message
   */
  async process(message: AgentMessage): Promise<AgentMessage | null> {
    const startTime = Date.now();
    
    try {
      this.status = AgentStatus.ANALYZING;
      this.logger.info('Processing message', { 
        messageId: message.id,
        type: message.type,
        from: message.from,
        agentType: this.type
      });
      
      // Process based on message type
      const response = await this.handleMessage(message);
      
      // Update metrics
      this.updateMetrics(Date.now() - startTime, true);
      
      this.status = AgentStatus.IDLE;
      return response;
      
    } catch (error) {
      this.logger.error('Error processing message', { 
        error: (error as Error).message,
        messageId: message.id 
      });
      
      this.updateMetrics(Date.now() - startTime, false);
      this.status = AgentStatus.ERROR;
      
      return this.createErrorResponse(message, error as Error);
    }
  }

  /**
   * Get current agent status
   */
  getStatus(): AgentContext {
    return {
      agentId: this.id,
      agentType: this.type,
      status: this.status,
      lastUpdate: this.lastUpdate,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down agent', { agentId: this.id });
    
    this.status = AgentStatus.IDLE;
    await this.onShutdown();
  }

  /**
   * Create a message to send
   */
  protected createMessage(
    to: AgentType | 'BROADCAST',
    type: string,
    payload: unknown,
    priority: MessagePriority = MessagePriority.NORMAL
  ): AgentMessage {
    return {
      id: `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: this.type,
      to,
      type: type as MessageType,
      payload,
      timestamp: Date.now(),
      priority,
      requiresResponse: false
    };
  }

  /**
   * Update agent metrics
   */
  protected updateMetrics(responseTime: number, success: boolean): void {
    this.metrics.decisionsToday++;
    
    if (!success) {
      this.metrics.errorCount++;
    }
    
    // Update success rate
    const totalDecisions = this.metrics.decisionsToday;
    const successfulDecisions = totalDecisions - this.metrics.errorCount;
    this.metrics.successRate = successfulDecisions / totalDecisions;
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalDecisions - 1) + responseTime) / totalDecisions;
    
    this.lastUpdate = Date.now();
  }

  /**
   * Create error response message
   */
  protected createErrorResponse(
    originalMessage: AgentMessage, 
    error: Error
  ): AgentMessage {
    return this.createMessage(
      originalMessage.from,
      'ERROR_RESPONSE',
      {
        originalMessageId: originalMessage.id,
        error: error.message,
        timestamp: Date.now()
      },
      MessagePriority.HIGH
    );
  }

  /**
   * Reset daily metrics
   */
  resetDailyMetrics(): void {
    this.metrics.decisionsToday = 0;
    this.metrics.errorCount = 0;
    this.metrics.successRate = 1.0;
    this.metrics.averageResponseTime = 0;
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract onInitialize(): Promise<void>;
  protected abstract handleMessage(message: AgentMessage): Promise<AgentMessage | null>;
  protected abstract onShutdown(): Promise<void>;
}

/**
 * Base class for AI-powered agents
 */
export abstract class AIAgent extends BaseAgent {
  protected modelEndpoint?: string;
  protected apiKey?: string;
  protected readonly AI_TIMEOUT = 3000; // 3 second timeout for AI calls
  
  constructor(type: AgentType, config: AgentConfig) {
    super(type, config);
    this.modelEndpoint = this.getModelEndpoint();
  }

  /**
   * Get the appropriate model endpoint based on agent type
   */
  protected getModelEndpoint(): string {
    switch (this.type) {
      case AgentType.MARKET_ANALYST:
        return 'gemini-2.0-flash'; // External API
      case AgentType.STRATEGY_OPTIMIZER:
        return 'claude-3-opus-20240229'; // External API
      case AgentType.RISK_MANAGER:
        return '@cf/mistralai/mistral-small-3.1-24b-instruct';
      case AgentType.PERFORMANCE_ANALYST:
        return '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
      case AgentType.EXECUTION:
        return '@cf/mistralai/mistral-small-3.1-24b-instruct';
      case AgentType.OPTIONS_FLOW_ANALYST:
        return '@cf/qwen/qwq-32b';
      case AgentType.MARKET_HOURS_RESEARCHER:
        return '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';
      default:
        return '@cf/meta/llama-3.1-8b-instruct'; // Default fallback
    }
  }

  /**
   * Call AI model with prompt
   */
  protected async callAIModel(
    prompt: string,
    _systemPrompt?: string
  ): Promise<string> {
    try {
      // This will be implemented based on the specific AI service
      // For now, return a placeholder
      this.logger.debug('Calling AI model', { 
        model: this.modelEndpoint,
        promptLength: prompt.length 
      });
      
      // Placeholder for actual AI call
      return this.mockAIResponse(prompt);
      
    } catch (error) {
      this.logger.error('AI model call failed', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * Mock AI response for development
   */
  protected mockAIResponse(_prompt: string): string {
    // This is a placeholder - will be replaced with actual AI calls
    return JSON.stringify({
      analysis: 'Mock analysis response',
      confidence: 0.85,
      timestamp: Date.now()
    });
  }

  /**
   * Parse AI response
   */
  protected parseAIResponse<T>(response: string): T {
    try {
      return JSON.parse(response) as T;
    } catch (error) {
      this.logger.error('Failed to parse AI response', { 
        error: (error as Error).message,
        response 
      });
      throw new Error('Invalid AI response format');
    }
  }
}