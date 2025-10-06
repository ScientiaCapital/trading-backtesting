// Test script to verify Alpaca API integration
import dotenv from 'dotenv';
import { createAlpacaClient } from './alpacaClient.js';

// Load environment variables
dotenv.config();

async function testAlpacaIntegration() {
  console.log('Testing Alpaca API Integration...\n');

  try {
    // Create client
    const client = createAlpacaClient();
    console.log('✓ Alpaca client created successfully');

    // Test fetching historical data for SPY
    console.log('\nFetching historical data for SPY...');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const prices = await client.getHistoricalBars({
      symbol: 'SPY',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      timeframe: '1Day'
    });

    console.log(`✓ Successfully fetched ${Object.keys(prices).length} days of price data`);
    
    // Show sample of data
    const dates = Object.keys(prices).sort();
    console.log('\nSample data (last 5 days):');
    dates.slice(-5).forEach(date => {
      console.log(`  ${date}: $${prices[date].toFixed(2)}`);
    });

    // Test error handling with invalid symbol
    console.log('\n\nTesting error handling with invalid symbol...');
    try {
      await client.getHistoricalBars({
        symbol: 'INVALID_SYMBOL_12345',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    } catch (error) {
      console.log(`✓ Error handling works: ${error.message}`);
    }

    console.log('\n✅ All tests passed! Alpaca integration is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testAlpacaIntegration();