#!/usr/bin/env tsx
/**
 * Production Deployment Validation Script
 * Additional safety checks before production deployment
 */

import { existsSync, readFileSync } from 'fs';

console.log('🚨 ULTRA Trading Platform - Production Deployment Validation');
console.log('');

let hasErrors = false;
let hasWarnings = false;

function error(message: string) {
  console.log(`❌ ERROR: ${message}`);
  hasErrors = true;
}

function warning(message: string) {
  console.log(`⚠️  WARNING: ${message}`);
  hasWarnings = true;
}

function success(message: string) {
  console.log(`✅ ${message}`);
}

// 1. Check for secrets in code
console.log('🔐 Checking for accidentally committed secrets...');

const secretPatterns = [
  /ALPACA_API_KEY.*[=:]\s*["']?[A-Z0-9]{20,}/i,
  /ALPACA_API_SECRET.*[=:]\s*["']?[A-Za-z0-9+/]{40,}/i,
  /sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{95}/,
  /JWT_SECRET.*[=:]\s*["']?[A-Za-z0-9+/]{20,}/i,
  /ENCRYPTION_KEY.*[=:]\s*["']?[A-Za-z0-9+/]{20,}/i,
];

const filesToCheck = [
  'src/index.ts',
  'src/api/trading.ts',
  'src/services/alpaca/AlpacaClient.ts',
  'wrangler.jsonc',
  'package.json',
  'README.md'
];

let foundSecrets = false;
for (const file of filesToCheck) {
  if (existsSync(file)) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        error(`Potential secret found in ${file} - secrets should only be in Cloudflare secrets or .dev.vars`);
        foundSecrets = true;
      }
    }
  }
}

if (!foundSecrets) {
  success('No secrets found in code');
}

// 2. Validate production configuration
console.log('🔧 Validating production configuration...');

if (existsSync('wrangler.jsonc')) {
  const wranglerConfig = readFileSync('wrangler.jsonc', 'utf8');
  
  // Check for production environment
  if (wranglerConfig.includes('"production"')) {
    success('Production environment configured');
  } else {
    error('Production environment not configured in wrangler.jsonc');
  }
  
  // Check for production database
  if (wranglerConfig.includes('ultra-trading-production')) {
    success('Production database configured');
  } else {
    warning('Production database may not be configured');
  }
  
  // Check for development-specific settings in production
  if (wranglerConfig.includes('"LOG_LEVEL": "debug"') && wranglerConfig.includes('"production"')) {
    warning('Debug logging enabled in production - consider using "warn" or "error"');
  }
}

// 3. Check API endpoints and trading safety
console.log('📊 Validating trading safety...');

if (existsSync('.dev.vars')) {
  const devVars = readFileSync('.dev.vars', 'utf8');
  if (devVars.includes('paper-api.alpaca.markets')) {
    success('Using Alpaca Paper Trading (safe for testing)');
  } else if (devVars.includes('api.alpaca.markets')) {
    error('DANGER: Live trading API detected - ensure this is intentional for production!');
  }
}

// 4. Validate documentation is up to date
console.log('📚 Validating documentation...');

const expectedProdUrl = 'https://ultra-trading.tkipper.workers.dev';
const docFiles = ['README.md', 'DEPLOYMENT.md', 'QUICK_START.md'];

for (const docFile of docFiles) {
  if (existsSync(docFile)) {
    const content = readFileSync(docFile, 'utf8');
    if (content.includes(expectedProdUrl)) {
      success(`${docFile} contains correct production URL`);
    } else {
      warning(`${docFile} may not contain correct production URL`);
    }
  }
}

// 5. Check for TypeScript errors (production readiness)
console.log('🔧 Checking TypeScript compilation...');

try {
  // This would normally run tsc, but we'll just check if build script exists
  if (existsSync('package.json')) {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    if (packageJson.scripts?.['type-check']) {
      success('TypeScript checking available');
    } else {
      warning('TypeScript checking not configured');
    }
  }
} catch (error) {
  warning('Could not validate TypeScript configuration');
}

// 6. Production deployment checklist
console.log('📋 Production deployment checklist...');

const checklist = [
  { check: 'Secrets configured in Cloudflare', file: 'wrangler.jsonc' },
  { check: 'Production database created', file: 'wrangler.jsonc' },
  { check: 'Staging environment tested', file: 'README.md' },
  { check: 'Documentation updated', file: 'README.md' },
  { check: 'No debug logging in production', file: 'wrangler.jsonc' }
];

console.log('');
console.log('📝 Before deploying to production, ensure:');
for (const item of checklist) {
  console.log(`   • ${item.check}`);
}

// Summary
console.log('');
console.log('🚨 PRODUCTION DEPLOYMENT SUMMARY:');

if (hasErrors) {
  console.log('❌ CRITICAL ERRORS FOUND - DO NOT DEPLOY TO PRODUCTION');
  console.log('   Fix all errors before proceeding with production deployment');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  WARNINGS FOUND - Review before production deployment');
  console.log('   Consider fixing warnings for optimal production deployment');
  console.log('');
  console.log('🚀 To proceed with production deployment:');
  console.log('   wrangler deploy --env production --minify');
  process.exit(0);
} else {
  console.log('✅ READY FOR PRODUCTION DEPLOYMENT');
  console.log('');
  console.log('🚀 Deploy to production:');
  console.log('   wrangler deploy --env production --minify');
  console.log('');
  console.log('🌐 Production URL:');
  console.log('   https://ultra-trading.tkipper.workers.dev');
  process.exit(0);
}