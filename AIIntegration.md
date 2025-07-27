# AI Integration Guide for ULTRA Trading Platform

This document provides comprehensive patterns and examples for integrating AI capabilities using **Anthropic Claude** and **Google Gemini** APIs. 

**NO OpenAI dependencies** - We exclusively use Anthropic and Google's AI services.

## 📦 Required Packages

### TypeScript/Node.js
```bash
# For Cloudflare Workers
pnpm add @anthropic-ai/sdk @google/generative-ai zod
pnpm add -D @types/node @cloudflare/workers-types
```

### Python
```bash
# For notebooks and backtesting
pip install anthropic google-generativeai langchain chromadb transformers
```

## 🔑 Environment Configuration

```bash
# .env.local
ANTHROPIC_API_KEY="sk-ant-api06-..."
GOOGLE_API_KEY="AIza..."

# Cloudflare secrets
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put GOOGLE_API_KEY
```

## 🤖 Universal AI Client Implementation

### TypeScript Implementation

```typescript
// src/services/ai-service.ts
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

export interface AIServiceConfig {
  anthropicKey: string;
  googleKey: string;
  defaultProvider?: 'anthropic' | 'gemini';
}

export class AIService {
  private anthropic: Anthropic;
  private gemini: GoogleGenerativeAI;
  
  constructor(private config: AIServiceConfig) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicKey
    });
    this.gemini = new GoogleGenerativeAI(config.googleKey);
  }
  
  /**
   * Generate text using either Anthropic Claude or Google Gemini
   */
  async generateText(
    prompt: string,
    options?: {
      provider?: 'anthropic' | 'gemini';
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    const provider = options?.provider || this.config.defaultProvider || 'anthropic';
    
    if (provider === 'anthropic') {
      const response = await this.anthropic.messages.create({
        model: options?.model || 'claude-3-opus-20240229',
        messages: [
          ...(options?.systemPrompt ? [{
            role: 'assistant' as const,
            content: options.systemPrompt
          }] : []),
          { role: 'user' as const, content: prompt }
        ],
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7
      });
      
      return response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';
    } else {
      const model = this.gemini.getGenerativeModel({ 
        model: options?.model || 'gemini-pro' 
      });
      
      const result = await model.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ text: prompt }] 
        }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens || 4096,
          temperature: options?.temperature || 0.7
        }
      });
      
      return result.response.text();
    }
  }
  
  /**
   * Stream responses for real-time applications
   */
  async *streamText(
    prompt: string,
    options?: {
      provider?: 'anthropic' | 'gemini';
      model?: string;
    }
  ): AsyncGenerator<string> {
    const provider = options?.provider || 'anthropic';
    
    if (provider === 'anthropic') {
      const stream = await this.anthropic.messages.create({
        model: options?.model || 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        stream: true
      });
      
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && 
            event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    } else {
      const model = this.gemini.getGenerativeModel({ 
        model: options?.model || 'gemini-pro' 
      });
      
      const result = await model.generateContentStream(prompt);
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    }
  }
  
  /**
   * Generate embeddings using Cloudflare Workers AI
   */
  async embedText(text: string, env: any): Promise<number[]> {
    const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });
    
    return response.data[0];
  }
}
```

## 🎯 Trading-Specific AI Patterns

### Strategy Analysis with Claude

```typescript
// src/services/strategy-analyzer.ts
export class StrategyAnalyzer {
  constructor(private ai: AIService) {}
  
  async analyzeStrategy(strategy: {
    name: string;
    code: string;
    historicalPerformance?: any;
  }): Promise<StrategyAnalysis> {
    const prompt = `
Analyze this trading strategy for potential risks and improvements:

Strategy Name: ${strategy.name}

Code:
\`\`\`python
${strategy.code}
\`\`\`

${strategy.historicalPerformance ? `
Historical Performance:
- Win Rate: ${strategy.historicalPerformance.winRate}%
- Sharpe Ratio: ${strategy.historicalPerformance.sharpeRatio}
- Max Drawdown: ${strategy.historicalPerformance.maxDrawdown}%
` : ''}

Provide analysis in JSON format with:
1. Risk assessment (1-10 scale)
2. Suggested improvements
3. Market conditions where this strategy works best
4. Potential pitfalls
`;

    const response = await this.ai.generateText(prompt, {
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      systemPrompt: 'You are an expert quantitative trading analyst.'
    });
    
    return JSON.parse(response);
  }
}
```

### Market Sentiment Analysis with Gemini

```typescript
// src/services/market-sentiment.ts
export class MarketSentimentAnalyzer {
  constructor(private ai: AIService) {}
  
  async analyzeSentiment(
    ticker: string,
    newsHeadlines: string[]
  ): Promise<SentimentScore> {
    const prompt = `
Analyze market sentiment for ${ticker} based on these recent headlines:

${newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Return a JSON object with:
- sentiment: "bullish" | "bearish" | "neutral"
- score: number between -1 (very bearish) and 1 (very bullish)
- confidence: number between 0 and 1
- key_factors: array of strings
`;

    const response = await this.ai.generateText(prompt, {
      provider: 'gemini',
      model: 'gemini-pro',
      temperature: 0.3 // Lower temperature for more consistent analysis
    });
    
    return JSON.parse(response);
  }
}
```

## 🔄 RAG Pipeline with Cloudflare

### Strategy Knowledge Base

```typescript
// src/services/rag-pipeline.ts
export class TradingRAGPipeline {
  constructor(
    private ai: AIService,
    private env: CloudflareEnv
  ) {}
  
  /**
   * Ingest trading strategies into vector database
   */
  async ingestStrategy(strategy: {
    name: string;
    description: string;
    code: string;
    performance: any;
  }): Promise<void> {
    // Create chunks for different aspects
    const chunks = [
      `Strategy: ${strategy.name}\nDescription: ${strategy.description}`,
      `Code Implementation:\n${strategy.code}`,
      `Performance Metrics:\n${JSON.stringify(strategy.performance, null, 2)}`
    ];
    
    // Generate embeddings and store
    const vectors = await Promise.all(
      chunks.map(async (chunk, idx) => {
        const embedding = await this.ai.embedText(chunk, this.env);
        
        return {
          id: `${strategy.name}-${idx}`,
          values: embedding,
          metadata: {
            strategyName: strategy.name,
            chunkType: ['description', 'code', 'performance'][idx],
            text: chunk
          }
        };
      })
    );
    
    await this.env.VECTORIZE.upsert(vectors);
  }
  
  /**
   * Query for similar strategies
   */
  async findSimilarStrategies(
    query: string,
    topK: number = 5
  ): Promise<StrategyRecommendation[]> {
    // Generate query embedding
    const queryEmbedding = await this.ai.embedText(query, this.env);
    
    // Search for similar strategies
    const results = await this.env.VECTORIZE.query(queryEmbedding, {
      topK: topK * 3, // Get more to filter by strategy
      returnMetadata: true
    });
    
    // Group by strategy and use Claude for ranking
    const strategiesByName = new Map<string, any[]>();
    results.matches.forEach(match => {
      const name = match.metadata.strategyName;
      if (!strategiesByName.has(name)) {
        strategiesByName.set(name, []);
      }
      strategiesByName.get(name)!.push(match);
    });
    
    // Use AI to rank and explain recommendations
    const recommendations = await Promise.all(
      Array.from(strategiesByName.entries()).slice(0, topK).map(
        async ([strategyName, matches]) => {
          const context = matches
            .map(m => m.metadata.text)
            .join('\n\n');
          
          const explanation = await this.ai.generateText(
            `Based on this context about ${strategyName} strategy:
            
${context}

Explain why this strategy might be relevant for the query: "${query}"
Keep it concise (2-3 sentences).`,
            { provider: 'anthropic', temperature: 0.5 }
          );
          
          return {
            strategyName,
            relevanceScore: matches[0].score,
            explanation
          };
        }
      )
    );
    
    return recommendations;
  }
}
```

## 🧠 GraphRAG for Trading Relationships

### Entity Extraction with Gemini

```typescript
// src/services/graph-rag.ts
export class TradingGraphRAG {
  constructor(
    private ai: AIService,
    private env: CloudflareEnv
  ) {}
  
  async extractTradingEntities(text: string): Promise<TradingKnowledgeGraph> {
    const prompt = `
Extract trading-related entities and relationships from this text:

${text}

Return a JSON object with:
{
  "entities": [
    {
      "name": "entity name",
      "type": "ASSET|STRATEGY|INDICATOR|PATTERN|TRADER|EXCHANGE",
      "properties": {}
    }
  ],
  "relationships": [
    {
      "source": "entity1",
      "target": "entity2",
      "type": "USES|CORRELATES_WITH|TRADED_ON|DEVELOPED_BY|SIMILAR_TO",
      "properties": {}
    }
  ]
}
`;

    const response = await this.ai.generateText(prompt, {
      provider: 'gemini',
      model: 'gemini-pro',
      temperature: 0.2
    });
    
    return JSON.parse(response);
  }
  
  async queryWithContext(
    question: string,
    context: TradingKnowledgeGraph
  ): Promise<string> {
    const graphContext = this.formatGraphContext(context);
    
    return this.ai.generateText(
      `Using this trading knowledge graph:
      
${graphContext}

Answer this question: ${question}

Provide specific details and relationships from the graph.`,
      {
        provider: 'anthropic',
        model: 'claude-3-opus-20240229'
      }
    );
  }
}
```

## 🎨 Function Calling Examples

### Anthropic Function Calling

```typescript
const tools = [{
  name: "execute_trade",
  description: "Execute a trade on Alpaca",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Stock symbol" },
      quantity: { type: "number", description: "Number of shares" },
      side: { type: "string", enum: ["buy", "sell"] },
      order_type: { type: "string", enum: ["market", "limit"] },
      limit_price: { type: "number", description: "Limit price (if limit order)" }
    },
    required: ["symbol", "quantity", "side", "order_type"]
  }
}];

const response = await anthropic.messages.create({
  model: "claude-3-opus-20240229",
  messages: [{ 
    role: "user", 
    content: "Buy 100 shares of AAPL at market price" 
  }],
  tools: tools,
  tool_choice: { type: "auto" }
});
```

### Gemini Function Calling

```typescript
const functions = [{
  name: 'analyzeOptions',
  description: 'Analyze options chain for a given symbol',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string' },
      expiration: { type: 'string', format: 'date' },
      strategy: { 
        type: 'string', 
        enum: ['covered-call', 'cash-secured-put', 'iron-condor'] 
      }
    },
    required: ['symbol', 'strategy']
  }
}];

const model = gemini.getGenerativeModel({
  model: 'gemini-pro',
  tools: [{ functionDeclarations: functions }]
});

const result = await model.generateContent(
  "Find the best covered call opportunities for TSLA"
);
```

## 🔐 Security Considerations

### API Key Management

```typescript
// src/utils/crypto.ts
export class SecureCredentials {
  static async encrypt(
    data: string,
    key: CryptoKey
  ): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }
}
```

### Rate Limiting

```typescript
// src/middleware/rate-limit.ts
export class AIRateLimiter {
  constructor(private kv: KVNamespace) {}
  
  async checkLimit(
    tenantId: string,
    provider: 'anthropic' | 'gemini'
  ): Promise<boolean> {
    const key = `rate:${provider}:${tenantId}`;
    const limits = {
      anthropic: { requests: 100, window: 60 }, // 100 req/min
      gemini: { requests: 60, window: 60 }      // 60 req/min
    };
    
    const current = await this.kv.get(key);
    const count = current ? parseInt(current) : 0;
    
    if (count >= limits[provider].requests) {
      return false;
    }
    
    await this.kv.put(
      key,
      String(count + 1),
      { expirationTtl: limits[provider].window }
    );
    
    return true;
  }
}
```

## 📊 Cost Optimization

### Provider Selection Strategy

```typescript
export class CostOptimizedAI {
  async selectProvider(
    task: 'analysis' | 'quick-response' | 'code-generation'
  ): Promise<'anthropic' | 'gemini'> {
    const costs = {
      anthropic: {
        'claude-3-opus': 0.015,    // per 1K tokens
        'claude-3-sonnet': 0.003   
      },
      gemini: {
        'gemini-pro': 0.00025,     // per 1K chars
        'gemini-ultra': 0.002
      }
    };
    
    // Use Gemini for quick responses, Claude for complex analysis
    return task === 'quick-response' ? 'gemini' : 'anthropic';
  }
}
```

## 🧪 Testing AI Integrations

```typescript
// tests/ai-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AIService } from '../src/services/ai-service';

describe('AIService', () => {
  it('should generate text with Anthropic', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response' }]
    });
    
    vi.mock('@anthropic-ai/sdk', () => ({
      default: vi.fn(() => ({
        messages: { create: mockCreate }
      }))
    }));
    
    const service = new AIService({
      anthropicKey: 'test-key',
      googleKey: 'test-key'
    });
    
    const result = await service.generateText('Test prompt');
    
    expect(result).toBe('Test response');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: 'Test prompt' }]
      })
    );
  });
});
```

## 🚀 Best Practices

1. **Provider Selection**:
   - Use Claude for complex analysis, code generation, and detailed explanations
   - Use Gemini for quick responses, entity extraction, and high-volume operations
   - Use Cloudflare AI for embeddings to minimize latency

2. **Error Handling**:
   - Always implement retry logic with exponential backoff
   - Have fallback providers configured
   - Log all AI interactions for debugging

3. **Context Management**:
   - Keep prompts under 100K tokens for Claude
   - Use conversation history sparingly to optimize costs
   - Implement context windowing for long conversations

4. **Performance**:
   - Cache AI responses in KV with appropriate TTL
   - Use streaming for real-time applications
   - Batch similar requests when possible

5. **Security**:
   - Never expose API keys in client-side code
   - Encrypt stored credentials
   - Implement per-tenant rate limiting
   - Sanitize all user inputs before sending to AI

## 📚 Additional Resources

- [Anthropic API Documentation](https://docs.anthropic.com)
- [Google Generative AI Documentation](https://ai.google.dev)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai)
- [LangChain Documentation](https://docs.langchain.com)

Remember: We are building on Cloudflare's edge infrastructure for maximum performance and cost efficiency. Always consider the edge runtime constraints when implementing AI features.