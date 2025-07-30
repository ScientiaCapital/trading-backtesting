/**
 * Strategy Optimizer Agent
 * Powered by Anthropic Claude 4 Opus for strategy optimization
 */

import { AIAgent } from './base/BaseAgent';
import {
  AgentType,
  AgentMessage,
  IStrategyOptimizerAgent,
  StrategyOptimization,
  BacktestSummary,
  MarketAnalysis,
  MessageType,
  AgentConfig
} from '@/types/agents';
import { CloudflareBindings } from '@/types';

interface ClaudeOptimizationResponse {
  parameters: Record<string, number>;
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
  reasoning: string;
  backtestRecommended: boolean;
}

export class StrategyOptimizerAgent extends AIAgent implements IStrategyOptimizerAgent {
  private env?: CloudflareBindings;
  
  constructor(config: AgentConfig, env?: CloudflareBindings) {
    super(AgentType.STRATEGY_OPTIMIZER, {
      ...config,
      model: env?.ANTHROPIC_API_KEY ? 'claude-3-opus-20240229' : '@cf/qwen/qwen2.5-coder-32b-instruct',
      temperature: 0.2, // Very low for consistent optimization
      maxTokens: 8192,
      systemPrompt: `You are a quantitative strategy optimizer specializing in algorithmic trading.
        Your role is to optimize trading strategy parameters based on market conditions and historical performance.
        Provide detailed analysis with specific parameter recommendations, expected returns, and risk assessments.
        Always consider risk-adjusted returns and provide conservative estimates.`
    });
    this.env = env;
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Strategy Optimizer Agent initialized', {
      model: this.config.model,
      agentId: this.id
    });
  }

  protected async handleMessage(message: AgentMessage): Promise<AgentMessage | null> {
    switch (message.type) {
      case MessageType.ANALYSIS_RESULT:
        const marketAnalysis = message.payload as MarketAnalysis;
        // Optimize strategies based on market analysis
        const optimizations = await this.optimizeStrategiesForMarket(marketAnalysis);
        
        return this.createMessage(
          'BROADCAST',
          MessageType.STRATEGY_ADJUSTMENT,
          optimizations
        );
        
      default:
        this.logger.debug('Ignoring message type', { type: message.type });
        return null;
    }
  }

  protected async onShutdown(): Promise<void> {
    this.logger.info('Strategy Optimizer Agent shutting down');
  }

  /**
   * Optimize strategy based on market conditions
   */
  async optimizeStrategy(
    strategy: string,
    marketConditions: MarketAnalysis
  ): Promise<StrategyOptimization> {
    const prompt = this.buildOptimizationPrompt(strategy, marketConditions);
    
    try {
      let response: ClaudeOptimizationResponse;
      
      if (this.env?.ANTHROPIC_API_KEY) {
        // Use Anthropic API
        const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            system: this.config.systemPrompt,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          })
        });

        if (!apiResponse.ok) {
          throw new Error(`Claude API error: ${apiResponse.status}`);
        }

        const data = await apiResponse.json() as { content: Array<{ text: string }> };
        const firstContent = data.content[0];
        if (!firstContent) {
          throw new Error('No content received from Claude API');
        }
        response = JSON.parse(firstContent.text) as ClaudeOptimizationResponse;
      } else {
        // Fallback to mock response
        response = this.generateMockOptimization(strategy, marketConditions);
      }

      // Run backtest if recommended
      let backtestResults: BacktestSummary | undefined;
      if (response.backtestRecommended) {
        backtestResults = await this.backtest(strategy, response.parameters);
      }

      return {
        strategyId: strategy,
        parameters: response.parameters,
        expectedReturn: response.expectedReturn,
        risk: response.risk,
        sharpeRatio: response.sharpeRatio,
        backtestResults,
        confidence: this.calculateOptimizationConfidence(response, marketConditions)
      };
      
    } catch (error) {
      this.logger.error('Strategy optimization failed', {
        error: (error as Error).message,
        strategy
      });
      
      // Return conservative optimization
      return this.getConservativeOptimization(strategy);
    }
  }

  /**
   * Backtest strategy with parameters
   */
  async backtest(
    strategy: string,
    parameters: Record<string, unknown>
  ): Promise<BacktestSummary> {
    // Simplified backtest - in production, this would run actual historical simulation
    this.logger.info('Running backtest', { strategy, parameters });
    
    // Mock backtest results
    return {
      totalReturn: 0.15, // 15%
      winRate: 0.58,
      maxDrawdown: 0.08,
      profitFactor: 1.4,
      totalTrades: 150
    };
  }

  /**
   * Optimize multiple strategies for current market
   */
  private async optimizeStrategiesForMarket(
    marketAnalysis: MarketAnalysis
  ): Promise<StrategyOptimization[]> {
    const strategies = ['gamma_scalping', 'iron_condor', 'wheel'];
    const optimizations: StrategyOptimization[] = [];
    
    for (const strategy of strategies) {
      const optimization = await this.optimizeStrategy(strategy, marketAnalysis);
      optimizations.push(optimization);
    }
    
    return optimizations;
  }

  /**
   * Build optimization prompt for Claude
   */
  private buildOptimizationPrompt(
    strategy: string,
    marketConditions: MarketAnalysis
  ): string {
    return `
      Optimize the ${strategy} trading strategy based on current market conditions:
      
      Market Analysis:
      - Symbol: ${marketConditions.symbol}
      - Trend: ${marketConditions.trend}
      - Volatility: ${marketConditions.volatility}
      - Support Levels: ${marketConditions.support.join(', ')}
      - Resistance Levels: ${marketConditions.resistance.join(', ')}
      - Patterns: ${marketConditions.patterns.map(p => `${p.pattern} (${p.confidence})`).join(', ')}
      - Recommendation: ${marketConditions.recommendation}
      
      Please provide optimized parameters for this strategy considering:
      1. Current market volatility and trend
      2. Risk management (max 2% per trade)
      3. Daily profit target of $300
      4. Conservative position sizing
      
      Response format:
      {
        "parameters": {
          "param1": value,
          "param2": value
        },
        "expectedReturn": 0.15,
        "risk": 0.08,
        "sharpeRatio": 1.5,
        "reasoning": "...",
        "backtestRecommended": true
      }
    `;
  }

  /**
   * Generate mock optimization for development
   */
  private generateMockOptimization(
    strategy: string,
    marketConditions: MarketAnalysis
  ): ClaudeOptimizationResponse {
    const baseParams = this.getDefaultParameters(strategy);
    
    // Adjust parameters based on market conditions
    const adjustedParams = { ...baseParams };
    
    if (marketConditions.volatility === 'HIGH' || marketConditions.volatility === 'EXTREME') {
      // Reduce position sizes in high volatility
      if (adjustedParams['maxPositionSize']) {
        adjustedParams['maxPositionSize'] *= 0.7;
      }
    }
    
    if (marketConditions.trend === 'BULLISH' || marketConditions.trend === 'STRONG_BULLISH') {
      // Adjust for bullish conditions
      if (adjustedParams['takeProfitPercent']) {
        adjustedParams['takeProfitPercent'] *= 1.2;
      }
    }

    return {
      parameters: adjustedParams,
      expectedReturn: 0.12,
      risk: 0.06,
      sharpeRatio: 1.8,
      reasoning: `Optimized for ${marketConditions.volatility} volatility and ${marketConditions.trend} trend`,
      backtestRecommended: true
    };
  }

  /**
   * Get default parameters for strategy
   */
  private getDefaultParameters(strategy: string): Record<string, number> {
    const defaults: Record<string, Record<string, number>> = {
      gamma_scalping: {
        deltaHedgeThreshold: 0.05,
        gammaThreshold: 0.01,
        maxPositionSize: 10,
        stopLossPercent: 0.02,
        takeProfitPercent: 0.03
      },
      iron_condor: {
        strikeRange: 0.15,
        buyingPowerLimit: 0.05,
        targetProfitPercentage: 0.4,
        openInterestThreshold: 100
      },
      wheel: {
        strikePercentage: 0.02,
        buyingPowerLimit: 0.1,
        targetDelta: -0.3
      }
    };
    
    return defaults[strategy] || {};
  }

  /**
   * Calculate optimization confidence
   */
  private calculateOptimizationConfidence(
    response: ClaudeOptimizationResponse,
    marketConditions: MarketAnalysis
  ): number {
    let confidence = 0.7; // Base confidence
    
    // Adjust based on Sharpe ratio
    if (response.sharpeRatio > 2) {
      confidence += 0.1;
    } else if (response.sharpeRatio < 1) {
      confidence -= 0.1;
    }
    
    // Adjust based on market confidence
    confidence = (confidence + marketConditions.confidence) / 2;
    
    return Math.max(0.3, Math.min(0.95, confidence));
  }

  /**
   * Return conservative optimization on error
   */
  private getConservativeOptimization(strategy: string): StrategyOptimization {
    return {
      strategyId: strategy,
      parameters: this.getDefaultParameters(strategy),
      expectedReturn: 0.08,
      risk: 0.04,
      sharpeRatio: 1.2,
      confidence: 0.4
    };
  }
}