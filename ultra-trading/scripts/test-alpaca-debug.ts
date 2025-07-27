#!/usr/bin/env tsx
/**
 * Debug Alpaca API Connection
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env' });

async function testAlpacaDirectly() {
  console.log('🔍 Testing Alpaca API with direct fetch...\n');
  
  const apiKey = process.env.ALPACA_API_KEY || 'PKULZQJRNA5SFQU6ES23';
  const apiSecret = process.env.ALPACA_API_SECRET || 'ZEeHb6MV6gSWxfwQYJoqzY07RnEcJRlO3KqkFHFE';
  const url = 'https://paper-api.alpaca.markets/v2/account';
  
  console.log('📋 Request Details:');
  console.log(`  - URL: ${url}`);
  console.log(`  - API Key: ${apiKey}`);
  console.log(`  - API Secret: ${apiSecret.substring(0, 10)}...`);
  console.log('');
  
  try {
    // Test 1: With both Key ID and Secret
    console.log('🧪 Test 1: API Key ID + Secret...');
    const response1 = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`  Response Status: ${response1.status} ${response1.statusText}`);
    if (!response1.ok) {
      const text = await response1.text();
      console.log(`  Error: ${text}`);
    } else {
      const data = await response1.json();
      console.log('  ✅ Success! Account data received');
      console.log(`  - Account ID: ${data.id}`);
      console.log(`  - Buying Power: $${parseFloat(data.buying_power).toLocaleString()}`);
    }
    console.log('');
    
    // Test 2: With both Key and Secret (empty secret)
    console.log('🧪 Test 2: API Key ID + Empty Secret...');
    const response2 = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': '',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`  Response Status: ${response2.status} ${response2.statusText}`);
    if (!response2.ok) {
      const text = await response2.text();
      console.log(`  Error: ${text}`);
    }
    console.log('');
    
    // Test 3: Try Authorization header
    console.log('🧪 Test 3: Authorization Bearer header...');
    const response3 = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`  Response Status: ${response3.status} ${response3.statusText}`);
    if (!response3.ok) {
      const text = await response3.text();
      console.log(`  Error: ${text}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run test
testAlpacaDirectly().catch(console.error);