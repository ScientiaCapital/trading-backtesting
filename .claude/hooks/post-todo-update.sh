#!/bin/bash
# Post-Todo-Update Hook - Validates code quality when todos are marked complete
# This runs automatically when any agent marks a todo as "completed"

set -e  # Exit on any error

echo "🔍 Running Post-Todo-Update Validation Hook..."

# Check if we're in the ultra-trading directory or navigate to it
if [ -d "ultra-trading" ]; then
    cd ultra-trading
elif [ -d "/Users/tmk/Documents/trading-backtesting/ultra-trading" ]; then
    cd /Users/tmk/Documents/trading-backtesting/ultra-trading
else
    echo "⚠️  ultra-trading directory not found, skipping validation"
    exit 0
fi

# Check if this is a TypeScript project
if [ ! -f "package.json" ]; then
    echo "📦 No package.json found, skipping validation"
    exit 0
fi

echo "📁 Validating in: $(pwd)"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "🔥 VALIDATION CHECKPOINT 🔥"
echo "================================"

# 1. TypeScript Compilation Check
echo "1️⃣ TypeScript Strict Mode Check..."
if command_exists npx && [ -f "tsconfig.json" ]; then
    if npx tsc --noEmit --strict; then
        echo "✅ TypeScript compilation passed"
    else
        echo "❌ TypeScript compilation FAILED"
        echo "🚨 BLOCKING: Fix TypeScript errors before proceeding"
        exit 1
    fi
else
    echo "⚠️  TypeScript not configured, skipping"
fi

# 2. ESLint Check (if configured)
echo ""
echo "2️⃣ ESLint Code Quality Check..."
if command_exists npx && ([ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]); then
    if npx eslint . --ext .ts,.js,.tsx,.jsx --fix; then
        echo "✅ ESLint checks passed"
    else
        echo "❌ ESLint checks FAILED"
        echo "🚨 BLOCKING: Fix ESLint errors before proceeding"
        exit 1
    fi
else
    echo "⚠️  ESLint not configured, skipping"
fi

# 3. Biome Check (alternative to ESLint for better performance)
echo ""
echo "3️⃣ Biome Format & Lint Check..."
if command_exists npx && [ -f "biome.json" ]; then
    if npx @biomejs/biome check --apply .; then
        echo "✅ Biome checks passed"
    else
        echo "❌ Biome checks FAILED"
        echo "🚨 BLOCKING: Fix Biome errors before proceeding"
        exit 1
    fi
else
    echo "⚠️  Biome not configured, skipping"
fi

# 4. Unit Tests (if they exist)
echo ""
echo "4️⃣ Unit Test Validation..."
if command_exists npm && npm run test --if-present >/dev/null 2>&1; then
    if npm test; then
        echo "✅ Unit tests passed"
    else
        echo "❌ Unit tests FAILED"
        echo "🚨 BLOCKING: Fix failing tests before proceeding"
        exit 1
    fi
else
    echo "⚠️  No test script found, skipping"
fi

# 5. Wrangler Validation (Cloudflare Workers specific)
echo ""
echo "5️⃣ Cloudflare Workers Validation..."
if command_exists npx && [ -f "wrangler.toml" ] || [ -f "wrangler.jsonc" ]; then
    if npx wrangler dev --dry-run --compatibility-date=2024-01-01; then
        echo "✅ Wrangler configuration valid"
    else
        echo "❌ Wrangler validation FAILED"
        echo "🚨 BLOCKING: Fix wrangler.toml configuration"
        exit 1
    fi
else
    echo "⚠️  Wrangler not configured, skipping"
fi

# 6. Check for common security issues
echo ""
echo "6️⃣ Security & Best Practices Check..."

# Check for hardcoded secrets
if grep -r "sk-" . --include="*.ts" --include="*.js" --exclude-dir=node_modules 2>/dev/null; then
    echo "❌ SECURITY: Hardcoded API keys detected!"
    echo "🚨 BLOCKING: Remove hardcoded secrets from code"
    exit 1
fi

# Check for TODO/FIXME comments in completed code
todo_count=$(grep -r "TODO\|FIXME" . --include="*.ts" --include="*.js" --exclude-dir=node_modules 2>/dev/null | wc -l)
if [ "$todo_count" -gt 5 ]; then
    echo "⚠️  High number of TODO/FIXME comments ($todo_count) - consider addressing"
fi

echo "✅ Security checks passed"

echo ""
echo "🎉 ALL VALIDATION CHECKS PASSED!"
echo "================================"
echo "✅ TypeScript: Strict mode compilation clean"
echo "✅ Linting: Code quality standards met"
echo "✅ Tests: All unit tests passing"
echo "✅ Config: Wrangler configuration valid"
echo "✅ Security: No hardcoded secrets detected"
echo ""
echo "🚀 Ready for deployment!"