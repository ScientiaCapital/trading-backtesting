/**
 * Risk Manager Agent
 * Critical safety system for portfolio risk management
 * Monitors positions, enforces limits, and triggers emergency stops
 */

import { AIAgent } from './base/BaseAgent';
import {
  AgentType,
  AgentMessage,
  IRiskManagerAgent,
  RiskAssessment,
  PositionRisk,
  RiskAlert,
  RiskRecommendation,
  MessageType,
  MessagePriority,
  AgentConfig
} from '@/types/agents';
import { Position, Signal } from '@/types/trading';
import { CloudflareBindings } from '@/types';

interface RiskAnalysisResponse {
  portfolioRisk: number;
  positionRisks: Array<{
    symbol: string;
    risk: number;
    exposure: number;
    var95: number;
    recommendation: string;
  }>;
  correlationRisk: number;
  maxDrawdownRisk: number;
  alerts: Array<{
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    action?: string;
  }>;
  overallRecommendation: RiskRecommendation;
  reasoning: string;
}

export class RiskManagerAgent extends AIAgent implements IRiskManagerAgent {
  private env?: CloudflareBindings;
  
  // Risk parameters
  private readonly MAX_PORTFOLIO_RISK = 0.02; // 2% max portfolio risk
  private readonly MAX_POSITION_RISK = 0.01; // 1% max per position
  private readonly MAX_CORRELATION_RISK = 0.7; // 70% correlation threshold
  private readonly MAX_DRAWDOWN_LIMIT = 0.05; // 5% max drawdown
  private readonly DAILY_LOSS_LIMIT = 300; // $300 daily loss limit
  
  constructor(config: AgentConfig, env?: CloudflareBindings) {
    super(AgentType.RISK_MANAGER, {
      ...config,
      model: '@cf/meta/llama-3.1-8b-instruct',
      temperature: 0.1, // Very low temperature for consistent risk assessment
      maxTokens: 2048,
      systemPrompt: `You are a professional risk manager AI for a trading system.
        Your primary responsibility is to protect capital and ensure safe trading practices.
        Analyze positions and trades for risk exposure, calculate Value at Risk (VaR),
        and provide clear recommendations to prevent losses.
        Be conservative in your assessments and prioritize capital preservation.
        Maximum daily loss limit is $${300}.`
    });
    this.env = env;
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Risk Manager Agent initialized', {
      model: this.config.model,
      agentId: this.id,
      maxPortfolioRisk: this.MAX_PORTFOLIO_RISK,
      maxPositionRisk: this.MAX_POSITION_RISK,
      dailyLossLimit: this.DAILY_LOSS_LIMIT
    });
  }

  protected async handleMessage(message: AgentMessage): Promise<AgentMessage | null> {
    switch (message.type) {
      case MessageType.EXECUTION_REQUEST:
        // Validate trade before execution
        const { positions, proposedTrade } = message.payload as {
          positions: Position[];
          proposedTrade: Signal;
        };
        
        const assessment = await this.assessRisk(positions, proposedTrade);
        
        // Send high priority alert if risk is too high
        if (assessment.recommendation === RiskRecommendation.STOP_TRADING ||
            assessment.recommendation === RiskRecommendation.CLOSE) {
          return this.createMessage(
            'BROADCAST',
            MessageType.RISK_ALERT,
            assessment,
            MessagePriority.CRITICAL
          );
        }
        
        return this.createMessage(
          message.from,
          MessageType.RISK_ALERT,
          assessment
        );
        
      case MessageType.PERFORMANCE_UPDATE:
        // Check if daily loss limit is approaching
        const { dailyPnL } = message.payload as { dailyPnL: number };
        
        if (dailyPnL <= -this.DAILY_LOSS_LIMIT * 0.8) {
          return this.createMessage(
            'BROADCAST',
            MessageType.RISK_ALERT,
            {
              level: 'WARNING',
              message: `Approaching daily loss limit: $${Math.abs(dailyPnL)} / $${this.DAILY_LOSS_LIMIT}`,
              action: 'Consider reducing position sizes'
            },
            MessagePriority.HIGH
          );
        }
        
        if (dailyPnL <= -this.DAILY_LOSS_LIMIT) {
          return this.createMessage(
            'BROADCAST',
            MessageType.STOP_TRADING,
            {
              reason: 'Daily loss limit reached',
              dailyLoss: dailyPnL
            },
            MessagePriority.CRITICAL
          );
        }
        
        return null;
        
      default:
        this.logger.debug('Ignoring message type', { type: message.type });
        return null;
    }
  }

  protected async onShutdown(): Promise<void> {
    this.logger.info('Risk Manager Agent shutting down');
  }

  /**
   * Assess risk for current positions and proposed trade
   */
  async assessRisk(
    positions: Position[],
    proposedTrade?: Signal
  ): Promise<RiskAssessment> {
    const prompt = this.buildRiskAssessmentPrompt(positions, proposedTrade);
    
    try {
      let response: RiskAnalysisResponse;
      
      if (this.env?.AI) {
        // Use Cloudflare AI binding
        const result = await this.env.AI.run(
          this.config.model as any,
          {
            prompt,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
          }
        );
        
        response = JSON.parse((result as any).response || '{}') as RiskAnalysisResponse;
      } else {
        // Fallback to calculation-based assessment
        response = this.calculateRiskMetrics(positions, proposedTrade);
      }

      // Convert to RiskAssessment format
      const positionRisks: PositionRisk[] = response.positionRisks.map(pr => ({
        symbol: pr.symbol,
        risk: pr.risk,
        exposure: pr.exposure,
        var95: pr.var95,
        stopLoss: this.calculateStopLoss(pr.symbol, positions)
      }));

      const {alerts} = response;
      
      // Add automatic alerts based on thresholds
      if (response.portfolioRisk > this.MAX_PORTFOLIO_RISK) {
        alerts.push({
          level: 'CRITICAL',
          message: `Portfolio risk (${(response.portfolioRisk * 100).toFixed(1)}%) exceeds limit (${(this.MAX_PORTFOLIO_RISK * 100).toFixed(1)}%)`,
          action: 'Reduce position sizes immediately'
        });
      }

      return {
        portfolioRisk: response.portfolioRisk,
        positionRisks,
        correlationRisk: response.correlationRisk,
        maxDrawdownRisk: response.maxDrawdownRisk,
        alerts,
        recommendation: response.overallRecommendation
      };
      
    } catch (error) {
      this.logger.error('Risk assessment failed', {
        error: (error as Error).message
      });
      
      // Return conservative risk assessment on error
      return this.getConservativeAssessment();
    }
  }

  /**
   * Calculate Value at Risk (VaR) at 95% confidence
   */
  async calculateVaR(positions: Position[]): Promise<number> {
    if (positions.length === 0) return 0;
    
    // Simplified VaR calculation
    // In production, this would use historical data and more sophisticated models
    const totalValue = positions.reduce((sum, pos) => 
      sum + (pos.quantity * pos.avgEntryPrice), 0
    );
    
    // Assume 2% daily volatility for simplification
    const dailyVolatility = 0.02;
    const confidenceLevel = 1.645; // 95% confidence
    
    return totalValue * dailyVolatility * confidenceLevel;
  }

  /**
   * Check if a trade exceeds risk limits
   */
  async checkLimits(trade: Signal): Promise<boolean> {
    // Check position size limit
    const quantity = trade.quantity || 0;
    const price = trade.price || trade.limitPrice || 0;
    const positionValue = quantity * price;
    const maxPositionValue = 10000; // $10k max per position
    
    if (positionValue > maxPositionValue) {
      this.logger.warn('Trade exceeds position size limit', {
        tradeValue: positionValue,
        limit: maxPositionValue
      });
      return false;
    }
    
    // Check if we're in a drawdown
    const currentDrawdown = await this.getCurrentDrawdown();
    if (currentDrawdown > this.MAX_DRAWDOWN_LIMIT) {
      this.logger.warn('Trading restricted due to drawdown', {
        currentDrawdown,
        limit: this.MAX_DRAWDOWN_LIMIT
      });
      return false;
    }
    
    return true;
  }

  /**
   * Build risk assessment prompt for AI
   */
  private buildRiskAssessmentPrompt(
    positions: Position[],
    proposedTrade?: Signal
  ): string {
    const positionsSummary = positions.map(p => ({
      symbol: p.symbol,
      quantity: p.quantity,
      avgPrice: p.avgEntryPrice,
      currentValue: p.quantity * p.avgEntryPrice,
      unrealizedPL: p.unrealizedPL || 0
    }));

    return `
      Analyze the following portfolio risk profile:
      
      Current Positions:
      ${JSON.stringify(positionsSummary, null, 2)}
      
      ${proposedTrade ? `
      Proposed Trade:
      - Symbol: ${proposedTrade.symbol}
      - Action: ${proposedTrade.action}
      - Quantity: ${proposedTrade.quantity}
      - Price: ${proposedTrade.price || proposedTrade.limitPrice || 'N/A'}
      ` : 'No proposed trade'}
      
      Risk Limits:
      - Max Portfolio Risk: ${(this.MAX_PORTFOLIO_RISK * 100)}%
      - Max Position Risk: ${(this.MAX_POSITION_RISK * 100)}%
      - Max Correlation Risk: ${(this.MAX_CORRELATION_RISK * 100)}%
      - Daily Loss Limit: $${this.DAILY_LOSS_LIMIT}
      
      Please provide risk assessment in JSON format:
      {
        "portfolioRisk": 0.015,
        "positionRisks": [
          {
            "symbol": "AAPL",
            "risk": 0.008,
            "exposure": 0.25,
            "var95": 150.00,
            "recommendation": "Monitor closely"
          }
        ],
        "correlationRisk": 0.45,
        "maxDrawdownRisk": 0.02,
        "alerts": [
          {
            "level": "WARNING",
            "message": "High correlation between tech positions",
            "action": "Consider diversification"
          }
        ],
        "overallRecommendation": "PROCEED",
        "reasoning": "Portfolio within risk limits"
      }
    `;
  }

  /**
   * Calculate risk metrics without AI
   */
  private calculateRiskMetrics(
    positions: Position[],
    proposedTrade?: Signal
  ): RiskAnalysisResponse {
    const totalValue = positions.reduce((sum, pos) => 
      sum + (pos.quantity * pos.avgEntryPrice), 0
    );
    
    // Calculate position risks
    const positionRisks = positions.map(pos => {
      const positionValue = pos.quantity * pos.avgEntryPrice;
      const risk = positionValue / totalValue * 0.02; // Assume 2% volatility
      
      return {
        symbol: pos.symbol,
        risk,
        exposure: positionValue / totalValue,
        var95: positionValue * 0.02 * 1.645,
        recommendation: risk > this.MAX_POSITION_RISK ? 'Reduce position' : 'Monitor'
      };
    });
    
    // Portfolio risk (simplified)
    const portfolioRisk = Math.sqrt(
      positionRisks.reduce((sum, pr) => sum + Math.pow(pr.risk, 2), 0)
    );
    
    // Determine recommendation
    let recommendation: RiskRecommendation = RiskRecommendation.PROCEED;
    const alerts: RiskAlert[] = [];
    
    if (portfolioRisk > this.MAX_PORTFOLIO_RISK) {
      recommendation = RiskRecommendation.REDUCE_SIZE;
      alerts.push({
        level: 'CRITICAL',
        message: 'Portfolio risk exceeds limit',
        action: 'Reduce positions immediately'
      });
    }
    
    if (proposedTrade) {
      const quantity = proposedTrade.quantity || 0;
      const price = proposedTrade.price || proposedTrade.limitPrice || 0;
      const tradeValue = quantity * price;
      const tradeRisk = (tradeValue / (totalValue + tradeValue)) * 0.02;
      
      if (tradeRisk > this.MAX_POSITION_RISK) {
        recommendation = RiskRecommendation.REDUCE_SIZE;
        alerts.push({
          level: 'WARNING',
          message: 'Proposed trade size too large',
          action: `Reduce quantity to ${Math.floor(quantity * 0.5)}`
        });
      }
    }

    return {
      portfolioRisk,
      positionRisks,
      correlationRisk: 0.3, // Placeholder
      maxDrawdownRisk: 0.02, // Placeholder
      alerts,
      overallRecommendation: recommendation,
      reasoning: `Portfolio risk at ${(portfolioRisk * 100).toFixed(1)}% of capital`
    };
  }

  /**
   * Calculate stop loss for a position
   */
  private calculateStopLoss(symbol: string, positions: Position[]): number | undefined {
    const position = positions.find(p => p.symbol === symbol);
    if (!position) return undefined;
    
    // Simple 2% stop loss
    return position.avgEntryPrice * 0.98;
  }

  /**
   * Get current drawdown
   */
  private async getCurrentDrawdown(): Promise<number> {
    // This would connect to performance tracking
    // For now, return 0
    return 0;
  }

  /**
   * Return conservative assessment on error
   */
  private getConservativeAssessment(): RiskAssessment {
    return {
      portfolioRisk: 1.0, // Maximum risk
      positionRisks: [],
      correlationRisk: 1.0,
      maxDrawdownRisk: 1.0,
      alerts: [{
        level: 'CRITICAL',
        message: 'Risk assessment failed - trading suspended',
        action: 'Do not trade until system is verified'
      }],
      recommendation: RiskRecommendation.STOP_TRADING
    };
  }
}