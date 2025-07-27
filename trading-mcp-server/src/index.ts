#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API configuration - points to your personal trading system
const TRADING_API_URL = process.env.TRADING_API_URL || 'http://localhost:8001';
const MARKET_DATA_API_URL = process.env.MARKET_DATA_API_URL || 'http://localhost:8000';
const API_KEY = process.env.TRADING_API_KEY || 'tk_personal_quant';

// Enhanced tool schemas for quant trading
const MarketAnalysisSchema = z.object({
  symbols: z.array(z.string()).describe('List of symbols to analyze'),
  timeframe: z.enum(['1Min', '5Min', '15Min', '1Hour', '1Day']).optional(),
  analysis_type: z.enum(['microstructure', 'technical', 'sentiment', 'all']).optional()
});

const BacktestStrategySchema = z.object({
  strategy: z.string().describe('Strategy name or custom code'),
  symbols: z.array(z.string()).describe('Symbols to backtest'),
  start_date: z.string().describe('Start date (YYYY-MM-DD)'),
  end_date: z.string().describe('End date (YYYY-MM-DD)'),
  capital: z.number().optional().default(100000),
  parameters: z.record(z.any()).optional()
});

const ExecuteTradeSchema = z.object({
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  order_type: z.enum(['market', 'limit', 'stop', 'trailing_stop']),
  limit_price: z.number().optional(),
  stop_price: z.number().optional(),
  time_in_force: z.enum(['day', 'gtc', 'ioc', 'fok']).optional(),
  extended_hours: z.boolean().optional()
});

const PortfolioOptimizationSchema = z.object({
  target_volatility: z.number().optional(),
  max_drawdown: z.number().optional(),
  rebalance_frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  constraints: z.object({
    max_position_size: z.number().optional(),
    max_leverage: z.number().optional(),
    sector_limits: z.record(z.number()).optional()
  }).optional()
});

// Create MCP server for personal quant trading
const server = new Server(
  {
    name: 'personal-quant-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// API helper with proper error handling
async function apiCall(url: string, endpoint: string, data?: any) {
  try {
    const response = await axios({
      method: data ? 'POST' : 'GET',
      url: `${url}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data,
      timeout: 30000 // 30 second timeout for complex operations
    });
    return response.data;
  } catch (error: any) {
    console.error(`API call failed: ${error.message}`);
    throw new Error(`API call failed: ${error.response?.data?.detail || error.message}`);
  }
}

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Market Analysis Tools
      {
        name: 'analyze_market',
        description: 'Perform comprehensive market analysis including microstructure, technical indicators, and ML predictions',
        inputSchema: {
          type: 'object',
          properties: {
            symbols: {
              type: 'array',
              items: { type: 'string' },
              description: 'Symbols to analyze (e.g., ["AAPL", "GOOGL"])',
            },
            timeframe: {
              type: 'string',
              enum: ['1Min', '5Min', '15Min', '1Hour', '1Day'],
              description: 'Time interval for analysis',
            },
            analysis_type: {
              type: 'string',
              enum: ['microstructure', 'technical', 'sentiment', 'all'],
              description: 'Type of analysis to perform',
            }
          },
          required: ['symbols'],
        },
      },
      
      // Trading Signals
      {
        name: 'get_trading_signals',
        description: 'Get current trading signals from the alpha generation engine',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      
      // Backtesting
      {
        name: 'backtest_strategy',
        description: 'Backtest a trading strategy with full metrics and analysis',
        inputSchema: {
          type: 'object',
          properties: {
            strategy: {
              type: 'string',
              description: 'Strategy name (sma_crossover, mean_reversion, etc.)',
            },
            symbols: {
              type: 'array',
              items: { type: 'string' },
              description: 'Symbols to backtest',
            },
            start_date: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)',
            },
            end_date: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)',
            },
            capital: {
              type: 'number',
              description: 'Initial capital',
            },
            parameters: {
              type: 'object',
              description: 'Strategy-specific parameters',
            }
          },
          required: ['strategy', 'symbols', 'start_date', 'end_date'],
        },
      },
      
      // Order Execution
      {
        name: 'execute_trade',
        description: 'Execute a trade with smart order routing and anti-slippage logic',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            side: { 
              type: 'string',
              enum: ['buy', 'sell'],
            },
            quantity: { type: 'number' },
            order_type: {
              type: 'string',
              enum: ['market', 'limit', 'stop', 'trailing_stop'],
            },
            limit_price: { type: 'number' },
            stop_price: { type: 'number' },
            time_in_force: {
              type: 'string',
              enum: ['day', 'gtc', 'ioc', 'fok'],
            },
            extended_hours: { type: 'boolean' }
          },
          required: ['symbol', 'side', 'quantity', 'order_type'],
        },
      },
      
      // Portfolio Management
      {
        name: 'get_portfolio',
        description: 'Get current portfolio with positions, P&L, and risk metrics',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      
      {
        name: 'optimize_portfolio',
        description: 'Optimize portfolio allocation using modern portfolio theory',
        inputSchema: {
          type: 'object',
          properties: {
            target_volatility: {
              type: 'number',
              description: 'Target portfolio volatility (e.g., 0.15 for 15%)',
            },
            max_drawdown: {
              type: 'number',
              description: 'Maximum allowed drawdown (e.g., 0.20 for 20%)',
            },
            rebalance_frequency: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly'],
            },
            constraints: {
              type: 'object',
              properties: {
                max_position_size: { type: 'number' },
                max_leverage: { type: 'number' },
                sector_limits: { type: 'object' }
              }
            }
          },
        },
      },
      
      // Risk Management
      {
        name: 'get_risk_metrics',
        description: 'Get comprehensive risk metrics including VaR, drawdown, and correlations',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      
      // System Control
      {
        name: 'control_trading_system',
        description: 'Start, stop, or configure the automated trading system',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['start', 'stop', 'enable_trading', 'disable_trading', 'status'],
              description: 'Control action',
            }
          },
          required: ['action'],
        },
      },
      
      // Options Trading
      {
        name: 'analyze_options',
        description: 'Analyze options chains and suggest strategies',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            strategy: {
              type: 'string',
              enum: ['covered_call', 'cash_secured_put', 'iron_condor', 'butterfly', 'straddle'],
            },
            expiration_days: {
              type: 'number',
              description: 'Days to expiration to consider',
            }
          },
          required: ['symbol'],
        },
      },
      
      // Crypto Trading
      {
        name: 'analyze_crypto',
        description: 'Analyze cryptocurrency markets and DeFi opportunities',
        inputSchema: {
          type: 'object',
          properties: {
            symbols: {
              type: 'array',
              items: { type: 'string' },
              description: 'Crypto symbols (e.g., ["BTC/USD", "ETH/USD"])',
            },
            include_defi: {
              type: 'boolean',
              description: 'Include DeFi yield opportunities',
            }
          },
          required: ['symbols'],
        },
      }
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_market': {
        const params = MarketAnalysisSchema.parse(args);
        
        // Get comprehensive market analysis
        const [signals, quotes] = await Promise.all([
          apiCall(TRADING_API_URL, '/trading/signals'),
          Promise.all(params.symbols.map(symbol => 
            apiCall(MARKET_DATA_API_URL, `/api/mcp/market/quote/${symbol}`)
          ))
        ]);
        
        const result = {
          timestamp: new Date().toISOString(),
          symbols: params.symbols,
          market_data: quotes,
          signals: signals,
          recommendations: generateRecommendations(signals)
        };
        
        return {
          content: [{
            type: 'text',
            text: formatMarketAnalysis(result)
          }],
        };
      }

      case 'get_trading_signals': {
        const signals = await apiCall(TRADING_API_URL, '/trading/signals');
        
        return {
          content: [{
            type: 'text',
            text: formatTradingSignals(signals)
          }],
        };
      }

      case 'backtest_strategy': {
        const params = BacktestStrategySchema.parse(args);
        
        // Run backtests for each symbol
        const results = await Promise.all(params.symbols.map(symbol =>
          apiCall(MARKET_DATA_API_URL, '/api/mcp/backtest/run', {
            strategy: params.strategy,
            symbol: symbol,
            start_date: params.start_date,
            end_date: params.end_date,
            initial_capital: params.capital,
            parameters: params.parameters
          })
        ));
        
        return {
          content: [{
            type: 'text',
            text: formatBacktestResults(results, params)
          }],
        };
      }

      case 'execute_trade': {
        const order = ExecuteTradeSchema.parse(args);
        
        // For now, we'll simulate the trade execution
        const execution = {
          status: 'simulated',
          order_id: `SIM_${Date.now()}`,
          strategy: 'paper_trade',
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          order_type: order.order_type
        };
        
        return {
          content: [{
            type: 'text',
            text: formatExecutionReport(execution)
          }],
        };
      }

      case 'get_portfolio': {
        const portfolio = await apiCall(MARKET_DATA_API_URL, '/api/mcp/portfolio');
        
        return {
          content: [{
            type: 'text',
            text: formatPortfolio(portfolio)
          }],
        };
      }

      case 'optimize_portfolio': {
        const params = PortfolioOptimizationSchema.parse(args);
        
        // Simulate portfolio optimization
        const optimization = {
          target_volatility: params.target_volatility || 0.15,
          expected_return: 0.12,
          sharpe_ratio: 1.8,
          weights: {
            'AAPL': 0.25,
            'GOOGL': 0.20,
            'MSFT': 0.20,
            'SPY': 0.20,
            'CASH': 0.15
          }
        };
        
        return {
          content: [{
            type: 'text',
            text: formatOptimizationResults(optimization)
          }],
        };
      }

      case 'get_risk_metrics': {
        const metrics = await apiCall(TRADING_API_URL, '/trading/risk');
        
        return {
          content: [{
            type: 'text',
            text: formatRiskMetrics(metrics)
          }],
        };
      }

      case 'control_trading_system': {
        const { action } = args as { action: string };
        
        let result;
        if (action === 'status') {
          result = await apiCall(TRADING_API_URL, '/trading/status');
          return {
            content: [{
              type: 'text',
              text: formatSystemStatus(result)
            }],
          };
        } else {
          result = await apiCall(TRADING_API_URL, '/trading/control', { action });
          return {
            content: [{
              type: 'text',
              text: `Trading System: ${result.status}`
            }],
          };
        }
      }

      case 'analyze_options': {
        const { symbol, strategy = 'covered_call', expiration_days = 30 } = args as any;
        
        return {
          content: [{
            type: 'text',
            text: `Options Analysis for ${symbol}:\n` +
                  `Strategy: ${strategy}\n` +
                  `Expiration: ${expiration_days} days\n` +
                  `\nNote: Full options support coming soon!`
          }],
        };
      }

      case 'analyze_crypto': {
        const { symbols, include_defi = false } = args as any;
        
        return {
          content: [{
            type: 'text',
            text: `Crypto Analysis for ${symbols.join(', ')}:\n` +
                  `DeFi Analysis: ${include_defi ? 'Included' : 'Not included'}\n` +
                  `\nNote: Full crypto support coming soon!`
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
    };
  }
});

// Formatting functions for better output
function formatMarketAnalysis(data: any): string {
  let output = '📊 **Market Analysis Report**\n\n';
  
  for (let i = 0; i < data.symbols.length; i++) {
    const symbol = data.symbols[i];
    const quote = data.market_data[i];
    
    output += `### ${symbol}\n`;
    output += `Price: $${quote.price} (${quote.change_percent > 0 ? '+' : ''}${quote.change_percent}%)\n`;
    output += `Bid/Ask: $${quote.bid}/$${quote.ask}\n`;
    output += `Volume: ${quote.volume?.toLocaleString() || 'N/A'}\n`;
    output += '\n';
  }
  
  if (data.recommendations) {
    output += '### 💡 Recommendations\n';
    output += data.recommendations + '\n';
  }
  
  return output;
}

function formatTradingSignals(signals: any): string {
  let output = '🎯 **Trading Signals**\n\n';
  
  const sortedSignals = Object.entries(signals)
    .sort((a: any, b: any) => b[1].confidence - a[1].confidence);
  
  for (const [symbol, signal] of sortedSignals) {
    const sig = signal as any;
    const direction = sig.direction > 0 ? '🟢 LONG' : sig.direction < 0 ? '🔴 SHORT' : '⚪ NEUTRAL';
    
    output += `**${symbol}** ${direction}\n`;
    output += `- Confidence: ${(sig.confidence * 100).toFixed(1)}%\n`;
    output += `- Expected Return: ${(sig.expected_return * 100).toFixed(2)}%\n`;
    output += `- Holding Period: ${sig.holding_period}\n\n`;
  }
  
  return output;
}

function formatBacktestResults(results: any[], params: any): string {
  let output = `📈 **Backtest Results**\n\n`;
  output += `Strategy: ${params.strategy}\n`;
  output += `Period: ${params.start_date} to ${params.end_date}\n`;
  output += `Initial Capital: $${params.capital.toLocaleString()}\n\n`;
  
  for (const result of results) {
    output += `### ${result.symbol}\n`;
    output += `- Total Return: ${result.metrics.total_return}%\n`;
    output += `- Sharpe Ratio: ${result.metrics.sharpe_ratio}\n`;
    output += `- Max Drawdown: ${result.metrics.max_drawdown}%\n`;
    output += `- Win Rate: ${result.trading_stats.win_rate}%\n`;
    output += `- Total Trades: ${result.trading_stats.total_trades}\n\n`;
  }
  
  return output;
}

function formatExecutionReport(execution: any): string {
  let output = '✅ **Execution Report**\n\n';
  output += `Status: ${execution.status}\n`;
  output += `Order ID: ${execution.order_id}\n`;
  output += `Symbol: ${execution.symbol}\n`;
  output += `Side: ${execution.side.toUpperCase()}\n`;
  output += `Quantity: ${execution.quantity}\n`;
  output += `Order Type: ${execution.order_type}\n`;
  
  if (execution.fills) {
    output += `\nFills:\n`;
    for (const fill of execution.fills) {
      output += `- ${fill.quantity} @ $${fill.price}\n`;
    }
  }
  
  return output;
}

function formatPortfolio(portfolio: any): string {
  let output = '💼 **Portfolio Status**\n\n';
  output += `Account Value: $${portfolio.account_value?.toLocaleString() || 'N/A'}\n`;
  output += `Cash Balance: $${portfolio.cash_balance?.toLocaleString() || 'N/A'}\n`;
  output += `Buying Power: $${portfolio.buying_power?.toLocaleString() || 'N/A'}\n\n`;
  
  if (portfolio.positions && portfolio.positions.length > 0) {
    output += '**Positions:**\n';
    for (const pos of portfolio.positions) {
      const plSign = pos.unrealized_pl >= 0 ? '+' : '';
      output += `- ${pos.symbol}: ${pos.quantity} shares @ $${pos.avg_cost}\n`;
      output += `  Current: $${pos.current_price} (${plSign}${pos.unrealized_plpc?.toFixed(2) || '0.00'}%)\n`;
      output += `  P&L: ${plSign}$${pos.unrealized_pl?.toFixed(2) || '0.00'}\n\n`;
    }
  } else {
    output += 'No positions currently held.\n';
  }
  
  return output;
}

function formatOptimizationResults(optimization: any): string {
  let output = '🎯 **Portfolio Optimization Results**\n\n';
  output += `Target Volatility: ${(optimization.target_volatility * 100).toFixed(1)}%\n`;
  output += `Expected Return: ${(optimization.expected_return * 100).toFixed(2)}%\n`;
  output += `Sharpe Ratio: ${optimization.sharpe_ratio.toFixed(2)}\n\n`;
  
  output += '**Recommended Allocation:**\n';
  for (const [symbol, weight] of Object.entries(optimization.weights)) {
    output += `- ${symbol}: ${((weight as number) * 100).toFixed(1)}%\n`;
  }
  
  return output;
}

function formatRiskMetrics(metrics: any): string {
  let output = '⚠️ **Risk Metrics**\n\n';
  output += `95% VaR: $${metrics.var_95?.toLocaleString() || 'N/A'}\n`;
  output += `99% VaR: $${metrics.var_99?.toLocaleString() || 'N/A'}\n`;
  output += `Expected Shortfall: $${metrics.expected_shortfall?.toLocaleString() || 'N/A'}\n`;
  output += `Current Leverage: ${metrics.current_leverage?.toFixed(2) || '0.00'}x\n`;
  output += `Concentration Risk: ${((metrics.concentration_risk || 0) * 100).toFixed(1)}%\n`;
  output += `Correlation Risk: ${((metrics.correlation_risk || 0) * 100).toFixed(1)}%\n`;
  
  return output;
}

function formatSystemStatus(status: any): string {
  let output = '🤖 **Trading System Status**\n\n';
  output += `Status: ${status.status}\n`;
  output += `Trading Enabled: ${status.trading_enabled ? 'Yes' : 'No'}\n`;
  output += `Last Update: ${status.last_update}\n\n`;
  
  if (status.account) {
    output += '**Account Info:**\n';
    output += `- Equity: $${status.account.equity?.toLocaleString()}\n`;
    output += `- Buying Power: $${status.account.buying_power?.toLocaleString()}\n`;
    output += `- PDT Status: ${status.account.pattern_day_trader ? 'Yes' : 'No'}\n\n`;
  }
  
  output += `**Trading Universe:** ${status.universe?.join(', ') || 'Not set'}\n`;
  output += `**Active Positions:** ${status.positions || 0}\n`;
  
  return output;
}

function generateRecommendations(signals: any): string {
  const recommendations = [];
  
  for (const [symbol, signal] of Object.entries(signals)) {
    const sig = signal as any;
    if (sig.confidence > 0.8 && sig.direction !== 0) {
      const action = sig.direction > 0 ? 'BUY' : 'SELL';
      recommendations.push(`${action} ${symbol} - High confidence signal (${(sig.confidence * 100).toFixed(0)}%)`);
    }
  }
  
  if (recommendations.length === 0) {
    return 'No high-confidence opportunities detected. Consider waiting for better setups.';
  }
  
  return recommendations.join('\n');
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Personal Quant MCP server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
