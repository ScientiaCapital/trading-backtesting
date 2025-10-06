// Enhanced Alpaca Trading Client for ULTRA Trading MVP
// Combines data fetching with actual trading capabilities
import Alpaca from '@alpacahq/alpaca-trade-api';
import { AlpacaClient } from './alpacaClient.js';

export class AlpacaTradingClient extends AlpacaClient {
  constructor(apiKey, apiSecret, endpoint, paper = true) {
    super(apiKey, apiSecret, endpoint);
    
    // Initialize trading client
    this.alpaca = new Alpaca({
      keyId: apiKey,
      secretKey: apiSecret,
      paper: paper,
      usePolygon: false // Use Alpaca data instead of Polygon
    });
  }

  /**
   * Get account information
   */
  async getAccount() {
    try {
      const account = await this.alpaca.getAccount();
      return {
        id: account.id,
        cash: parseFloat(account.cash),
        portfolio_value: parseFloat(account.portfolio_value),
        buying_power: parseFloat(account.buying_power),
        equity: parseFloat(account.equity),
        day_trade_count: account.day_trade_count,
        account_blocked: account.account_blocked,
        trading_blocked: account.trading_blocked,
        status: account.status
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get current positions
   */
  async getPositions() {
    try {
      const positions = await this.alpaca.getPositions();
      return positions.map(pos => ({
        symbol: pos.symbol,
        qty: parseFloat(pos.qty),
        avg_entry_price: parseFloat(pos.avg_entry_price),
        market_value: parseFloat(pos.market_value),
        cost_basis: parseFloat(pos.cost_basis),
        unrealized_pl: parseFloat(pos.unrealized_pl),
        unrealized_plpc: parseFloat(pos.unrealized_plpc),
        side: pos.side
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Place a market order
   */
  async placeMarketOrder({ symbol, qty, side, timeInForce = 'gtc' }) {
    if (!symbol || !qty || !side) {
      throw new Error('Symbol, quantity, and side are required for market orders');
    }

    if (!['buy', 'sell'].includes(side.toLowerCase())) {
      throw new Error('Side must be either "buy" or "sell"');
    }

    try {
      const order = await this.alpaca.createOrder({
        symbol: symbol.toUpperCase(),
        qty: Math.abs(qty),
        side: side.toLowerCase(),
        type: 'market',
        time_in_force: timeInForce
      });

      return {
        id: order.id,
        symbol: order.symbol,
        qty: parseFloat(order.qty),
        side: order.side,
        type: order.order_type,
        status: order.status,
        submitted_at: order.submitted_at,
        filled_at: order.filled_at,
        filled_avg_price: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder({ symbol, qty, side, limitPrice, timeInForce = 'gtc' }) {
    if (!symbol || !qty || !side || !limitPrice) {
      throw new Error('Symbol, quantity, side, and limit price are required for limit orders');
    }

    if (!['buy', 'sell'].includes(side.toLowerCase())) {
      throw new Error('Side must be either "buy" or "sell"');
    }

    try {
      const order = await this.alpaca.createOrder({
        symbol: symbol.toUpperCase(),
        qty: Math.abs(qty),
        side: side.toLowerCase(),
        type: 'limit',
        limit_price: limitPrice,
        time_in_force: timeInForce
      });

      return {
        id: order.id,
        symbol: order.symbol,
        qty: parseFloat(order.qty),
        side: order.side,
        type: order.order_type,
        limit_price: parseFloat(order.limit_price),
        status: order.status,
        submitted_at: order.submitted_at
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get all orders (optionally filter by status)
   */
  async getOrders({ status = 'all', limit = 50 } = {}) {
    try {
      const orders = await this.alpaca.getOrders({
        status: status,
        limit: limit,
        direction: 'desc'
      });

      return orders.map(order => ({
        id: order.id,
        symbol: order.symbol,
        qty: parseFloat(order.qty),
        filled_qty: parseFloat(order.filled_qty || 0),
        side: order.side,
        type: order.order_type,
        status: order.status,
        limit_price: order.limit_price ? parseFloat(order.limit_price) : null,
        stop_price: order.stop_price ? parseFloat(order.stop_price) : null,
        submitted_at: order.submitted_at,
        filled_at: order.filled_at,
        filled_avg_price: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId) {
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    try {
      await this.alpaca.cancelOrder(orderId);
      return { success: true, message: `Order ${orderId} cancelled successfully` };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Cancel all orders
   */
  async cancelAllOrders() {
    try {
      await this.alpaca.cancelAllOrders();
      return { success: true, message: 'All orders cancelled successfully' };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get portfolio history
   */
  async getPortfolioHistory({ period = '1M', timeframe = '1D' } = {}) {
    try {
      const history = await this.alpaca.getPortfolioHistory({
        period: period,
        timeframe: timeframe
      });

      return {
        timestamp: history.timestamp,
        equity: history.equity.map(e => parseFloat(e)),
        profit_loss: history.profit_loss?.map(pl => parseFloat(pl)) || [],
        profit_loss_pct: history.profit_loss_pct?.map(plp => parseFloat(plp)) || [],
        base_value: parseFloat(history.base_value),
        timeframe: history.timeframe
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get current market quote for a symbol
   */
  async getQuote(symbol) {
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    try {
      const quote = await this.alpaca.getLatestTrade(symbol.toUpperCase());
      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(quote.Price),
        size: quote.Size,
        timestamp: quote.Timestamp,
        conditions: quote.Conditions
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Check if market is open
   */
  async isMarketOpen() {
    try {
      const clock = await this.alpaca.getClock();
      return {
        is_open: clock.is_open,
        next_open: clock.next_open,
        next_close: clock.next_close,
        timestamp: clock.timestamp
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get market calendar
   */
  async getCalendar({ start, end } = {}) {
    try {
      const calendar = await this.alpaca.getCalendar({
        start: start,
        end: end
      });

      return calendar.map(day => ({
        date: day.date,
        open: day.open,
        close: day.close,
        session_open: day.session_open,
        session_close: day.session_close
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Execute an Iron Condor strategy (demo implementation)
   */
  async executeIronCondorStrategy({ symbol, strikeWidth = 10, quantity = 1 }) {
    console.log(`[DEMO MODE] Would execute Iron Condor strategy for ${symbol}`);
    console.log(`Strike Width: $${strikeWidth}, Quantity: ${quantity}`);
    
    // Get current price
    const quote = await this.getQuote(symbol);
    const currentPrice = quote.price;
    
    // Calculate Iron Condor strikes
    const strikes = {
      longPut: currentPrice - strikeWidth * 2,
      shortPut: currentPrice - strikeWidth,
      shortCall: currentPrice + strikeWidth,
      longCall: currentPrice + strikeWidth * 2
    };

    console.log('Iron Condor Structure:', strikes);
    
    // In a real implementation, you would:
    // 1. Check options availability
    // 2. Calculate option prices
    // 3. Place the four leg orders
    // 4. Monitor and manage the position
    
    return {
      strategy: 'iron_condor',
      symbol: symbol,
      current_price: currentPrice,
      strikes: strikes,
      status: 'demo_only',
      message: 'This is a demo implementation. Real options trading requires additional setup.'
    };
  }
}

/**
 * Create a singleton trading client with environment variables
 */
export function createAlpacaTradingClient() {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_API_SECRET;
  const endpoint = process.env.ALPACA_API_ENDPOINT || 'https://paper-api.alpaca.markets';
  const paper = process.env.ALPACA_PAPER_TRADING !== 'false'; // Default to paper trading

  if (!apiKey || !apiSecret) {
    throw new Error('Alpaca API credentials not found in environment variables');
  }

  return new AlpacaTradingClient(apiKey, apiSecret, endpoint, paper);
}