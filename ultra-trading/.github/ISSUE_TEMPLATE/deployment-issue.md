---
name: Deployment Issue
about: Issues related to deploying the ULTRA Trading Platform
title: '[DEPLOYMENT] '
labels: deployment
assignees: ''
---

## ⚠️ Important: Workers vs Pages

This is a **Cloudflare Workers** application, NOT a Pages application.

**Current Live Deployments:**
- Production: https://ultra-trading.tkipper.workers.dev
- Staging: https://ultra-trading-staging.tkipper.workers.dev

## Deployment Method

**✅ CORRECT: Use Wrangler CLI**
```bash
wrangler deploy --env production --minify
```

**❌ INCORRECT: Don't use Pages GitHub integration**
This will fail with "Missing entry-point" errors.

## Issue Description

Please describe your deployment issue:

**Expected Behavior:**
A clear description of what you expected to happen.

**Actual Behavior:**
A clear description of what actually happened.

**Error Messages:**
```
Paste any error messages here
```

**Environment:**
- OS: [e.g. macOS, Windows, Linux]
- Node.js version: [e.g. 18.0.0]
- Wrangler version: [run `wrangler --version`]

**Additional Context:**
Add any other context about the problem here.