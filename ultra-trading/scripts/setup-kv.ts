#!/usr/bin/env tsx
/**
 * KV Namespace Setup Script
 * Creates KV namespaces for all environments
 */

import { execSync } from 'child_process';

interface KVNamespace {
  name: string;
  title: string;
  description: string;
}

const namespaces: KVNamespace[] = [
  {
    name: 'CACHE',
    title: 'ultra-trading-cache',
    description: 'Caching for market data, sessions, and configurations'
  }
];

const environments = ['staging', 'production'];

function executeCommand(command: string, description: string) {
  console.log(`\n🔄 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`✅ Success: ${description}`);
    return output;
  } catch (error: any) {
    console.error(`❌ Failed: ${description}`);
    console.error(error.message);
    return null;
  }
}

function createKVNamespace(namespace: KVNamespace, environment: string) {
  console.log(`\n📦 Creating KV namespace '${namespace.name}' for ${environment}`);
  
  const title = `${namespace.title}-${environment}`;
  
  // Create production namespace
  const prodOutput = executeCommand(
    `wrangler kv:namespace create "${namespace.name}" --env ${environment}`,
    `Creating production KV namespace '${title}'`
  );
  
  // Create preview namespace
  const previewOutput = executeCommand(
    `wrangler kv:namespace create "${namespace.name}" --env ${environment} --preview`,
    `Creating preview KV namespace '${title}-preview'`
  );
  
  // Extract IDs from output
  if (prodOutput) {
    const idMatch = prodOutput.match(/id = "([^"]+)"/);
    if (idMatch) {
      console.log(`📋 Production ID: ${idMatch[1]}`);
    }
  }
  
  if (previewOutput) {
    const idMatch = previewOutput.match(/id = "([^"]+)"/);
    if (idMatch) {
      console.log(`📋 Preview ID: ${idMatch[1]}`);
    }
  }
}

function populateKVNamespace(namespace: KVNamespace, environment: string) {
  console.log(`\n🌱 Populating KV namespace '${namespace.name}' for ${environment}`);
  
  const sampleData = {
    'config:trading_hours': JSON.stringify({
      market_open: '09:30',
      market_close: '16:00',
      timezone: 'America/New_York',
      trading_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }),
    'config:risk_limits': JSON.stringify({
      max_position_size: 0.1, // 10% of portfolio
      max_daily_loss: 0.02,   // 2% daily loss limit
      max_total_exposure: 0.8  // 80% of buying power
    }),
    'cache:market_status': JSON.stringify({
      is_open: false,
      last_updated: new Date().toISOString(),
      next_open: null,
      next_close: null
    })
  };
  
  for (const [key, value] of Object.entries(sampleData)) {
    executeCommand(
      `wrangler kv:key put "${key}" "${value}" --env ${environment}`,
      `Adding sample data key: ${key}`
    );
  }
}

async function main() {
  console.log('🚀 ULTRA Trading Platform - KV Namespace Setup');
  console.log('=' * 50);
  
  const args = process.argv.slice(2);
  const environmentFilter = args[0];
  
  let targetEnvironments = environments;
  if (environmentFilter && environments.includes(environmentFilter)) {
    targetEnvironments = [environmentFilter];
  }
  
  console.log(`\n🎯 Target environments: ${targetEnvironments.join(', ')}`);
  
  // Create namespaces for each environment
  for (const environment of targetEnvironments) {
    console.log(`\n🌐 Setting up KV namespaces for ${environment} environment`);
    
    for (const namespace of namespaces) {
      createKVNamespace(namespace, environment);
    }
  }
  
  // Populate with sample data
  console.log('\n🌱 Populating KV namespaces with sample data');
  for (const environment of targetEnvironments) {
    for (const namespace of namespaces) {
      populateKVNamespace(namespace, environment);
    }
  }
  
  console.log('\n🎉 KV namespace setup complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Update wrangler.jsonc with the KV namespace IDs shown above');
  console.log('2. Create R2 buckets: npm run setup:r2');
  console.log('3. Set up secrets: npm run setup:secrets');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ KV setup failed:', error);
    process.exit(1);
  });
}

export { main };