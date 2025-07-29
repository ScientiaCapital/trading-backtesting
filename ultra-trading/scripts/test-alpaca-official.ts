#!/usr/bin/env tsx
/**
 * Test Alpaca using official SDK
 */

import dotenv from 'dotenv';
import Alpaca from '@alpacahq/alpaca-trade-api';

// Load environment variables
dotenv.config({ path: '../../.env' });

console.log('🔍 Testing Alpaca with Official SDK\n');

const alpaca = new Alpaca({
  keyId: 'PKYN9OAQHP1IR05GGAGL',
  secretKey: 'tfezhnS1NvEtu8eT6BkW3fLd1wKIi0Ygc5HILoBl',
  paper: true,
  baseUrl: 'https://paper-api.alpaca.markets'
});

async function testOfficialSDK(): Promise<void> {
  try {
    console.log('📊 Getting Account Info...');
    const account = await alpaca.getAccount();
    console.log('✅ Success! Account details:');
    console.log(`  - ID: ${account.id}`);
    console.log(`  - Buying Power: $${account.buying_power}`);
    console.log(`  - Cash: $${account.cash}`);
    console.log(`  - Portfolio Value: $${account.portfolio_value}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
  }

  try {
    console.log('\n🕒 Getting Market Clock...');
    const clock = await alpaca.getClock();
    console.log('✅ Market Clock:');
    console.log(`  - Is Open: ${clock.is_open}`);
    console.log(`  - Next Open: ${clock.next_open}`);
    console.log(`  - Next Close: ${clock.next_close}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testOfficialSDK().catch(console.error);