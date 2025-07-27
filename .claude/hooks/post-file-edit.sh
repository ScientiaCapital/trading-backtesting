#!/bin/bash
# Post-File-Edit Hook - Validates TypeScript/ESLint immediately after file edits
# This runs automatically when any agent writes or edits TypeScript/JavaScript files

set -e

# Get the file that was edited from the first argument
EDITED_FILE="$1"

# Only run for TypeScript/JavaScript files
if [[ ! "$EDITED_FILE" =~ \.(ts|js|tsx|jsx)$ ]]; then
    exit 0
fi

echo "🔍 Validating edited file: $EDITED_FILE"

# Navigate to project root
PROJECT_ROOT="/Users/tmk/Documents/trading-backtesting"
if [[ "$EDITED_FILE" == *"ultra-trading"* ]]; then
    cd "$PROJECT_ROOT/ultra-trading"
else
    cd "$PROJECT_ROOT"
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "🔥 IMMEDIATE FILE VALIDATION"
echo "============================"

# 1. TypeScript Check for specific file
if command_exists npx && [ -f "tsconfig.json" ]; then
    echo "1️⃣ TypeScript check for: $(basename "$EDITED_FILE")"
    if npx tsc --noEmit "$EDITED_FILE"; then
        echo "✅ TypeScript compilation passed"
    else
        echo "❌ TypeScript compilation FAILED for $EDITED_FILE"
        echo "🚨 IMMEDIATE FIX REQUIRED: TypeScript errors detected"
        exit 1
    fi
fi

# 2. ESLint Check for specific file
if command_exists npx && ([ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]); then
    echo "2️⃣ ESLint check for: $(basename "$EDITED_FILE")"
    if npx eslint "$EDITED_FILE" --fix; then
        echo "✅ ESLint passed (auto-fixed if needed)"
    else
        echo "❌ ESLint FAILED for $EDITED_FILE"
        echo "🚨 IMMEDIATE FIX REQUIRED: Linting errors detected"
        exit 1
    fi
fi

# 3. Biome Check for specific file
if command_exists npx && [ -f "biome.json" ]; then
    echo "3️⃣ Biome check for: $(basename "$EDITED_FILE")"
    if npx @biomejs/biome check --apply "$EDITED_FILE"; then
        echo "✅ Biome passed (auto-formatted if needed)"
    else
        echo "❌ Biome FAILED for $EDITED_FILE"
        echo "🚨 IMMEDIATE FIX REQUIRED: Format/lint errors detected"
        exit 1
    fi
fi

# 4. Security check for the specific file
echo "4️⃣ Security check for: $(basename "$EDITED_FILE")"
if grep -q "sk-\|pk-\|AKIA\|password\|secret" "$EDITED_FILE" 2>/dev/null; then
    echo "❌ SECURITY VIOLATION: Potential hardcoded credentials in $EDITED_FILE"
    echo "🚨 IMMEDIATE FIX REQUIRED: Remove hardcoded secrets"
    exit 1
else
    echo "✅ No hardcoded secrets detected"
fi

echo ""
echo "✅ File validation passed for: $(basename "$EDITED_FILE")"