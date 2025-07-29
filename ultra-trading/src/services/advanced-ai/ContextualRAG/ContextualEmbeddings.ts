/**
 * Contextual Embeddings Service
 * Based on Anthropic's Contextual Retrieval methodology
 * Reduces retrieval failures by 49% by adding context to chunks before embedding
 */

import { CloudflareBindings } from '@/types';
import { createLogger } from '@/utils';
import { MarketData, Position } from '@/types/strategy';

export interface MarketDataChunk {
  symbol: string;
  timestamp: Date;
  price: number;
  volume: number;
  content: string;
  metadata?: Record<string, any>;
}

export interface ContextualChunk extends MarketDataChunk {
  context: string;
  contextualContent: string;
  embeddings?: number[];
}

export interface ChunkContext {
  timeContext: string;
  marketContext: string;
  relatedAssets: string[];
  technicalContext?: string;
  sentimentContext?: string;
}

export class ContextualEmbeddingsService {
  private logger: ReturnType<typeof createLogger>;
  private contextCache: Map<string, ChunkContext> = new Map();

  constructor(private env: CloudflareBindings) {
    this.logger = createLogger({ env } as any);
  }

  /**
   * Add rich context to market data chunks before embedding
   * This dramatically improves retrieval accuracy
   */
  async addContextToChunk(chunk: MarketDataChunk): Promise<ContextualChunk> {
    try {
      const context = await this.generateContext(chunk);
      const contextualContent = this.buildContextualContent(chunk, context);

      return {
        ...chunk,
        context: this.formatContext(context),
        contextualContent
      };
    } catch (error) {
      this.logger.error('Failed to add context to chunk', { error, chunk });
      throw error;
    }
  }

  /**
   * Generate comprehensive context for a market data chunk
   */
  private async generateContext(chunk: MarketDataChunk): Promise<ChunkContext> {
    // Check cache first
    const cacheKey = `${chunk.symbol}-${chunk.timestamp.toISOString()}`;
    const cached = this.contextCache.get(cacheKey);
    if (cached) return cached;

    const context: ChunkContext = {
      timeContext: this.generateTimeContext(chunk.timestamp),
      marketContext: await this.generateMarketContext(chunk),
      relatedAssets: await this.findRelatedAssets(chunk.symbol),
      technicalContext: await this.generateTechnicalContext(chunk),
      sentimentContext: await this.generateSentimentContext(chunk)
    };

    // Cache for reuse
    this.contextCache.set(cacheKey, context);
    return context;
  }

  /**
   * Generate time-based context (market hours, day of week, etc.)
   */
  private generateTimeContext(timestamp: Date): string {
    const hour = timestamp.getHours();
    const minute = timestamp.getMinutes();
    const dayOfWeek = timestamp.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let timeContext = `Time: ${dayNames[dayOfWeek]} ${timestamp.toLocaleString()}. `;
    
    // Market session context
    if (hour === 9 && minute < 30) {
      timeContext += 'Pre-market session. ';
    } else if (hour === 9 && minute === 30) {
      timeContext += 'Market open. ';
    } else if (hour >= 9 && hour < 16) {
      timeContext += 'Regular trading hours. ';
    } else if (hour === 15 && minute >= 50) {
      timeContext += 'Market closing soon. ';
    } else if (hour === 16) {
      timeContext += 'Market close. ';
    } else if (hour > 16 || hour < 9) {
      timeContext += 'After-hours trading. ';
    }

    // Special market events
    if (hour === 14 && minute === 0) {
      timeContext += 'Fed announcement time. ';
    }

    return timeContext;
  }

  /**
   * Generate market condition context
   */
  private async generateMarketContext(chunk: MarketDataChunk): Promise<string> {
    let context = '';

    // Volume context
    if (chunk.volume && chunk.metadata?.avgVolume) {
      const volumeRatio = chunk.volume / chunk.metadata.avgVolume;
      if (volumeRatio > 2) {
        context += 'Unusually high volume. ';
      } else if (volumeRatio < 0.5) {
        context += 'Low volume. ';
      }
    }

    // Price movement context
    if (chunk.metadata?.dayChange) {
      const change = chunk.metadata.dayChange;
      if (Math.abs(change) > 5) {
        context += `Significant ${change > 0 ? 'gain' : 'loss'} of ${Math.abs(change).toFixed(2)}%. `;
      }
    }

    // Market regime
    if (chunk.metadata?.vix) {
      const vix = chunk.metadata.vix;
      if (vix > 30) {
        context += 'High volatility environment. ';
      } else if (vix < 15) {
        context += 'Low volatility environment. ';
      }
    }

    return context || 'Normal market conditions. ';
  }

  /**
   * Find related assets for correlation context
   */
  private async findRelatedAssets(symbol: string): Promise<string[]> {
    // Sector-based relationships
    const sectorMap: Record<string, string[]> = {
      AAPL: ['MSFT', 'GOOGL', 'META', 'NVDA'],
      TSLA: ['RIVN', 'LCID', 'NIO', 'F'],
      JPM: ['BAC', 'WFC', 'GS', 'MS'],
      // Add more mappings
    };

    return sectorMap[symbol] || [];
  }

  /**
   * Generate technical analysis context
   */
  private async generateTechnicalContext(chunk: MarketDataChunk): Promise<string> {
    if (!chunk.metadata?.technicals) return '';

    const { rsi, macd, bollingerBands } = chunk.metadata.technicals;
    let context = '';

    if (rsi) {
      if (rsi > 70) context += 'RSI indicates overbought conditions. ';
      else if (rsi < 30) context += 'RSI indicates oversold conditions. ';
    }

    if (macd?.signal) {
      if (macd.histogram > 0) context += 'MACD bullish. ';
      else context += 'MACD bearish. ';
    }

    if (bollingerBands) {
      const { upper, lower, middle } = bollingerBands;
      if (chunk.price > upper) context += 'Price above upper Bollinger Band. ';
      else if (chunk.price < lower) context += 'Price below lower Bollinger Band. ';
    }

    return context;
  }

  /**
   * Generate sentiment context from news/social
   */
  private async generateSentimentContext(chunk: MarketDataChunk): Promise<string> {
    if (!chunk.metadata?.sentiment) return '';

    const { score, sources } = chunk.metadata.sentiment;
    let context = '';

    if (score > 0.7) context += 'Strong positive sentiment. ';
    else if (score < -0.7) context += 'Strong negative sentiment. ';
    else if (score > 0.3) context += 'Positive sentiment. ';
    else if (score < -0.3) context += 'Negative sentiment. ';
    else context += 'Neutral sentiment. ';

    if (sources?.length > 0) {
      context += `Based on ${sources.length} sources. `;
    }

    return context;
  }

  /**
   * Build the final contextual content string
   */
  private buildContextualContent(chunk: MarketDataChunk, context: ChunkContext): string {
    const contextParts = [
      `<context>`,
      `Symbol: ${chunk.symbol}`,
      context.timeContext,
      context.marketContext,
      context.relatedAssets.length > 0 ? `Related assets: ${context.relatedAssets.join(', ')}` : '',
      context.technicalContext || '',
      context.sentimentContext || '',
      `</context>`,
      chunk.content
    ];

    return contextParts.filter(Boolean).join('\n');
  }

  /**
   * Format context for storage
   */
  private formatContext(context: ChunkContext): string {
    return JSON.stringify(context, null, 2);
  }

  /**
   * Process multiple chunks in parallel
   */
  async addContextToChunks(chunks: MarketDataChunk[]): Promise<ContextualChunk[]> {
    const promises = chunks.map(chunk => this.addContextToChunk(chunk));
    return Promise.all(promises);
  }

  /**
   * Generate embeddings for contextual chunks
   */
  async generateEmbeddings(chunk: ContextualChunk): Promise<ContextualChunk> {
    try {
      // Use Cloudflare Workers AI for embeddings
      const embeddings = await this.env.AI.run(
        '@cf/baai/bge-base-en-v1.5',
        {
          text: chunk.contextualContent
        }
      );

      return {
        ...chunk,
        embeddings: embeddings.data[0]
      };
    } catch (error) {
      this.logger.error('Failed to generate embeddings', { error });
      throw error;
    }
  }

  /**
   * Clear context cache (call periodically)
   */
  clearCache(): void {
    const cacheSize = this.contextCache.size;
    this.contextCache.clear();
    this.logger.info('Cleared context cache', { entries: cacheSize });
  }
}