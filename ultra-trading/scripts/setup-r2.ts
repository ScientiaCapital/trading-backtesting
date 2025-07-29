#!/usr/bin/env tsx
/**
 * R2 Bucket Setup Script
 * Creates R2 buckets for all environments
 */

import { execSync } from 'child_process';

interface R2Bucket {
  name: string;
  description: string;
  folders: string[];
}

const buckets: R2Bucket[] = [
  {
    name: 'ultra-data',
    description: 'Storage for backtest results, strategy files, and large datasets',
    folders: [
      'backtests/',
      'strategies/',
      'market-data/',
      'reports/',
      'exports/',
      'logs/'
    ]
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
    if (error.message.includes('already exists')) {
      console.log(`ℹ️  Resource already exists`);
      return null;
    }
    console.error(`❌ Failed: ${description}`);
    console.error(error.message);
    return null;
  }
}

function createR2Bucket(bucket: R2Bucket, environment: string) {
  const bucketName = `${bucket.name}-${environment}`;
  
  console.log(`\n📦 Creating R2 bucket '${bucketName}'`);
  console.log(`📝 Description: ${bucket.description}`);
  
  executeCommand(
    `wrangler r2 bucket create ${bucketName}`,
    `Creating R2 bucket '${bucketName}'`
  );
}

function setupBucketStructure(bucket: R2Bucket, environment: string) {
  const bucketName = `${bucket.name}-${environment}`;
  
  console.log(`\n📁 Setting up folder structure for '${bucketName}'`);
  
  // Create folder structure by uploading placeholder files
  for (const folder of bucket.folders) {
    const placeholderContent = `# ${folder.replace('/', '').toUpperCase()} Folder\n\nThis folder contains ${folder.replace('/', '').toLowerCase()} files for the ULTRA Trading Platform.\n\nEnvironment: ${environment}\nCreated: ${new Date().toISOString()}\n`;
    
    // Create a temporary file
    const tempFile = `/tmp/placeholder-${folder.replace('/', '')}.md`;
    require('fs').writeFileSync(tempFile, placeholderContent);
    
    executeCommand(
      `wrangler r2 object put ${bucketName}/${folder}README.md --file=${tempFile}`,
      `Creating folder: ${folder}`
    );
    
    // Clean up temp file
    require('fs').unlinkSync(tempFile);
  }
}

function createSampleFiles(bucket: R2Bucket, environment: string) {
  const bucketName = `${bucket.name}-${environment}`;
  
  console.log(`\n🌱 Creating sample files for '${bucketName}'`);
  
  // Sample configuration file
  const configData = {
    environment,
    version: '1.0.0',
    created: new Date().toISOString(),
    settings: {
      max_file_size: '100MB',
      allowed_formats: ['json', 'csv', 'parquet', 'xlsx'],
      retention_days: environment === 'production' ? 365 : 90
    },
    folders: bucket.folders
  };
  
  const configFile = `/tmp/config-${environment}.json`;
  require('fs').writeFileSync(configFile, JSON.stringify(configData, null, 2));
  
  executeCommand(
    `wrangler r2 object put ${bucketName}/config.json --file=${configFile}`,
    `Uploading configuration file`
  );
  
  // Clean up
  require('fs').unlinkSync(configFile);
  
  // Sample strategy template
  const strategyTemplate = `/**
 * ULTRA Trading Strategy Template
 * Environment: ${environment}
 * Created: ${new Date().toISOString()}
 */

export interface StrategyConfig {
  name: string;
  type: 'mean_reversion' | 'momentum' | 'options' | 'arbitrage';
  parameters: Record<string, any>;
  riskLimits: {
    maxPositionSize: number;
    stopLoss: number;
    maxDrawdown: number;
  };
}

export class SampleStrategy {
  constructor(private config: StrategyConfig) {}
  
  async analyze(marketData: any): Promise<any> {
    // Strategy implementation goes here
    return {
      signal: 'hold',
      confidence: 0.5,
      timestamp: new Date().toISOString()
    };
  }
}`;

  const strategyFile = `/tmp/sample-strategy-${environment}.ts`;
  require('fs').writeFileSync(strategyFile, strategyTemplate);
  
  executeCommand(
    `wrangler r2 object put ${bucketName}/strategies/sample-strategy.ts --file=${strategyFile}`,
    `Uploading sample strategy template`
  );
  
  // Clean up
  require('fs').unlinkSync(strategyFile);
}

async function main() {
  console.log('🚀 ULTRA Trading Platform - R2 Bucket Setup');
  console.log('='.repeat(50));
  
  const args = process.argv.slice(2);
  const environmentFilter = args[0];
  
  let targetEnvironments = environments;
  if (environmentFilter && environments.includes(environmentFilter)) {
    targetEnvironments = [environmentFilter];
  }
  
  console.log(`\n🎯 Target environments: ${targetEnvironments.join(', ')}`);
  
  // Create buckets for each environment
  for (const environment of targetEnvironments) {
    console.log(`\n🌐 Setting up R2 buckets for ${environment} environment`);
    
    for (const bucket of buckets) {
      createR2Bucket(bucket, environment);
      setupBucketStructure(bucket, environment);
      createSampleFiles(bucket, environment);
    }
  }
  
  console.log('\n🎉 R2 bucket setup complete!');
  console.log('\n📋 Bucket Structure:');
  for (const bucket of buckets) {
    console.log(`\n📦 ${bucket.name}:`);
    for (const folder of bucket.folders) {
      console.log(`  📁 ${folder}`);
    }
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Buckets are now ready to use in your wrangler.jsonc');
  console.log('2. Set up secrets: npm run setup:secrets');
  console.log('3. Deploy to staging: npm run deploy:staging');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ R2 setup failed:', error);
    process.exit(1);
  });
}

export { main };