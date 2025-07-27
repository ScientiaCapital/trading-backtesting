#!/usr/bin/env tsx
/**
 * Deployment Validation Script
 * Ensures this remains a Workers application and prevents Pages deployment
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 ULTRA Trading Platform - Deployment Validation');
console.log('');

let hasErrors = false;

function error(message: string) {
  console.log(`❌ ERROR: ${message}`);
  hasErrors = true;
}

function warning(message: string) {
  console.log(`⚠️  WARNING: ${message}`);
}

function success(message: string) {
  console.log(`✅ ${message}`);
}

// 1. Validate Workers configuration
console.log('🔧 Validating Workers configuration...');

if (!existsSync('wrangler.jsonc')) {
  error('wrangler.jsonc not found - this should be a Workers application');
} else {
  const wranglerConfig = readFileSync('wrangler.jsonc', 'utf8');
  
  if (wranglerConfig.includes('"main": "src/index.ts"')) {
    success('Workers entry point configured correctly');
  } else {
    error('Invalid Workers entry point in wrangler.jsonc');
  }
  
  if (wranglerConfig.includes('"compatibility_date"')) {
    success('Workers compatibility date set');
  } else {
    warning('Missing compatibility_date in wrangler.jsonc');
  }
}

// 2. Check for Pages-specific files that shouldn't exist
console.log('🔧 Checking for Pages-specific files...');

const pagesFiles = [
  '_worker.js',
  'functions/',
  '_redirects',
  '_headers',
  'public/_worker.js',
  'pages.config.js',
  'next.config.js',
  'gatsby-config.js'
];

let foundPagesFiles = false;
for (const file of pagesFiles) {
  if (existsSync(file)) {
    error(`Found Pages-specific file: ${file} - remove this for Workers deployment`);
    foundPagesFiles = true;
  }
}

if (!foundPagesFiles) {
  success('No Pages-specific files found');
}

// 3. Validate package.json scripts
console.log('🔧 Validating package.json scripts...');

if (!existsSync('package.json')) {
  error('package.json not found');
} else {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  
  // Check for correct deployment scripts
  if (packageJson.scripts?.['deploy:staging'] && packageJson.scripts?.['deploy:production']) {
    success('Workers deployment scripts configured');
  } else {
    error('Missing Workers deployment scripts in package.json');
  }
  
  // Check for invalid Pages scripts
  const invalidScripts = ['pages:deploy', 'pages:build', 'build:pages'];
  for (const script of invalidScripts) {
    if (packageJson.scripts?.[script]) {
      error(`Found Pages script: ${script} - remove this for Workers deployment`);
    }
  }
}

// 4. Check GitHub Actions workflows
console.log('🔧 Checking GitHub Actions...');

const workflowsDir = '.github/workflows';
if (existsSync(workflowsDir)) {
  const invalidWorkflows = ['pages.yml', 'deploy-pages.yml', 'pages-deploy.yml'];
  let foundInvalidWorkflows = false;
  
  for (const workflow of invalidWorkflows) {
    if (existsSync(join(workflowsDir, workflow))) {
      error(`Found Pages workflow: ${workflow} - remove this`);
      foundInvalidWorkflows = true;
    }
  }
  
  if (!foundInvalidWorkflows) {
    success('No invalid Pages workflows found');
  }
}

// 5. Validate environment configuration
console.log('🔧 Validating environment configuration...');

if (existsSync('wrangler.jsonc')) {
  const wranglerConfig = readFileSync('wrangler.jsonc', 'utf8');
  
  if (wranglerConfig.includes('"staging"') && wranglerConfig.includes('"production"')) {
    success('Staging and production environments configured');
  } else {
    warning('Missing staging or production environment configuration');
  }
}

// 6. Check documentation
console.log('🔧 Validating documentation...');

const expectedUrls = [
  'https://ultra-trading.tkipper.workers.dev',
  'https://ultra-trading-staging.tkipper.workers.dev'
];

if (existsSync('README.md')) {
  const readme = readFileSync('README.md', 'utf8');
  let foundUrls = 0;
  
  for (const url of expectedUrls) {
    if (readme.includes(url)) {
      foundUrls++;
    }
  }
  
  if (foundUrls === expectedUrls.length) {
    success('Documentation contains correct deployment URLs');
  } else {
    warning('Documentation may have incorrect or missing deployment URLs');
  }
  
  if (readme.includes('Workers application, NOT Pages')) {
    success('Documentation correctly identifies as Workers application');
  } else {
    warning('Documentation should clarify this is a Workers application');
  }
}

// Summary
console.log('');
console.log('📋 Validation Summary:');

if (hasErrors) {
  console.log('❌ Validation FAILED - fix errors before deploying');
  console.log('');
  console.log('🚨 IMPORTANT: This is a Workers application, NOT Pages');
  console.log('   Deploy via: wrangler deploy --env production --minify');
  console.log('');
  process.exit(1);
} else {
  console.log('✅ Validation PASSED - ready for Workers deployment');
  console.log('');
  console.log('🚀 Deploy commands:');
  console.log('   • Staging:    wrangler deploy --env staging --minify');
  console.log('   • Production: wrangler deploy --env production --minify');
  console.log('');
  console.log('🌐 Current deployments:');
  console.log('   • Production:  https://ultra-trading.tkipper.workers.dev');
  console.log('   • Staging:     https://ultra-trading-staging.tkipper.workers.dev');
  console.log('');
  process.exit(0);
}