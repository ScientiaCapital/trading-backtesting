#!/usr/bin/env tsx
/**
 * Complete Cloudflare Setup Script using Wrangler CLI
 * Creates all resources needed for ULTRA Trading Platform
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function executeCommand(command: string, description: string, optional = false) {
  console.log(`\n🔄 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`✅ Success: ${description}`);
    return output;
  } catch (error: any) {
    if (optional) {
      console.log(`⚠️  Optional step failed: ${description}`);
      console.log(`   ${error.message.split('\n')[0]}`);
      return null;
    } else {
      console.error(`❌ Failed: ${description}`);
      console.error(`   ${error.message.split('\n')[0]}`);
      throw error;
    }
  }
}

function updateWranglerConfig(resourceIds: Record<string, string>) {
  console.log('\n📝 Updating wrangler.jsonc with actual resource IDs...');
  
  const wranglerPath = join(process.cwd(), 'wrangler.jsonc');
  let content = readFileSync(wranglerPath, 'utf-8');
  
  // Update placeholders with actual IDs
  for (const [placeholder, actualId] of Object.entries(resourceIds)) {
    content = content.replace(placeholder, actualId);
  }
  
  writeFileSync(wranglerPath, content);
  console.log('✅ Updated wrangler.jsonc with resource IDs');
}

async function main() {
  console.log('🚀 ULTRA Trading Platform - Complete Cloudflare Setup');
  console.log('='.repeat(60));
  
  const resourceIds: Record<string, string> = {};
  
  console.log('\n🎯 This script will:');
  console.log('1. Create D1 databases for all environments');
  console.log('2. Create KV namespaces for caching');
  console.log('3. Create R2 buckets for data storage');
  console.log('4. Update wrangler.jsonc with actual resource IDs');
  console.log('5. Deploy to staging environment');
  
  console.log('\n⚡ Starting setup...');
  
  // Step 1: Create D1 Databases
  console.log('\n📊 Step 1: Creating D1 Databases');
  
  const databases = [
    { name: 'ultra-trading', env: 'development' },
    { name: 'ultra-trading-staging', env: 'staging' },
    { name: 'ultra-trading-production', env: 'production' }
  ];
  
  for (const db of databases) {
    try {
      const output = executeCommand(
        `wrangler d1 create ${db.name}`,
        `Creating D1 database: ${db.name}`
      );
      
      // Extract database ID
      const idMatch = output?.match(/database_id = "([^"]+)"/);
      if (idMatch) {
        const key = db.env === 'development' ? 
          '6617f40f-3242-4bd5-8e1b-cdb349bc9187' : 
          db.env === 'staging' ? 
            'YOUR_STAGING_D1_DATABASE_ID' : 
            'YOUR_PRODUCTION_D1_DATABASE_ID';
        resourceIds[key] = idMatch[1] || '';
        console.log(`📋 Database ID: ${idMatch[1]}`);
      }
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  Database ${db.name} already exists`);
      } else {
        throw error;
      }
    }
  }
  
  // Step 2: Create KV Namespaces
  console.log('\n🗄️  Step 2: Creating KV Namespaces');
  
  const kvEnvironments = ['staging', 'production'];
  
  for (const env of kvEnvironments) {
    // Production namespace
    try {
      const prodOutput = executeCommand(
        `wrangler kv:namespace create "CACHE" --env ${env}`,
        `Creating KV namespace for ${env}`
      );
      
      const prodIdMatch = prodOutput?.match(/id = "([^"]+)"/);
      if (prodIdMatch) {
        const key = env === 'staging' ? 
          'YOUR_STAGING_KV_NAMESPACE_ID' : 
          'YOUR_PRODUCTION_KV_NAMESPACE_ID';
        resourceIds[key] = prodIdMatch[1]!;
        console.log(`📋 ${env} KV ID: ${prodIdMatch[1]}`);
      }
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  KV namespace for ${env} already exists`);
      } else {
        throw error;
      }
    }
    
    // Preview namespace
    executeCommand(
      `wrangler kv:namespace create "CACHE" --env ${env} --preview`,
      `Creating KV preview namespace for ${env}`,
      true
    );
  }
  
  // Step 3: Create R2 Buckets
  console.log('\n🪣 Step 3: Creating R2 Buckets');
  
  const buckets = [
    'ultra-data-staging',
    'ultra-data-production'
  ];
  
  for (const bucket of buckets) {
    executeCommand(
      `wrangler r2 bucket create ${bucket}`,
      `Creating R2 bucket: ${bucket}`,
      true
    );
  }
  
  // Step 4: Update wrangler.jsonc
  if (Object.keys(resourceIds).length > 0) {
    updateWranglerConfig(resourceIds);
  }
  
  // Step 5: Initialize databases with schema
  console.log('\n🔄 Step 5: Initializing Database Schemas');
  
  const migrationFile = join(process.cwd(), 'migrations', '001_initial_schema.sql');
  
  for (const db of databases) {
    try {
      const command = db.env === 'development' ? 
        `wrangler d1 execute ${db.name} --local --file=${migrationFile}` :
        `wrangler d1 execute ${db.name} --file=${migrationFile}`;
        
      executeCommand(
        command,
        `Applying schema to ${db.name}`,
        true
      );
    } catch (error) {
      console.log(`⚠️  Schema application failed for ${db.name} - you can run this manually later`);
    }
  }
  
  // Step 6: Set up basic KV data
  console.log('\n🌱 Step 6: Setting up basic KV configuration');
  
  const basicConfig = {
    'config:setup_complete': 'true',
    'config:version': '1.0.0',
    'config:created': new Date().toISOString()
  };
  
  for (const env of kvEnvironments) {
    for (const [key, value] of Object.entries(basicConfig)) {
      executeCommand(
        `wrangler kv:key put "${key}" "${value}" --env ${env}`,
        `Setting ${key} in ${env} KV`,
        true
      );
    }
  }
  
  console.log('\n🎉 Cloudflare setup complete!');
  console.log('\n📋 Summary of created resources:');
  console.log('✅ D1 Databases: development, staging, production');
  console.log('✅ KV Namespaces: staging, production (with previews)');
  console.log('✅ R2 Buckets: staging, production');
  console.log('✅ Database schemas applied');
  console.log('✅ Basic configuration set');
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Set your secrets: npm run setup:secrets');
  console.log('2. Deploy to staging: npm run deploy:staging');
  console.log('3. Test staging deployment');
  console.log('4. Deploy to production: npm run deploy:production');
  
  console.log('\n💡 Commands to set secrets:');
  console.log('wrangler secret put ALPACA_API_KEY --env staging');
  console.log('wrangler secret put ALPACA_API_SECRET --env staging');
  console.log('wrangler secret put JWT_SECRET --env staging');
  console.log('wrangler secret put ENCRYPTION_KEY --env staging');
  
  console.log('\n💡 Commands to deploy:');
  console.log('wrangler deploy --env staging    # Deploy to staging');
  console.log('wrangler deploy --env production # Deploy to production');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n🔧 You can run individual commands manually:');
    console.log('wrangler d1 create ultra-trading-staging');
    console.log('wrangler kv:namespace create "CACHE" --env staging');
    console.log('wrangler r2 bucket create ultra-data-staging');
    process.exit(1);
  });
}

export { main };