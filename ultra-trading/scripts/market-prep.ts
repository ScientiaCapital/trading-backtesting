#!/usr/bin/env tsx
/**
 * Market Preparation Script
 * Run this script before market open to prepare for trading
 */

import { TRADING_WATCHLIST, MARKET_OPEN_CHECKLIST } from '../src/config/watchlist';

async function fetchQuote(symbol: string) {
  try {
    const response = await fetch(`http://localhost:8787/api/v1/trading/market/quotes/${symbol}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
}

async function checkAccount() {
  try {
    const response = await fetch('http://localhost:8787/api/v1/trading/account');
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Failed to fetch account info:', error);
    return null;
  }
}

async function checkMarketStatus() {
  try {
    const response = await fetch('http://localhost:8787/api/v1/trading/market/status');
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Failed to fetch market status:', error);
    return null;
  }
}

async function getOpenOrders() {
  try {
    const response = await fetch('http://localhost:8787/api/v1/trading/orders?status=open');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch open orders:', error);
    return [];
  }
}

async function getPositions() {
  try {
    const response = await fetch('http://localhost:8787/api/v1/trading/positions');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    return [];
  }
}

async function main() {
  console.log('🚀 ULTRA Trading Platform - Market Preparation');
  console.log('=' * 50);
  
  // Check market status
  console.log('\n📊 Market Status:');
  const marketStatus = await checkMarketStatus();
  if (marketStatus) {
    console.log(`Market Open: ${marketStatus.is_open ? '✅ YES' : '❌ NO'}`);
    if (!marketStatus.is_open) {
      console.log(`Next Open: ${new Date(marketStatus.next_open).toLocaleString()}`);
      console.log(`Next Close: ${new Date(marketStatus.next_close).toLocaleString()}`);
    }
  }

  // Check account status
  console.log('\n💰 Account Information:');
  const account = await checkAccount();
  if (account) {
    console.log(`Account: ${account.account_number}`);
    console.log(`Status: ${account.status}`);
    console.log(`Portfolio Value: $${parseFloat(account.portfolio_value).toLocaleString()}`);
    console.log(`Buying Power: $${parseFloat(account.buying_power).toLocaleString()}`);
    console.log(`Cash: $${parseFloat(account.cash).toLocaleString()}`);
    console.log(`Options Level: ${account.options_trading_level}`);
  }

  // Check current positions
  console.log('\n📈 Current Positions:');
  const positions = await getPositions();
  if (positions.length > 0) {
    positions.forEach((pos: any) => {
      const pnl = parseFloat(pos.unrealized_pl || 0);
      const pnlColor = pnl >= 0 ? '🟢' : '🔴';
      console.log(`${pnlColor} ${pos.symbol}: ${pos.qty} shares @ $${pos.avg_entry_price} (P&L: $${pnl.toFixed(2)})`);
    });
  } else {
    console.log('No open positions');
  }

  // Check open orders
  console.log('\n📋 Open Orders:');
  const openOrders = await getOpenOrders();
  if (openOrders.length > 0) {
    openOrders.forEach((order: any) => {
      console.log(`${order.side.toUpperCase()} ${order.qty} ${order.symbol} @ ${order.type} ${order.limit_price ? `$${order.limit_price}` : 'market'}`);
    });
  } else {
    console.log('No open orders');
  }

  // Update watchlist prices
  console.log('\n👁️ Watchlist Updates:');
  for (const item of TRADING_WATCHLIST) {
    const quote = await fetchQuote(item.symbol);
    if (quote) {
      const mid = (quote.bid_price + quote.ask_price) / 2;
      const change = ((mid - item.currentPrice) / item.currentPrice * 100);
      const changeColor = change >= 0 ? '🟢' : '🔴';
      console.log(`${changeColor} ${item.symbol}: $${mid.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
      
      // Show strategy recommendations
      if (item.strategies.length > 0) {
        const strategies = item.strategies.map(s => s.type).join(', ');
        console.log(`   📈 Strategies: ${strategies}`);
      }
    }
  }

  // Market preparation checklist
  console.log('\n✅ Pre-Market Checklist:');
  MARKET_OPEN_CHECKLIST.preMarket.forEach((item, index) => {
    console.log(`${index + 1}. ${item}`);
  });

  console.log('\n🔄 Market Open Actions:');
  MARKET_OPEN_CHECKLIST.marketOpen.forEach((item, index) => {
    console.log(`${index + 1}. ${item}`);
  });

  // Strategy summary
  console.log('\n🎯 Strategy Summary:');
  const wheelSymbols = TRADING_WATCHLIST.filter(item => 
    item.strategies.some(s => s.type === 'wheel' && s.enabled)
  ).map(item => item.symbol);
  
  const condorSymbols = TRADING_WATCHLIST.filter(item => 
    item.strategies.some(s => s.type === 'iron_condor' && s.enabled)
  ).map(item => item.symbol);
  
  const scalingSymbols = TRADING_WATCHLIST.filter(item => 
    item.strategies.some(s => s.type === 'gamma_scalping' && s.enabled)
  ).map(item => item.symbol);

  console.log(`Wheel Strategy: ${wheelSymbols.join(', ')}`);
  console.log(`Iron Condor: ${condorSymbols.join(', ')}`);
  console.log(`Gamma Scalping: ${scalingSymbols.join(', ')}`);

  console.log('\n🎯 Ready for Market Open! Good luck trading! 📈');
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };