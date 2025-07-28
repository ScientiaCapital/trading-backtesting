# AI Models and Integration Guide

## Overview

ULTRA Trading Platform uses a hybrid AI approach, combining Cloudflare Workers AI with external AI APIs to provide optimal performance, cost-efficiency, and advanced capabilities.

## Available AI Models

### Cloudflare Workers AI Models

#### Text Generation Models
- **@cf/meta/llama-3.1-8b-instruct**
  - Fast, efficient model for general text generation
  - 8B parameters
  - Used for: Risk analysis, performance tracking
  - Context window: 128k tokens

- **@cf/meta/llama-3.3-70b-instruct-fp8-fast**
  - Large model for complex reasoning
  - 70B parameters, optimized with FP8
  - Best for: Advanced analysis when external APIs unavailable
  - Context window: 128k tokens

- **@cf/mistralai/mistral-small-3.1-24b-instruct**
  - Balanced performance and capability
  - 24B parameters
  - Supports vision and tool calling
  - Context window: 128k tokens

- **@cf/google/gemma-3-12b-it**
  - Google's efficient model
  - 12B parameters, multilingual
  - Context window: 128k tokens

- **@cf/qwen/qwen2.5-coder-32b-instruct**
  - Specialized for code generation
  - 32B parameters
  - Best for: Code analysis and optimization

#### Embedding Models
- **@cf/baai/bge-small-en-v1.5**
  - Lightweight embeddings (33M parameters)
  - Dimension: 384

- **@cf/baai/bge-base-en-v1.5**
  - Balanced embeddings (109M parameters)
  - Dimension: 768

- **@cf/baai/bge-large-en-v1.5**
  - High-quality embeddings (335M parameters)
  - Dimension: 1024

- **@cf/baai/bge-m3**
  - Multilingual embeddings
  - Supports 100+ languages

#### Classification Models
- **@cf/huggingface/distilbert-sst-2-int8**
  - Sentiment analysis
  - Outputs: POSITIVE/NEGATIVE
  - Fast inference

#### Image Models
- **@cf/microsoft/resnet-50**
  - Image classification
  - 1000 categories

### External AI APIs

#### Google Gemini API
- **Model**: gemini-pro
- **Purpose**: Advanced market analysis
- **Features**:
  - Multimodal capabilities
  - Large context window
  - Advanced reasoning
- **Usage**: MarketAnalystAgent

#### Anthropic Claude API
- **Model**: claude-3-opus-20240229
- **Purpose**: Complex strategy optimization
- **Features**:
  - Superior reasoning capabilities
  - Code understanding
  - Long-form analysis
- **Usage**: StrategyOptimizerAgent

## API Configuration

### Setting Up API Keys

```bash
# Google Gemini API
wrangler secret put GOOGLE_API_KEY

# Anthropic Claude API
wrangler secret put ANTHROPIC_API_KEY

# Trading APIs
wrangler secret put ALPACA_KEY_ID
wrangler secret put ALPACA_SECRET_KEY
```

### Using Cloudflare Workers AI

```typescript
// Basic text generation
const response = await env.AI.run(
  "@cf/meta/llama-3.1-8b-instruct",
  {
    prompt: "Analyze this market data...",
    max_tokens: 2048,
    temperature: 0.3
  }
);

// Using messages format
const response = await env.AI.run(
  "@cf/meta/llama-3.1-8b-instruct",
  {
    messages: [
      { role: "system", content: "You are a risk analyst..." },
      { role: "user", content: "Assess this portfolio..." }
    ],
    max_tokens: 2048,
    temperature: 0.1
  }
);

// Streaming responses
const stream = await env.AI.run(
  "@cf/meta/llama-3.1-8b-instruct",
  {
    prompt: "Generate trading insights...",
    stream: true
  }
);
```

### Using External APIs

#### Google Gemini
```typescript
const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': env.GOOGLE_API_KEY
  },
  body: JSON.stringify({
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096
    }
  })
});
```

#### Anthropic Claude
```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-opus-20240229',
    max_tokens: 8192,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }]
  })
});
```

## Best Practices

### When to Use Cloudflare Workers AI
- **Real-time decisions**: Risk assessment, performance tracking
- **High-frequency calls**: Market monitoring, order validation
- **Cost-sensitive operations**: Routine analysis
- **Edge deployment**: Low-latency requirements

### When to Use External APIs
- **Complex reasoning**: Strategy optimization, deep analysis
- **Specialized capabilities**: Advanced NLP, code generation
- **Critical decisions**: Large trade approvals
- **Research tasks**: Market research, backtesting analysis

### Model Selection Guidelines

1. **Latency Requirements**
   - < 50ms: Use Cloudflare Workers AI
   - < 500ms: Can use external APIs
   - Real-time: Always use Workers AI

2. **Task Complexity**
   - Simple classification: `distilbert-sst-2-int8`
   - General analysis: `llama-3.1-8b-instruct`
   - Complex reasoning: External APIs (Claude/Gemini)
   - Code generation: `qwen2.5-coder-32b-instruct`

3. **Cost Optimization**
   - Cloudflare Workers AI: No per-request charges
   - External APIs: Pay per token
   - Hybrid approach: Use Workers AI for routine, APIs for complex

### Performance Optimization

1. **Caching Strategies**
   ```typescript
   // Cache AI responses in KV
   const cacheKey = `ai:${model}:${hash(prompt)}`;
   const cached = await env.CACHE.get(cacheKey, 'json');
   if (cached) return cached;
   
   const response = await env.AI.run(model, options);
   await env.CACHE.put(cacheKey, JSON.stringify(response), {
     expirationTtl: 300 // 5 minutes
   });
   ```

2. **Batch Processing**
   ```typescript
   // Batch multiple requests (available models only)
   const responses = await env.AI.run(
     "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
     requests // Array of requests
   );
   ```

3. **Streaming for Long Responses**
   ```typescript
   const stream = await env.AI.run(model, {
     prompt,
     stream: true
   });
   
   return new Response(stream, {
     headers: { 'Content-Type': 'text/event-stream' }
   });
   ```

## Error Handling

```typescript
try {
  const response = await env.AI.run(model, options);
  return response;
} catch (error) {
  // Log error
  console.error('AI inference failed:', error);
  
  // Fallback to different model
  if (model.includes('llama-3.3')) {
    return await env.AI.run('@cf/meta/llama-3.1-8b-instruct', options);
  }
  
  // Return conservative response
  return getConservativeResponse();
}
```

## Monitoring and Observability

### Tracking AI Usage
```typescript
// Log AI calls for monitoring
const startTime = Date.now();
const response = await env.AI.run(model, options);
const duration = Date.now() - startTime;

// Send metrics
await sendMetrics({
  model,
  duration,
  tokens: response.tokens_used,
  success: true
});
```

### Cost Tracking
- Cloudflare Workers AI: Track by request count
- External APIs: Track by token usage
- Set alerts for unusual usage patterns

## Security Considerations

1. **API Key Management**
   - Never commit API keys
   - Use Wrangler secrets
   - Rotate keys regularly

2. **Input Validation**
   - Sanitize user inputs
   - Limit prompt injection risks
   - Validate JSON responses

3. **Rate Limiting**
   - Implement per-user limits
   - Queue high-volume requests
   - Use circuit breakers

## Future Enhancements

### Planned Integrations
- **LoRA Fine-tuning**: Custom models for specific strategies
- **Vector Search**: RAG with Cloudflare Vectorize
- **Multi-modal Analysis**: Chart and news analysis
- **Agent Memory**: Persistent context with KV/D1

### Experimental Features
- **Batch Inference**: For large-scale backtesting
- **Model Routing**: Dynamic model selection
- **Federated Learning**: Privacy-preserving optimization