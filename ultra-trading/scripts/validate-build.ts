#!/usr/bin/env tsx

/**
 * Build Validation Script
 * Checks for common deployment issues before pushing to GitHub
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  passed: boolean;
  message: string;
}

class BuildValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  async validate(): Promise<boolean> {
    console.log('🔍 Starting build validation...\n');

    const checks: Array<() => Promise<ValidationResult>> = [
      this.checkWranglerConfig.bind(this),
      this.checkDurableObjectExports.bind(this),
      this.checkTypeScript.bind(this),
      this.checkLinting.bind(this),
      this.checkTests.bind(this),
      this.checkEnvironmentVariables.bind(this),
      this.checkDeploymentDryRun.bind(this)
    ];

    for (const check of checks) {
      const result = await check();
      if (!result.passed) {
        this.errors.push(result.message);
      }
    }

    this.printResults();
    return this.errors.length === 0;
  }

  private async checkWranglerConfig(): Promise<ValidationResult> {
    console.log('📋 Checking wrangler.jsonc configuration...');
    
    const configPath = join(process.cwd(), 'wrangler.jsonc');
    if (!existsSync(configPath)) {
      return { passed: false, message: 'wrangler.jsonc not found' };
    }

    try {
      // Remove comments for JSON parsing
      const content = readFileSync(configPath, 'utf8');
      const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const config = JSON.parse(jsonContent);

      // Check for required fields
      const required = ['name', 'main', 'compatibility_date'];
      for (const field of required) {
        if (!config[field]) {
          return { passed: false, message: `Missing required field: ${field}` };
        }
      }

      // Check Durable Objects
      if (config.durable_objects?.bindings) {
        const expectedDOs = ['TradingSession', 'AgentCoordinator'];
        const actualDOs = config.durable_objects.bindings.map((b: any) => b.class_name);
        
        for (const expected of expectedDOs) {
          if (!actualDOs.includes(expected)) {
            return { passed: false, message: `Missing Durable Object: ${expected}` };
          }
        }
      }

      return { passed: true, message: 'wrangler.jsonc is valid' };
    } catch (error) {
      return { passed: false, message: `Invalid wrangler.jsonc: ${error}` };
    }
  }

  private async checkDurableObjectExports(): Promise<ValidationResult> {
    console.log('📦 Checking Durable Object exports...');
    
    const indexPath = join(process.cwd(), 'src/index.ts');
    if (!existsSync(indexPath)) {
      return { passed: false, message: 'src/index.ts not found' };
    }

    const content = readFileSync(indexPath, 'utf8');
    const requiredExports = ['TradingSession', 'AgentCoordinator'];
    
    for (const exportName of requiredExports) {
      if (!content.includes(`export { ${exportName} }`) && 
          !content.includes(`export { ${exportName} from`)) {
        return { passed: false, message: `Missing export: ${exportName}` };
      }
    }

    return { passed: true, message: 'All Durable Objects are exported' };
  }

  private async checkTypeScript(): Promise<ValidationResult> {
    console.log('🔧 Running TypeScript compilation check...');
    
    try {
      execSync('npm run build', { stdio: 'pipe' });
      return { passed: true, message: 'TypeScript compilation successful' };
    } catch (error) {
      return { passed: false, message: 'TypeScript compilation failed' };
    }
  }

  private async checkLinting(): Promise<ValidationResult> {
    console.log('🎨 Running ESLint check...');
    
    try {
      execSync('npm run lint:check', { stdio: 'pipe' });
      return { passed: true, message: 'ESLint check passed' };
    } catch (error) {
      this.warnings.push('ESLint found issues - fix with: npm run lint');
      return { passed: true, message: 'ESLint check completed with warnings' };
    }
  }

  private async checkTests(): Promise<ValidationResult> {
    console.log('🧪 Running tests...');
    
    try {
      execSync('npm test', { stdio: 'pipe' });
      return { passed: true, message: 'All tests passed' };
    } catch (error) {
      return { passed: false, message: 'Tests failed' };
    }
  }

  private async checkEnvironmentVariables(): Promise<ValidationResult> {
    console.log('🔐 Checking environment variables...');
    
    const devVarsPath = join(process.cwd(), '.dev.vars');
    if (!existsSync(devVarsPath)) {
      this.warnings.push('.dev.vars not found - make sure to set up secrets in Cloudflare dashboard');
    }

    return { passed: true, message: 'Environment variables check completed' };
  }

  private async checkDeploymentDryRun(): Promise<ValidationResult> {
    console.log('🚀 Running deployment dry run...');
    
    try {
      execSync('npx wrangler deploy --dry-run', { stdio: 'pipe' });
      return { passed: true, message: 'Deployment dry run successful' };
    } catch (error) {
      return { passed: false, message: 'Deployment dry run failed' };
    }
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(50) + '\n');

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`   - ${warning}`));
      console.log();
    }

    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      this.errors.forEach(error => console.log(`   - ${error}`));
      console.log('\n🚫 Build validation FAILED');
    } else {
      console.log('✅ Build validation PASSED');
      console.log('🎉 Your code is ready for deployment!');
    }

    console.log('\n' + '='.repeat(50));
  }
}

// Run validation
const validator = new BuildValidator();
validator.validate().then(success => {
  process.exit(success ? 0 : 1);
});