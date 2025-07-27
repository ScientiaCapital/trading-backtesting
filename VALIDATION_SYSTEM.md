# ULTRA Trading Platform - Validation System 🔥

## Overview
Automated validation hooks that run **immediately** when agents write code or mark todos complete. This catches TypeScript, ESLint, and security issues before they bite us.

## Hook System

### 1. Post-File-Edit Hook
**Triggers**: Every time an agent writes/edits a `.ts`, `.js`, `.tsx`, or `.jsx` file
**Location**: `.claude/hooks/post-file-edit.sh`
**Validation**:
- ✅ TypeScript strict compilation for the specific file
- ✅ ESLint auto-fix and validation
- ✅ Security scan for hardcoded secrets
- ✅ Format validation with Prettier/Biome

### 2. Post-Todo-Update Hook  
**Triggers**: When any agent marks a todo as "completed"
**Location**: `.claude/hooks/post-todo-update.sh`
**Validation**:
- ✅ Full TypeScript project compilation
- ✅ ESLint validation for entire codebase
- ✅ Unit test suite execution
- ✅ Cloudflare Wrangler configuration validation
- ✅ Security audit for hardcoded secrets
- ✅ Performance and best practices check

## Configuration Files

### TypeScript (ULTRA STRICT MODE)
**File**: `ultra-trading/tsconfig.json`
**Features**:
- Strict null checks
- No implicit any
- No unused variables/parameters  
- No unchecked indexed access
- Exact optional property types
- All strict TypeScript flags enabled

### ESLint (Comprehensive Rules)
**File**: `ultra-trading/eslint.config.js`
**Features**:
- TypeScript-specific rules
- Security vulnerability detection
- Cloudflare Workers environment rules
- Performance optimization rules
- Code quality enforcement
- Auto-fixing capabilities

### Testing (Vitest + Coverage)
**File**: `ultra-trading/vitest.config.ts`
**Features**:
- 80% coverage requirement
- Fast execution with V8 coverage
- HTML and JSON reports
- Timeout configurations

### Formatting (Prettier)
**File**: `ultra-trading/.prettierrc.json`
**Features**:
- Consistent code formatting
- Single quotes, semicolons
- 80 character line width
- 2-space indentation

## Agent Integration

### For All Agents
When working on TypeScript/JavaScript files:

1. **Write/Edit Code** → Post-File-Edit Hook runs automatically
2. **Mark Todo Complete** → Post-Todo-Update Hook runs automatically
3. **Fix Any Issues** → Hooks block completion until clean

### Package Scripts Available
```bash
# Individual validation commands
npm run type-check     # TypeScript strict compilation
npm run lint          # ESLint with auto-fix
npm run lint:check    # ESLint without auto-fix
npm run test          # Unit tests
npm run format        # Prettier formatting

# Combined validation
npm run validate      # All checks in sequence
```

## Error Handling

### Immediate Feedback
- ❌ **File Edit Blocked**: TypeScript/ESLint errors prevent file saves
- ❌ **Todo Completion Blocked**: Full validation must pass
- ✅ **Auto-Fix Applied**: Formatting and simple lint issues fixed automatically

### Security Enforcement
- **Hardcoded Secrets**: Automatically detected and blocked
- **API Keys**: Scan for sk-, pk-, AKIA patterns
- **Environment Variables**: Must use proper .env files

### Performance Rules
- **No window/document**: Cloudflare Workers environment enforced
- **Async/await**: Proper patterns required
- **Bundle Size**: Import optimization

## Benefits

### For Development
- 🚀 **Catch Issues Early**: Before they become bugs
- 🔧 **Auto-Fix**: Formatting and simple issues resolved automatically
- 📊 **Coverage**: 80% test coverage requirement
- 🛡️ **Security**: No secrets leak into code

### For Agents
- ✅ **Clear Feedback**: Immediate validation results
- 🔄 **Iterative**: Fix issues as they arise
- 📋 **Todo Safety**: Can't mark complete until code is clean
- 🎯 **Quality**: Production-ready code from the start

## Usage for Agents

### When Writing Code
1. Write your TypeScript/JavaScript
2. Hook runs automatically
3. Fix any reported issues
4. Continue development

### When Completing Tasks  
1. Mark todo as "completed"
2. Full validation runs
3. If any issues → todo stays in_progress
4. Fix issues and try again
5. All green → todo marked completed

This system ensures **ZERO TOLERANCE** for TypeScript errors, lint issues, or security vulnerabilities in our codebase.