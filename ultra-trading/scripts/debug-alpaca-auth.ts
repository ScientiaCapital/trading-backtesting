#!/usr/bin/env tsx
/**
 * Comprehensive Alpaca Authentication Debugger
 * Tests various authentication methods and endpoints
 */

import dotenv from 'dotenv';
import https from 'https';

// Load environment variables
dotenv.config({ path: '../../.env' });

const API_KEY = process.env.ALPACA_API_KEY || 'PKYN9OAQHP1IR05GGAGL';
const API_SECRET = process.env.ALPACA_API_SECRET || 'tfezhnS1NvEtu8eT6BkW3fLd1wKIi0Ygc5HILoBl';

console.log('🔍 Alpaca Authentication Debugger\n');
console.log('📋 Credentials:');
console.log(`  API Key: ${API_KEY}`);
console.log(`  API Secret: ${API_SECRET.substring(0, 10)}...${API_SECRET.substring(API_SECRET.length - 4)}`);
console.log('');

// Test configurations
const tests = [
  {
    name: 'Standard Headers (APCA-API-KEY-ID)',
    headers: {
      'APCA-API-KEY-ID': API_KEY,
      'APCA-API-SECRET-KEY': API_SECRET,
      'Content-Type': 'application/json'
    }
  },
  {
    name: 'Underscore Format (APCA_API_KEY_ID)',
    headers: {
      'APCA_API_KEY_ID': API_KEY,
      'APCA_API_SECRET_KEY': API_SECRET,
      'Content-Type': 'application/json'
    }
  },
  {
    name: 'Authorization Bearer',
    headers: {
      'Authorization': `Bearer ${API_KEY}:${API_SECRET}`,
      'Content-Type': 'application/json'
    }
  },
  {
    name: 'Basic Auth',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  }
];

// Endpoints to test
const endpoints = [
  { path: '/v2/account', name: 'Account' },
  { path: '/v2/clock', name: 'Market Clock' },
  { path: '/v2/assets/AAPL', name: 'Asset Info' }
];

async function testEndpoint(endpoint: string, headers: any): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'paper-api.alpaca.markets',
      path: endpoint,
      method: 'GET',
      headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    });

    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Authentication Methods...\n');

  for (const test of tests) {
    console.log(`📌 ${test.name}:`);
    
    for (const endpoint of endpoints) {
      const result = await testEndpoint(endpoint.path, test.headers);
      const emoji = result.status === 200 ? '✅' : '❌';
      console.log(`  ${emoji} ${endpoint.name}: ${result.status} - ${result.body.substring(0, 100)}`);
    }
    console.log('');
  }

  // Test without any auth
  console.log('📌 No Authentication:');
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.path, { 'Content-Type': 'application/json' });
    console.log(`  ❓ ${endpoint.name}: ${result.status} - ${result.body.substring(0, 50)}`);
  }
  console.log('');

  // Test with curl command
  console.log('📌 Equivalent curl commands to test manually:\n');
  console.log('# Standard format:');
  console.log(`curl -X GET "https://paper-api.alpaca.markets/v2/account" \\
  -H "APCA-API-KEY-ID: ${API_KEY}" \\
  -H "APCA-API-SECRET-KEY: ${API_SECRET}"\n`);
  
  console.log('# Underscore format:');
  console.log(`curl -X GET "https://paper-api.alpaca.markets/v2/account" \\
  -H "APCA_API_KEY_ID: ${API_KEY}" \\
  -H "APCA_API_SECRET_KEY: ${API_SECRET}"\n`);
}

// Run all tests
runTests().catch(console.error);