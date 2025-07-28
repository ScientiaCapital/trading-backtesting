# 🚀 ULTRA Trading Platform - AI-Powered Workers Deployment Guide

**⚠️ IMPORTANT: This is a Cloudflare Workers application with AI agents, NOT a Pages application**

## Current Live Deployments

- **Production**: https://ultra-trading.tkipper.workers.dev
- **Staging**: https://ultra-trading-staging.tkipper.workers.dev

## ✅ Workers-Only Deployment

This platform uses **Cloudflare Workers** with static assets, not Pages. All deployments must be done via Wrangler CLI.

### Quick Deployment

```bash
# Deploy to staging
wrangler deploy --env staging --minify

# Deploy to production  
wrangler deploy --env production --minify

# Or use npm scripts
npm run deploy:staging
npm run deploy:production
```

## Manual Step-by-Step Setup

### 1. Prerequisites

- Cloudflare account with Workers plan
- Wrangler CLI installed and authenticated: `wrangler login`
- Domain for custom deployment (optional)

### 2. Create Cloudflare Resources

```bash
# Create all resources automatically (includes AI bindings)
npm run setup:cloudflare

# OR create manually:
wrangler d1 create ultra-trading-staging
wrangler d1 create ultra-trading-production
wrangler kv:namespace create "CACHE" --env staging
wrangler kv:namespace create "CACHE" --env production
wrangler r2 bucket create ultra-data-staging
wrangler r2 bucket create ultra-data-production

# Note: AI bindings are configured in wrangler.jsonc
# Durable Objects for agent coordination are auto-created
```

### 3. Update Configuration

The setup script automatically updates `wrangler.jsonc` with actual resource IDs. If doing manually, update these placeholders:

- `YOUR_STAGING_D1_DATABASE_ID`
- `YOUR_PRODUCTION_D1_DATABASE_ID`  
- `YOUR_STAGING_KV_NAMESPACE_ID`
- `YOUR_PRODUCTION_KV_NAMESPACE_ID`

### 4. Set Secrets (Including AI Keys)

```bash
# Interactive setup for all secrets
npm run setup:secrets:staging
npm run setup:secrets:production

# OR set individual secrets:
wrangler secret put ALPACA_API_KEY --env staging
wrangler secret put ALPACA_API_SECRET --env staging
wrangler secret put ANTHROPIC_API_KEY --env staging
wrangler secret put GOOGLE_AI_API_KEY --env staging
wrangler secret put JWT_SECRET --env staging
wrangler secret put ENCRYPTION_KEY --env staging
```

### 5. Initialize Databases

```bash
# Initialize database schemas
npm run db:init
```

### 6. Deploy to Staging

```bash
# Deploy to staging environment
npm run deploy:staging

# Check deployment status
wrangler tail --env staging
```

### 7. Test Staging Deployment

```bash
# Test API endpoints
curl https://ultra-trading-staging.your-subdomain.workers.dev/api/v1/health
curl https://ultra-trading-staging.your-subdomain.workers.dev/api/v1/trading/market/status

# Test AI agent endpoints
curl https://ultra-trading-staging.your-subdomain.workers.dev/api/v1/ai/agents/status
curl -X POST https://ultra-trading-staging.your-subdomain.workers.dev/api/v1/ai/agents/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "type": "market_analysis"}'
```

### 8. Deploy to Production

```bash
# Deploy to production environment
npm run deploy:production

# Monitor production logs
wrangler tail --env production
```

## Environment URLs

- **Development**: `http://localhost:8787`
- **Staging**: `https://ultra-trading-staging.your-subdomain.workers.dev`
- **Production**: `https://ultra-trading.your-domain.com` (custom domain)

## Common Commands

```bash
# Development
npm run dev                    # Start local development server
npm run market:prep           # Run pre-market preparation script
npm run agents:test          # Test AI agents locally

# Building & Testing
npm run validate              # Run all tests and checks
npm run type-check           # TypeScript type checking
npm run lint                 # Code linting
npm run test:agents          # Test AI agent integration

# Deployment
npm run deploy:staging       # Deploy to staging
npm run deploy:production    # Deploy to production

# Monitoring
npm run logs:staging         # View staging logs
npm run logs:production      # View production logs

# Database
npm run db:init              # Initialize databases
npm run db:migrate           # Run migrations

# Secrets Management
npm run setup:secrets        # Set up secrets for all environments
npm run setup:secrets:staging    # Set up staging secrets only
npm run setup:secrets:production # Set up production secrets only
```

## Security Best Practices

### Secrets Management

- ✅ **Never commit secrets to git**
- ✅ **Use different API keys for staging and production**
- ✅ **Regularly rotate your API keys**
- ✅ **Monitor secret usage in Cloudflare dashboard**
- ✅ **Use strong, generated passwords for JWT_SECRET and ENCRYPTION_KEY**

### API Security

- ✅ **Enable authentication for all trading endpoints**
- ✅ **Use HTTPS only in production**
- ✅ **Implement rate limiting**
- ✅ **Monitor for suspicious activity**
- ✅ **Set up alerts for failed authentication attempts**

### Trading Security

- ✅ **Start with paper trading in staging**
- ✅ **Test all strategies thoroughly before production**
- ✅ **Set up stop-loss and risk management rules**
- ✅ **Monitor all trades and positions**
- ✅ **Have emergency procedures for market disruptions**

## Monitoring & Observability

### Cloudflare Analytics
- View performance metrics in Cloudflare dashboard
- Monitor request volume and response times
- Track error rates and status codes

### Application Logs
```bash
# Real-time log monitoring
wrangler tail --env staging     # Staging logs
wrangler tail --env production  # Production logs
```

### Custom Metrics
- Trading performance metrics
- API response times
- Error tracking and alerting
- Risk management alerts

## Troubleshooting

### Common Issues

**1. Resource Creation Failed**
```bash
# Check if you're logged in
wrangler whoami

# Re-authenticate if needed
wrangler login
```

**2. Database Migration Failed**
```bash
# Run migration manually
wrangler d1 execute ultra-trading-staging --file=migrations/001_initial_schema.sql
```

**3. Secrets Not Working**
```bash
# List current secrets
wrangler secret list --env staging

# Update secret
wrangler secret put SECRET_NAME --env staging
```

**4. Deployment Failed**
```bash
# Check TypeScript errors
npm run type-check

# Check for syntax errors
npm run lint

# Try deploying without minification
wrangler deploy --env staging --no-minify
```

### Getting Help

- Check [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- View [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- Monitor application logs: `npm run logs:staging`
- Check Cloudflare dashboard for resource status

## Production Checklist

Before deploying to production:

- [ ] All tests passing: `npm run validate`
- [ ] AI agent tests passing: `npm run test:agents`
- [ ] Database schema applied
- [ ] All required secrets set (including AI API keys)
- [ ] Custom domain configured (if using)
- [ ] Monitoring and alerting set up
- [ ] AI agent failover procedures tested
- [ ] Backup and recovery procedures documented
- [ ] Risk management rules configured
- [ ] Daily profit target system tested ($300/day)
- [ ] Emergency stop procedures tested
- [ ] Team trained on production procedures

## Next Steps

1. **Custom Domain**: Set up a custom domain for production
2. **SSL Certificate**: Configure SSL/TLS certificates
3. **CDN**: Optimize global performance with Cloudflare CDN
4. **WAF**: Configure Web Application Firewall rules
5. **DDoS Protection**: Enable advanced DDoS protection
6. **Bot Management**: Set up bot detection and blocking
7. **Analytics**: Configure detailed analytics and reporting
8. **AI Model Monitoring**: Track AI agent performance metrics
9. **Cost Optimization**: Monitor AI API usage and costs
10. **Automated Trading**: Enable automated trading features

## AI-Specific Deployment Notes

### Cloudflare AI Bindings
```javascript
// AI models are bound automatically in wrangler.jsonc:
ai = [
  { binding = "AI" }
]
```

### Durable Objects for Agent Coordination
```javascript
// Agent coordinator is bound automatically:
[[durable_objects.bindings]]
name = "AGENT_COORDINATOR"
class_name = "AgentCoordinator"
script_name = "agent-coordinator"
```

### Performance Considerations
- AI agent responses are cached for 60 seconds
- Durable Objects maintain agent state globally
- WebSocket connections enable real-time agent communication
- Cron triggers handle scheduled trading tasks