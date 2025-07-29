/**
 * Test script for Smart Fast Decision Service
 * Validates decision quality improvements
 */

const API_BASE = process.env.API_BASE || 'https://ultra-trading.tkipper.workers.dev/api/v1';

// Sample market data scenarios
const marketScenarios = {
  bullish: {
    name: "Bullish Market - Good Setup",
    marketData: [
      {
        symbol: 'SPY',
        price: 450.25,
        bid: 450.20,
        ask: 450.30,
        volume: 95000000,
        change: 0.015, // 1.5% up
        rsi: 45, // Room to run
        macd: 0.8,
        bb: { upper: 452, middle: 448, lower: 444 },
        vwap: 449.50,
        atr: 2.5
      }
    ],
    positions: [],
    dailyPnL: 50
  },
  
  overbought: {
    name: "Overbought Market - Should Wait",
    marketData: [
      {
        symbol: 'SPY',
        price: 455.00,
        bid: 454.90,
        ask: 455.10,
        volume: 120000000,
        change: 0.025, // 2.5% up
        rsi: 82, // Very overbought
        macd: 2.1,
        bb: { upper: 452, middle: 448, lower: 444 },
        vwap: 451.00,
        atr: 3.5
      }
    ],
    positions: [],
    dailyPnL: 150
  },
  
  highVolatility: {
    name: "High Volatility - Risk Management",
    marketData: [
      {
        symbol: 'SPY',
        price: 445.00,
        bid: 444.50,
        ask: 445.50,
        volume: 150000000,
        change: -0.018, // -1.8% down
        rsi: 35,
        macd: -1.2,
        bb: { upper: 452, middle: 448, lower: 444 },
        vwap: 447.00,
        atr: 5.2 // High volatility
      }
    ],
    positions: [],
    dailyPnL: -100
  },
  
  wideSpread: {
    name: "Wide Spread - Poor Entry",
    marketData: [
      {
        symbol: 'SPY',
        price: 448.00,
        bid: 447.50,
        ask: 448.50, // Wide spread
        volume: 60000000,
        change: 0.005,
        rsi: 50,
        macd: 0.1,
        bb: { upper: 452, middle: 448, lower: 444 },
        vwap: 448.00,
        atr: 2.0
      }
    ],
    positions: [],
    dailyPnL: 25
  },
  
  maxPositions: {
    name: "Max Positions - Should Block",
    marketData: [
      {
        symbol: 'SPY',
        price: 449.00,
        bid: 448.95,
        ask: 449.05,
        volume: 80000000,
        change: 0.008,
        rsi: 55,
        macd: 0.3,
        bb: { upper: 452, middle: 448, lower: 444 },
        vwap: 448.50,
        atr: 2.2
      }
    ],
    positions: [
      { symbol: 'AAPL', qty: '100', market_value: '18000' },
      { symbol: 'MSFT', qty: '50', market_value: '19000' },
      { symbol: 'GOOGL', qty: '20', market_value: '17000' },
      { symbol: 'AMZN', qty: '30', market_value: '16000' },
      { symbol: 'NVDA', qty: '40', market_value: '20000' }
    ] as any,
    dailyPnL: 120
  }
};

async function testDecision(scenario: any) {
  console.log(`\n📊 Testing: ${scenario.name}`);
  console.log('─'.repeat(50));
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/agents/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        context: {
          marketData: scenario.marketData,
          positions: scenario.positions,
          dailyPnL: scenario.dailyPnL,
          account: { portfolio_value: 100000 }
        },
        useQuickDecision: true
      })
    });
    
    const decision = await response.json();
    const elapsed = Date.now() - startTime;
    
    console.log(`⏱️  Response Time: ${elapsed}ms`);
    console.log(`🎯 Action: ${decision.action}`);
    console.log(`📊 Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`💭 Reasoning: ${decision.reasoning}`);
    
    if (decision.stopLoss) {
      console.log(`🛑 Stop Loss: $${decision.stopLoss.toFixed(2)}`);
    }
    if (decision.takeProfit) {
      console.log(`🎯 Take Profit: $${decision.takeProfit.toFixed(2)}`);
    }
    
    if (decision.metadata) {
      console.log(`\n📋 Metadata:`);
      console.log(JSON.stringify(decision.metadata, null, 2));
    }
    
    // Validate decision quality
    validateDecision(scenario, decision);
    
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

function validateDecision(scenario: any, decision: any) {
  console.log(`\n✅ Validation:`);
  
  const market = scenario.marketData[0];
  const issues = [];
  
  // Check overbought/oversold logic
  if (market.rsi > 80 && decision.action === 'ENTER_POSITION') {
    issues.push('⚠️  Buying in overbought conditions');
  }
  if (market.rsi < 20 && decision.action === 'EXIT_POSITION') {
    issues.push('⚠️  Selling in oversold conditions');
  }
  
  // Check spread
  const spread = (market.ask - market.bid) / market.price;
  if (spread > 0.002 && decision.action !== 'WAIT') {
    issues.push('⚠️  Trading with wide spread');
  }
  
  // Check position limits
  if (scenario.positions.length >= 5 && decision.action === 'ENTER_POSITION') {
    issues.push('⚠️  Exceeding position limits');
  }
  
  // Check daily P&L limits
  if (scenario.dailyPnL <= -300 && decision.action !== 'WAIT') {
    issues.push('⚠️  Trading after daily loss limit');
  }
  
  // Check volatility
  if (market.atr > 4 && decision.confidence > 0.7) {
    issues.push('⚠️  High confidence in volatile market');
  }
  
  if (issues.length === 0) {
    console.log('✅ Decision passed all validation checks');
  } else {
    issues.forEach(issue => console.log(issue));
  }
}

async function compareServices() {
  console.log('\n🔄 Comparing Fast vs Smart Decision Services');
  console.log('='.repeat(60));
  
  const testScenario = marketScenarios.bullish;
  
  // Test original fast decision
  console.log('\n1️⃣  Original Fast Decision Service:');
  // Would need a separate endpoint to test old service
  
  // Test smart fast decision
  console.log('\n2️⃣  Smart Fast Decision Service:');
  await testDecision(testScenario);
}

async function runAllTests() {
  console.log('🚀 Smart Fast Decision Service Test Suite');
  console.log('=========================================\n');
  
  // Test each scenario
  for (const [key, scenario] of Object.entries(marketScenarios)) {
    await testDecision(scenario);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
  
  // Compare services
  await compareServices();
  
  console.log('\n\n✅ All tests completed!');
}

// Run tests
runAllTests().catch(console.error);