#!/usr/bin/env tsx
/**
 * Database Initialization Script
 * Creates and initializes D1 databases for all environments
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

interface Environment {
  name: string;
  dbName: string;
  description: string;
}

const environments: Environment[] = [
  {
    name: 'development',
    dbName: 'ultra-trading',
    description: 'Local development database'
  },
  {
    name: 'staging',
    dbName: 'ultra-trading-staging',
    description: 'Staging environment database'
  },
  {
    name: 'production',
    dbName: 'ultra-trading-production',
    description: 'Production environment database'
  }
];

function executeCommand(command: string, description: string) {
  console.log(`\n🔄 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`✅ Success: ${description}`);
    return output;
  } catch (error: unknown) {
    console.error(`❌ Failed: ${description}`);
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unknown error:', error);
    }
    throw error;
  }
}

function createDatabase(env: Environment) {
  console.log(`\n📊 Setting up ${env.name} database: ${env.dbName}`);
  
  try {
    // Create the database
    const createOutput = executeCommand(
      `wrangler d1 create ${env.dbName}`,
      `Creating D1 database '${env.dbName}'`
    );
    
    // Extract database ID from output
    const idMatch = createOutput.match(/database_id = "([^"]+)"/);
    if (idMatch) {
      console.log(`📋 Database ID: ${idMatch[1]}`);
      console.log(`🔧 Update your wrangler.jsonc with this ID for ${env.name} environment`);
    }
    
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(`ℹ️  Database '${env.dbName}' already exists`);
    } else {
      throw error;
    }
  }
}

function runMigrations(env: Environment) {
  console.log(`\n🔄 Running migrations for ${env.name}...`);
  
  const migrationFile = join(process.cwd(), 'migrations', '001_initial_schema.sql');
  
  try {
    // Check if migration file exists
    // Check if migration file exists
    readFileSync(migrationFile, 'utf-8');
    console.log(`📖 Found migration file: ${migrationFile}`);
    
    // Run the migration
    const command = env.name === 'development' 
      ? `wrangler d1 execute ${env.dbName} --local --file=${migrationFile}`
      : `wrangler d1 execute ${env.dbName} --file=${migrationFile}`;
      
    executeCommand(
      command,
      `Applying initial schema to ${env.name} database`
    );
    
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.error(`❌ Migration file not found: ${migrationFile}`);
    } else {
      throw error;
    }
  }
}

function seedDatabase(env: Environment) {
  if (env.name === 'production') {
    console.log(`⚠️  Skipping seed data for production environment`);
    return;
  }
  
  console.log(`\n🌱 Seeding ${env.name} database...`);
  
  // Additional seed data for development and staging
  const seedData = `
-- Additional seed data for ${env.name}
INSERT OR IGNORE INTO organizations (id, name, slug, plan) VALUES 
  ('org-${env.name}', '${env.name.charAt(0).toUpperCase() + env.name.slice(1)} Organization', '${env.name}', 'pro');

INSERT OR IGNORE INTO users (id, email, name, tenant_id, role) VALUES 
  ('user-${env.name}', '${env.name}@ultra-trading.dev', '${env.name.charAt(0).toUpperCase() + env.name.slice(1)} User', 'org-${env.name}', 'admin');
`;

  try {
    // Write seed data to temporary file
    const tempSeedFile = `/tmp/seed-${env.name}.sql`;
    require('fs').writeFileSync(tempSeedFile, seedData);
    
    const command = env.name === 'development'
      ? `wrangler d1 execute ${env.dbName} --local --file=${tempSeedFile}`
      : `wrangler d1 execute ${env.dbName} --file=${tempSeedFile}`;
      
    executeCommand(
      command,
      `Seeding ${env.name} database with test data`
    );
    
    // Clean up temp file
    require('fs').unlinkSync(tempSeedFile);
    
  } catch (error) {
    console.error(`❌ Failed to seed ${env.name} database:`, error);
  }
}

async function main() {
  console.log('🚀 ULTRA Trading Platform - Database Initialization');
  console.log('='.repeat(60));
  
  const args = process.argv.slice(2);
  const environmentFilter = args[0];
  
  let targetEnvironments = environments;
  if (environmentFilter) {
    targetEnvironments = environments.filter(env => env.name === environmentFilter);
    if (targetEnvironments.length === 0) {
      console.error(`❌ Invalid environment: ${environmentFilter}`);
      console.log(`Available environments: ${environments.map(e => e.name).join(', ')}`);
      process.exit(1);
    }
  }
  
  console.log(`\n🎯 Target environments: ${targetEnvironments.map(e => e.name).join(', ')}`);
  
  // Step 1: Create databases
  console.log('\n📦 Step 1: Creating Databases');
  for (const env of targetEnvironments) {
    createDatabase(env);
  }
  
  // Step 2: Run migrations
  console.log('\n🔄 Step 2: Running Migrations');
  for (const env of targetEnvironments) {
    runMigrations(env);
  }
  
  // Step 3: Seed databases (except production)
  console.log('\n🌱 Step 3: Seeding Databases');
  for (const env of targetEnvironments) {
    seedDatabase(env);
  }
  
  console.log('\n🎉 Database initialization complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Update wrangler.jsonc with the database IDs shown above');
  console.log('2. Create KV namespaces: npm run setup:kv');
  console.log('3. Create R2 buckets: npm run setup:r2');
  console.log('4. Set up secrets: npm run setup:secrets');
  console.log('5. Deploy to staging: npm run deploy:staging');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  });
}

export { main };