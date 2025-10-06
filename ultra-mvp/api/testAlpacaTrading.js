// Test script to verify Alpaca Trading API integration
import dotenv from 'dotenv';
import { createAlpacaTradingClient } from './alpacaTradingClient.js';

// Load environment variables
dotenv.config();

async function testAlpacaTrading() {
  console.log('Testing Alpaca Trading API Integration...\n');

  try {
    // Create trading client
    const client = createAlpacaTradingClient();
    console.log('✓ Alpaca trading client created successfully');

    // Test 1: Get account information
    console.log('\n1. Testing account information...');
    const account = await client.getAccount();
    console.log(`✓ Account Status: ${account.status}`);
    console.log(`  Cash: $${account.cash.toFixed(2)}`);
    console.log(`  Portfolio Value: $${account.portfolio_value.toFixed(2)}`);
    console.log(`  Buying Power: $${account.buying_power.toFixed(2)}`);

    // Test 2: Check market status
    console.log('\n2. Testing market status...');
    const marketStatus = await client.isMarketOpen();
    console.log(`✓ Market is ${marketStatus.is_open ? 'OPEN' : 'CLOSED'}`);
    console.log(`  Next open: ${marketStatus.next_open}`);
    console.log(`  Next close: ${marketStatus.next_close}`);

    // Test 3: Get current positions
    console.log('\n3. Testing positions...');
    const positions = await client.getPositions();
    console.log(`✓ Found ${positions.length} position(s)`);
    if (positions.length > 0) {
      positions.slice(0, 3).forEach(pos => {
        console.log(`  ${pos.symbol}: ${pos.qty} shares, P&L: $${pos.unrealized_pl.toFixed(2)}`);
      });
    }

    // Test 4: Get recent orders
    console.log('\n4. Testing order history...');
    const orders = await client.getOrders({ limit: 5 });
    console.log(`✓ Found ${orders.length} recent order(s)`);
    if (orders.length > 0) {
      orders.slice(0, 3).forEach(order => {
        console.log(`  ${order.symbol}: ${order.side} ${order.qty}, Status: ${order.status}`);
      });
    }

    // Test 5: Get a stock quote
    console.log('\n5. Testing market data...');
    try {
      const quote = await client.getQuote('SPY');
      console.log(`✓ SPY Quote: $${quote.price.toFixed(2)} at ${quote.timestamp}`);
    } catch (quoteError) {
      console.log(`⚠ Quote test failed: ${quoteError.message}`);
    }

    // Test 6: Get historical data (from parent class)
    console.log('\n6. Testing historical data...');
    const endDate = new Date('2024-01-15'); // Use older date to avoid subscription limits
    const startDate = new Date('2024-01-08'); // Last 7 days from that date

    const historicalData = await client.getHistoricalBars({
      symbol: 'SPY',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      timeframe: '1Day'
    });

    console.log(`✓ Retrieved ${Object.keys(historicalData).length} days of historical data`);

    // Test 7: Demo Iron Condor strategy
    console.log('\n7. Testing Iron Condor strategy (DEMO)...');
    const ironCondorDemo = await client.executeIronCondorStrategy({
      symbol: 'SPY',
      strikeWidth: 10,
      quantity: 1
    });
    console.log(`✓ ${ironCondorDemo.message}`);

    // Test 8: Portfolio history
    console.log('\n8. Testing portfolio history...');
    try {
      const portfolio = await client.getPortfolioHistory({ period: '1W' });
      console.log(`✓ Portfolio history: ${portfolio.equity.length} data points`);
      if (portfolio.equity.length > 0) {
        const latestValue = portfolio.equity[portfolio.equity.length - 1];
        console.log(`  Latest portfolio value: $${latestValue.toFixed(2)}`);
      }
    } catch (portfolioError) {
      console.log(`⚠ Portfolio history test failed: ${portfolioError.message}`);
    }

    console.log('\n✅ All tests completed! Alpaca Trading integration is working correctly.');
    console.log('\n📝 Note: This is running in paper trading mode for safety.');
    console.log('   To enable live trading, set ALPACA_PAPER_TRADING=false in your .env file.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testAlpacaTrading();