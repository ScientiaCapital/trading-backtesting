#!/usr/bin/env tsx
/**
 * Secrets Setup Script using Wrangler CLI
 * Securely sets all required secrets for each environment
 */

import { execSync } from 'child_process';
import * as readline from 'readline';

interface Secret {
  name: string;
  description: string;
  required: boolean;
  sensitive: boolean;
}

const secrets: Secret[] = [
  {
    name: 'ALPACA_API_KEY',
    description: 'Alpaca API Key for trading',
    required: true,
    sensitive: true
  },
  {
    name: 'ALPACA_API_SECRET',
    description: 'Alpaca API Secret for trading',
    required: true,
    sensitive: true
  },
  {
    name: 'JWT_SECRET',
    description: 'JWT signing secret (min 32 characters)',
    required: true,
    sensitive: true
  },
  {
    name: 'ENCRYPTION_KEY',
    description: 'Data encryption key (exactly 32 characters)',
    required: true,
    sensitive: true
  },
  {
    name: 'POLYGON_API_KEY',
    description: 'Polygon.io API key for market data',
    required: false,
    sensitive: true
  },
  {
    name: 'ALPHA_VANTAGE_API_KEY',
    description: 'Alpha Vantage API key for market data',
    required: false,
    sensitive: false
  },
  {
    name: 'OPENAI_API_KEY',
    description: 'OpenAI API key for AI features',
    required: false,
    sensitive: true
  },
  {
    name: 'SENTRY_DSN',
    description: 'Sentry DSN for error tracking',
    required: false,
    sensitive: false
  },
  {
    name: 'SLACK_WEBHOOK_URL',
    description: 'Slack webhook URL for notifications',
    required: false,
    sensitive: true
  }
];

const environments = ['staging', 'production'];

function executeCommand(command: string, description: string) {
  console.log(`🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ Success: ${description}`);
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    throw error;
  }
}

function generateSecureSecret(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setSecret(secret: Secret, environment: string, rl: readline.Interface) {
  console.log(`\n📝 Setting up: ${secret.name} for ${environment}`);
  console.log(`   Description: ${secret.description}`);
  console.log(`   Required: ${secret.required ? 'Yes' : 'No'}`);
  
  if (secret.name === 'JWT_SECRET' || secret.name === 'ENCRYPTION_KEY') {
    const generate = await askQuestion(rl, `   Generate secure ${secret.name}? (y/N): `);
    if (generate.toLowerCase() === 'y' || generate.toLowerCase() === 'yes') {
      const length = secret.name === 'ENCRYPTION_KEY' ? 32 : 64;
      const generatedSecret = generateSecureSecret(length);
      console.log(`   Generated secure ${secret.name}`);
      
      executeCommand(
        `echo "${generatedSecret}" | wrangler secret put ${secret.name} --env ${environment}`,
        `Setting generated ${secret.name} for ${environment}`
      );
      return;
    }
  }
  
  const setValue = await askQuestion(rl, `   Set ${secret.name} for ${environment}? (y/N): `);
  if (setValue.toLowerCase() === 'y' || setValue.toLowerCase() === 'yes') {
    executeCommand(
      `wrangler secret put ${secret.name} --env ${environment}`,
      `Setting ${secret.name} for ${environment}`
    );
  } else if (secret.required) {
    console.log(`⚠️  Warning: ${secret.name} is required but not set`);
  }
}

async function listSecrets(environment: string) {
  console.log(`\n📋 Current secrets for ${environment}:`);
  try {
    execSync(`wrangler secret list --env ${environment}`, { stdio: 'inherit' });
  } catch {
    console.log(`❌ Failed to list secrets for ${environment}`);
  }
}

async function main() {
  console.log('🔐 ULTRA Trading Platform - Secrets Setup');
  console.log('='.repeat(50));
  
  const args = process.argv.slice(2);
  const environmentFilter = args[0];
  
  let targetEnvironments = environments;
  if (environmentFilter && environments.includes(environmentFilter)) {
    targetEnvironments = [environmentFilter];
  }
  
  console.log(`\n🎯 Target environments: ${targetEnvironments.join(', ')}`);
  console.log('\n⚠️  Important Security Notes:');
  console.log('• Never share or commit secrets to git');
  console.log('• Use different secrets for staging and production');
  console.log('• Regularly rotate your API keys');
  console.log('• Monitor secret usage in Cloudflare dashboard');
  
  const rl = createReadlineInterface();
  
  try {
    for (const environment of targetEnvironments) {
      console.log(`\n🌐 Setting up secrets for ${environment} environment`);
      
      // Show current secrets first
      await listSecrets(environment);
      
      const proceed = await askQuestion(rl, `\nProceed with ${environment} secrets setup? (y/N): `);
      if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        console.log(`⏭️  Skipping ${environment} environment`);
        continue;
      }
      
      for (const secret of secrets) {
        await setSecret(secret, environment, rl);
      }
      
      console.log(`\n✅ Completed secrets setup for ${environment}`);
      
      // Show updated secrets list
      await listSecrets(environment);
    }
    
    console.log('\n🎉 Secrets setup complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Verify secrets in Cloudflare dashboard');
    console.log('2. Test deployment: npm run deploy:staging');
    console.log('3. Check application logs: wrangler tail --env staging');
    
    console.log('\n💡 Useful commands:');
    console.log('wrangler secret list --env staging          # List all secrets');
    console.log('wrangler secret delete SECRET_NAME --env staging  # Delete a secret');
    console.log('wrangler secret put SECRET_NAME --env staging     # Update a secret');
    
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Secrets setup failed:', error.message);
    process.exit(1);
  });
}

export { main };