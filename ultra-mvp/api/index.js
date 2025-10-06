import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { runIronCondorBacktest } from './ironCondorBacktest.js';
import { createAlpacaTradingClient } from './alpacaTradingClient.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['ALPACA_API_KEY', 'ALPACA_API_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please ensure your .env file contains all required Alpaca API credentials');
}

const app = express();
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_m9iGvDjzH6TV@ep-aged-star-aef9r23n-pooler.c-2.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    message: 'ULTRA Trading MVP is running',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      alpaca: 'unknown',
      trading: 'unknown'
    }
  };

  // Check database connection
  try {
    await pool.query('SELECT 1');
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'disconnected';
    health.status = 'degraded';
  }

  // Check Alpaca API credentials and trading capability
  if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
    health.services.alpaca = 'configured';
    try {
      const tradingClient = createAlpacaTradingClient();
      await tradingClient.getAccount();
      health.services.trading = 'connected';
    } catch (error) {
      health.services.trading = 'error';
      health.status = 'degraded';
    }
  } else {
    health.services.alpaca = 'not configured';
    health.services.trading = 'not configured';
    health.status = 'degraded';
  }

  res.json(health);
});

// Get recent backtests
app.get('/api/backtests', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM backtest_results ORDER BY created_at DESC LIMIT 10'
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching backtests:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch backtests' 
    });
  }
});

// Run Iron Condor backtest
app.post('/api/backtest', async (req, res) => {
  try {
    const { symbol, startDate, endDate, strikeWidth, daysToExpiry } = req.body;
    
    // Validate inputs
    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, startDate, endDate' 
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const maxAllowedDate = new Date('2025-01-04');
    
    // Log for debugging
    console.log('Backtest request:', { symbol, startDate, endDate });
    
    if (end >= maxAllowedDate) {
      return res.status(400).json({
        success: false,
        error: `End date must be before January 4, 2025. You requested: ${endDate}. No market data is available after 2025-01-03.`
      });
    }
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        error: 'Start date must be before end date'
      });
    }
    
    if (start < new Date('2020-01-01')) {
      return res.status(400).json({
        success: false,
        error: 'Start date must be after January 1, 2020'
      });
    }

    // Run backtest
    const results = await runIronCondorBacktest({
      symbol,
      startDate,
      endDate,
      strikeWidth: strikeWidth || 10,
      daysToExpiry: daysToExpiry || 30
    });

    // Check if backtest returned an error
    if (results.error) {
      return res.status(400).json({
        success: false,
        error: results.message,
        details: results.details
      });
    }
    
    // Save to database
    try {
      await pool.query(
        `INSERT INTO backtest_results (strategy, symbol, params, results, created_at) 
         VALUES ($1, $2, $3, $4, NOW())`,
        ['iron_condor', symbol, JSON.stringify(req.body), JSON.stringify(results)]
      );
    } catch (dbError) {
      console.error('Database error (non-fatal):', dbError);
      // Continue even if DB save fails
    }
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error running backtest:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to run backtest' 
    });
  }
});

// Initialize database table
app.post('/api/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS backtest_results (
        id SERIAL PRIMARY KEY,
        strategy VARCHAR(50),
        symbol VARCHAR(10),
        params JSONB,
        results JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    res.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize database' });
  }
});

// ======================
// TRADING API ENDPOINTS
// ======================

// Get account information
app.get('/api/account', async (req, res) => {
  try {
    const tradingClient = createAlpacaTradingClient();
    const account = await tradingClient.getAccount();
    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch account information' 
    });
  }
});

// Get current positions
app.get('/api/positions', async (req, res) => {
  try {
    const tradingClient = createAlpacaTradingClient();
    const positions = await tradingClient.getPositions();
    res.json({
      success: true,
      data: positions
    });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch positions' 
    });
  }
});

// Get orders
app.get('/api/orders', async (req, res) => {
  try {
    const { status = 'all', limit = 50 } = req.query;
    const tradingClient = createAlpacaTradingClient();
    const orders = await tradingClient.getOrders({ 
      status: status, 
      limit: parseInt(limit) 
    });
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch orders' 
    });
  }
});

// Place market order
app.post('/api/orders/market', async (req, res) => {
  try {
    const { symbol, qty, side, timeInForce } = req.body;
    
    if (!symbol || !qty || !side) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, qty, side' 
      });
    }

    const tradingClient = createAlpacaTradingClient();
    const order = await tradingClient.placeMarketOrder({
      symbol,
      qty,
      side,
      timeInForce
    });

    res.json({
      success: true,
      data: order,
      message: `Market ${side} order placed for ${qty} shares of ${symbol}`
    });
  } catch (error) {
    console.error('Error placing market order:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to place market order' 
    });
  }
});

// Place limit order
app.post('/api/orders/limit', async (req, res) => {
  try {
    const { symbol, qty, side, limitPrice, timeInForce } = req.body;
    
    if (!symbol || !qty || !side || !limitPrice) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, qty, side, limitPrice' 
      });
    }

    const tradingClient = createAlpacaTradingClient();
    const order = await tradingClient.placeLimitOrder({
      symbol,
      qty,
      side,
      limitPrice,
      timeInForce
    });

    res.json({
      success: true,
      data: order,
      message: `Limit ${side} order placed for ${qty} shares of ${symbol} at $${limitPrice}`
    });
  } catch (error) {
    console.error('Error placing limit order:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to place limit order' 
    });
  }
});

// Cancel order
app.delete('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const tradingClient = createAlpacaTradingClient();
    const result = await tradingClient.cancelOrder(orderId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to cancel order' 
    });
  }
});

// Cancel all orders
app.delete('/api/orders', async (req, res) => {
  try {
    const tradingClient = createAlpacaTradingClient();
    const result = await tradingClient.cancelAllOrders();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error cancelling all orders:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to cancel all orders' 
    });
  }
});

// Get stock quote
app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const tradingClient = createAlpacaTradingClient();
    const quote = await tradingClient.getQuote(symbol);
    
    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch quote' 
    });
  }
});

// Get market status
app.get('/api/market/status', async (req, res) => {
  try {
    const tradingClient = createAlpacaTradingClient();
    const status = await tradingClient.isMarketOpen();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching market status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch market status' 
    });
  }
});

// Get portfolio history
app.get('/api/portfolio/history', async (req, res) => {
  try {
    const { period = '1M', timeframe = '1D' } = req.query;
    const tradingClient = createAlpacaTradingClient();
    const history = await tradingClient.getPortfolioHistory({ period, timeframe });
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch portfolio history' 
    });
  }
});

// Execute Iron Condor strategy (demo)
app.post('/api/strategies/iron-condor', async (req, res) => {
  try {
    const { symbol, strikeWidth, quantity } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ 
        success: false, 
        error: 'Symbol is required' 
      });
    }

    const tradingClient = createAlpacaTradingClient();
    const result = await tradingClient.executeIronCondorStrategy({
      symbol,
      strikeWidth: strikeWidth || 10,
      quantity: quantity || 1
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error executing Iron Condor strategy:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to execute Iron Condor strategy' 
    });
  }
});

// Vercel serverless function export
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`ULTRA Trading MVP running on http://localhost:${PORT}`);
  });
}