/**
 * ULTRA Trading Platform Test Script
 * Tests all major functionality
 */

import type { ApiResponse } from '../src/types/index';

const PLATFORM_API_BASE = 'http://localhost:8787/api/v1';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): Promise<void> {
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow
  };
  console.log(`${colorMap[type]}${message}${colors.reset}`);
}

async function testEndpoint(name: string, method: string, endpoint: string, body?: any): Promise<any> {
  log(`\nTesting ${name}...`, 'info');
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${PLATFORM_API_BASE}${endpoint}`, options);
    const data = await response.json();
    
    if (data.success) {
      log(`✓ ${name} - SUCCESS`, 'success');
      console.log(JSON.stringify(data.data, null, 2));
      return data.data;
    } else {
      log(`✗ ${name} - FAILED: ${data.error?.message || 'Unknown error'}`, 'error');
      return null;
    }
  } catch (error) {
    log(`✗ ${name} - ERROR: ${error}`, 'error');
    return null;
  }
}

async function runTests(): Promise<void> {
  log('\n🚀 ULTRA Trading Platform Test Suite', 'info');
  log('=====================================\n', 'info');
  
  // Test 1: Health Check
  await testEndpoint('Health Check', 'GET', '/health/ping');
  
  // Test 2: Market Time Status
  const marketTime = await testEndpoint('Market Time Status', 'GET', '/market-time/status');
  if (marketTime) {
    log(`Market is ${marketTime.status.isOpen ? 'OPEN' : 'CLOSED'}`, marketTime.status.isOpen ? 'success' : 'warning');
    log(`Session Progress: ${marketTime.status.sessionProgress}%`, 'info');
  }
  
  // Test 3: Trading Status
  const tradingStatus = await testEndpoint('Trading Status', 'GET', '/trading/status');
  if (tradingStatus) {
    log(`Buying Power: $${tradingStatus.buyingPower}`, 'info');
    log(`Portfolio Value: $${tradingStatus.portfolioValue}`, 'info');
  }
  
  // Test 4: Market Clock
  await testEndpoint('Market Clock', 'GET', '/trading/clock');
  
  // Test 5: Account Info
  await testEndpoint('Account Info', 'GET', '/trading/account');
  
  // Test 6: Positions
  const positions = await testEndpoint('Current Positions', 'GET', '/trading/positions');
  if (positions && positions.length > 0) {
    log(`Found ${positions.length} positions`, 'info');
  }
  
  // Test 7: Agent Status (may fail if not initialized)
  await testEndpoint('Agent Team Status', 'GET', '/agents/status');
  
  // Test 8: Test Market Analysis
  await testEndpoint('Market Analysis Test', 'POST', '/agents/test/market-analysis');
  
  // Test 9: Fast Decision Performance
  await testEndpoint('Fast Decision Test', 'POST', '/agents/test/fast-decision', {
    iterations: 3
  });
  
  // Test 10: Market Countdown
  const countdown = await testEndpoint('Market Countdown', 'GET', '/market-time/countdown');
  if (countdown?.countdowns) {
    Object.entries(countdown.countdowns).forEach(([key, value]: [string, any]) => {
      log(`${key}: ${value.formatted}`, 'info');
    });
  }
  
  log('\n=====================================', 'info');
  log('✅ Test Suite Complete', 'success');
}

// Run the tests
runTests().catch(error => {
  log(`\n❌ Test Suite Failed: ${error}`, 'error');
  process.exit(1);
});