// ESLint Configuration for ULTRA Trading Platform
// Strict rules to catch issues before they bite us

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Cloudflare Workers globals
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Node.js globals for tests
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        // TypeScript types
        ExecutionContext: 'readonly',
        ExportedHandler: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Disable base rule as it conflicts with TypeScript version
      'no-unused-vars': 'off',
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Too strict for Cloudflare Workers
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      
      // Security rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      
      // Prevent hardcoded secrets
      'no-template-curly-in-string': 'error',
      
      // Code quality rules
      'no-console': 'off', // Allow console in Cloudflare Workers
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      
      // Async/await best practices
      'require-await': 'off', // Too strict for route handlers
      'no-async-promise-executor': 'warn',
      'no-await-in-loop': 'off', // Sometimes needed in retry logic
      
      // Function rules
      'arrow-body-style': ['error', 'as-needed'],
      'prefer-arrow-callback': 'error',
      
      // Object rules
      'object-shorthand': 'error',
      'prefer-object-spread': 'error',
      
      // Array rules
      'prefer-spread': 'error',
      'prefer-destructuring': 'warn',
      
      // Cloudflare Workers specific
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'window is not available in Cloudflare Workers',
        },
        {
          name: 'document',
          message: 'document is not available in Cloudflare Workers',
        },
        {
          name: 'localStorage',
          message: 'localStorage is not available in Cloudflare Workers',
        },
      ],
      
      // Performance rules
      'no-loop-func': 'error',
      'no-new-object': 'error',
      'no-array-constructor': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      // Relax some rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['migrations/**/*.sql'],
    rules: {
      // Skip JS rules for SQL files
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.wrangler/**',
      'coverage/**',
      '*.min.js',
      'vitest.config.ts',
      'worker-configuration.d.ts',
      'eslint.config.js',
      '**/*.sql',
      '**/*.md',
      '**/*.json',
      '**/*.jsonc',
    ],
  },
];