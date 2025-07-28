/**
 * AI Agent Type Definitions
 * Core types for the multi-agent trading system
 */

import type { MarketData, Signal } from './strategy';
import type { Order, Position } from './trading';

/**
 * Base agent types
 */
export enum AgentType {
  MARKET_ANALYST = 'MARKET_ANALYST',
  STRATEGY_OPTIMIZER = 'STRATEGY_OPTIMIZER',
  EXECUTION = 'EXECUTION',
  RISK_MANAGER = 'RISK_MANAGER',
  PERFORMANCE_ANALYST = 'PERFORMANCE_ANALYST'
}

export enum AgentStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  DECIDING = 'DECIDING',
  EXECUTING = 'EXECUTING',
  ERROR = 'ERROR'
}

/**
 * Agent communication
 */
export interface AgentMessage {
  id: string;
  from: AgentType;
  to: AgentType | 'BROADCAST';
  type: MessageType;
  payload: unknown;
  timestamp: number;
  priority: MessagePriority;
  requiresResponse?: boolean;
}

export enum MessageType {
  MARKET_UPDATE = 'MARKET_UPDATE',
  ANALYSIS_RESULT = 'ANALYSIS_RESULT',
  SIGNAL_GENERATED = 'SIGNAL_GENERATED',
  RISK_ALERT = 'RISK_ALERT',
  EXECUTION_REQUEST = 'EXECUTION_REQUEST',
  EXECUTION_RESULT = 'EXECUTION_RESULT',
  PERFORMANCE_UPDATE = 'PERFORMANCE_UPDATE',
  STRATEGY_ADJUSTMENT = 'STRATEGY_ADJUSTMENT',
  STOP_TRADING = 'STOP_TRADING'
}

export enum MessagePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Agent context and state
 */
export interface AgentContext {
  agentId: string;
  agentType: AgentType;
  status: AgentStatus;
  lastUpdate: number;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  decisionsToday: number;
  successRate: number;
  averageResponseTime: number;
  errorCount: number;
}

/**
 * Market analysis types
 */
export interface MarketAnalysis {
  timestamp: number;
  symbol: string;
  trend: MarketTrend;
  volatility: VolatilityLevel;
  patterns: PatternDetection[];
  support: number[];
  resistance: number[];
  recommendation: TradingRecommendation;
  confidence: number;
}

export enum MarketTrend {
  STRONG_BULLISH = 'STRONG_BULLISH',
  BULLISH = 'BULLISH',
  NEUTRAL = 'NEUTRAL',
  BEARISH = 'BEARISH',
  STRONG_BEARISH = 'STRONG_BEARISH'
}

export enum VolatilityLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  EXTREME = 'EXTREME'
}

export interface PatternDetection {
  pattern: string;
  confidence: number;
  priceTarget?: number;
  timeframe: string;
}

export enum TradingRecommendation {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  HOLD = 'HOLD',
  SELL = 'SELL',
  STRONG_SELL = 'STRONG_SELL'
}

/**
 * Strategy optimization types
 */
export interface StrategyOptimization {
  strategyId: string;
  parameters: Record<string, unknown>;
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
  backtestResults?: BacktestSummary;
  confidence: number;
}

export interface BacktestSummary {
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  totalTrades: number;
}

/**
 * Risk assessment types
 */
export interface RiskAssessment {
  portfolioRisk: number;
  positionRisks: PositionRisk[];
  correlationRisk: number;
  maxDrawdownRisk: number;
  alerts: RiskAlert[];
  recommendation: RiskRecommendation;
}

export interface PositionRisk {
  symbol: string;
  risk: number;
  exposure: number;
  var95: number; // Value at Risk 95%
  stopLoss?: number;
}

export interface RiskAlert {
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  action?: string;
}

export enum RiskRecommendation {
  PROCEED = 'PROCEED',
  REDUCE_SIZE = 'REDUCE_SIZE',
  HEDGE = 'HEDGE',
  CLOSE = 'CLOSE',
  STOP_TRADING = 'STOP_TRADING'
}

/**
 * Performance tracking types
 */
export interface PerformanceStatus {
  dailyPnL: number;
  dailyTarget: number;
  targetProgress: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  currentDrawdown: number;
  shouldStop: boolean;
  reason?: string;
}

/**
 * Trading decision types
 */
export interface TradingDecision {
  id: string;
  timestamp: number;
  action: TradingAction;
  signals: Signal[];
  confidence: number;
  reasoning: string;
  riskAssessment: RiskAssessment;
  expectedOutcome: ExpectedOutcome;
}

export enum TradingAction {
  ENTER_POSITION = 'ENTER_POSITION',
  EXIT_POSITION = 'EXIT_POSITION',
  ADJUST_POSITION = 'ADJUST_POSITION',
  HOLD = 'HOLD',
  WAIT = 'WAIT'
}

export interface ExpectedOutcome {
  profit: number;
  loss: number;
  probability: number;
  timeframe: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  agentType: AgentType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Agent interfaces
 */
export interface IAgent {
  id: string;
  type: AgentType;
  status: AgentStatus;
  
  initialize(): Promise<void>;
  process(message: AgentMessage): Promise<AgentMessage | null>;
  getStatus(): AgentContext;
  shutdown(): Promise<void>;
}

export interface IMarketAnalystAgent extends IAgent {
  analyzeMarket(data: MarketData[]): Promise<MarketAnalysis>;
  detectPatterns(data: MarketData[]): Promise<PatternDetection[]>;
  predictVolatility(symbol: string): Promise<VolatilityLevel>;
}

export interface IStrategyOptimizerAgent extends IAgent {
  optimizeStrategy(
    strategy: string,
    marketConditions: MarketAnalysis
  ): Promise<StrategyOptimization>;
  backtest(
    strategy: string,
    parameters: Record<string, unknown>
  ): Promise<BacktestSummary>;
}

export interface IRiskManagerAgent extends IAgent {
  assessRisk(
    positions: Position[],
    proposedTrade?: Signal
  ): Promise<RiskAssessment>;
  calculateVaR(positions: Position[]): Promise<number>;
  checkLimits(trade: Signal): Promise<boolean>;
}

export interface IPerformanceAgent extends IAgent {
  trackPerformance(): Promise<PerformanceStatus>;
  checkDailyTarget(): Promise<boolean>;
  generateReport(): Promise<string>;
}

/**
 * Agent coordinator types
 */
export interface CoordinatorState {
  agents: Map<AgentType, IAgent>;
  activeDecisions: Map<string, TradingDecision>;
  messageQueue: AgentMessage[];
  performance: PerformanceStatus;
}

export interface CoordinatorConfig {
  maxConcurrentDecisions: number;
  decisionTimeout: number;
  consensusThreshold: number;
}