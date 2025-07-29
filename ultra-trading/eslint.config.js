// ESLint Configuration for ULTRA Trading Platform
// Enterprise-level TypeScript ESLint setup with type-aware linting
// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base recommended configurations
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  
  // Global configuration with type-aware linting
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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
        // Node.js globals for scripts
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        // TypeScript types
        ExecutionContext: 'readonly',
        ExportedHandler: 'readonly',
        // Cloudflare Workers specific globals
        btoa: 'readonly',
        atob: 'readonly',
        DurableObjectStub: 'readonly',
        WebSocketPair: 'readonly',
        ScheduledEvent: 'readonly',
        WebSocket: 'readonly',
        // Node.js types for scripts
        NodeJS: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      // TypeScript-specific rules for trading platform
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(_|[A-Z][a-zA-Z]*Response$|[A-Z][a-zA-Z]*Message$)', // Allow unused types and responses
        destructuredArrayIgnorePattern: '^_',
        caughtErrors: 'none', // Allow unused error parameters in catch blocks
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn', // More lenient for development
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off', // Too strict for edge workers
      '@typescript-eslint/no-floating-promises': 'error', // Critical for async trading operations
      '@typescript-eslint/no-misused-promises': ['error', { 
        checksVoidReturn: false // Allow Promise-returning functions in void contexts for event handlers
      }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'off', // Too strict for route handlers
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn', // Trading enums need flexibility  
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
        allowAny: false,
        allowNullish: false,
        allowRegExp: false,
        allow: [{ name: ['Date'], from: 'lib' }] // Allow Date objects in templates for logging
      }],
      
      // Disable base ESLint rules that conflict with TypeScript versions
      'no-unused-vars': 'off',
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      
      // Security rules for trading platform
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-template-curly-in-string': 'error',
      
      // Code quality rules
      'no-console': 'off', // Allow console in Cloudflare Workers
      'no-debugger': 'error',
      'no-alert': 'error',  
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'error',
      'no-case-declarations': 'warn', // Downgrade to warning for development
      
      // Async/await best practices for trading operations
      'no-async-promise-executor': 'error',
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
      
      // Cloudflare Workers specific restrictions
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
      'no-array-constructor': 'off',
      '@typescript-eslint/no-array-constructor': 'error',
    },
  },
  
  // Configuration for test files
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      // Relax some rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'no-console': 'off',
    },
  },
  
  // Configuration for script files
  {
    files: ['scripts/**/*.ts', 'scripts/**/*.js'],
    rules: {
      // Allow more flexibility in scripts
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      'no-console': 'off',
      'no-constant-condition': 'off',
      'prefer-destructuring': 'off',
    },
  },
  
  // Configuration for client-side React files (disable most rules for examples)
  {
    files: ['client-examples/**/*.tsx', 'client-examples/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // Minimal rules for client examples
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-restricted-globals': 'off', // Allow window, document, etc. in client examples
    },
  },
  
  // Disable type-aware linting for JavaScript files
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // Basic rules for JS files
      'no-undef': 'error',
      'no-unused-vars': 'error',
    },
  },
  
  // Files to ignore
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.wrangler/**',
      'coverage/**',
      '*.min.js',
      'vitest.config.ts',
      'worker-configuration.d.ts',
      '**/*.sql',
      '**/*.md',
      '**/*.json',
      '**/*.jsonc',
      // Temporarily ignore specific problematic files during migration
      'scripts/convert-notebook.ts', // Contains complex notebook parsing
    ],
  },
);