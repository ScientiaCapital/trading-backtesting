/**
 * Contextual BM25 Service
 * Implements BM25 algorithm with contextual enhancements for trading data
 * Part of the Anthropic Contextual Retrieval methodology
 */

import { CloudflareBindings } from '@/types';
import { createLogger } from '@/utils';
import { ContextualChunk } from './ContextualEmbeddings';
import { RetrievalResult } from './RAGOrchestrator';

interface BM25Config {
  k1: number; // Controls term frequency saturation
  b: number;  // Controls length normalization
  avgDocLength?: number;
}

interface DocumentStats {
  docFreq: Map<string, number>;
  totalDocs: number;
  avgLength: number;
}

export class ContextualBM25Service {
  private logger: ReturnType<typeof createLogger>;
  private config: BM25Config = {
    k1: 1.2,
    b: 0.75
  };
  
  // Cache for document statistics
  private statsCache = new Map<string, DocumentStats>();
  private tokenCache = new Map<string, string[]>();

  constructor(private _env: CloudflareBindings) {
    this.logger = createLogger({ env: this._env } as any);
  }

  /**
   * Search using BM25 algorithm with contextual enhancements
   */
  async search(query: string, chunks: ContextualChunk[]): Promise<RetrievalResult[]> {
    try {
      // Tokenize query
      const queryTokens = this.tokenize(query);
      
      // Calculate document statistics
      const stats = this.calculateDocumentStats(chunks);
      
      // Score each chunk
      const results: RetrievalResult[] = [];
      
      for (const chunk of chunks) {
        const score = this.calculateBM25Score(
          queryTokens,
          chunk.contextualContent,
          stats
        );
        
        results.push({
          chunk,
          score,
          relevanceScore: score,
          bm25Score: score
        });
      }
      
      // Sort by score
      return results.sort((a, b) => b.score - a.score);
      
    } catch (error) {
      this.logger.error('BM25 search failed', { error, query });
      throw error;
    }
  }

  /**
   * Calculate BM25 score for a document
   */
  private calculateBM25Score(
    queryTokens: string[],
    content: string,
    stats: DocumentStats
  ): number {
    const docTokens = this.tokenize(content);
    const docLength = docTokens.length;
    let score = 0;

    // Count term frequencies in document
    const termFreq = new Map<string, number>();
    for (const token of docTokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    // Calculate score for each query term
    for (const queryToken of queryTokens) {
      const tf = termFreq.get(queryToken) || 0;
      if (tf === 0) continue;

      // IDF calculation
      const df = stats.docFreq.get(queryToken) || 0;
      const idf = Math.log((stats.totalDocs - df + 0.5) / (df + 0.5));

      // BM25 formula
      const numerator = tf * (this.config.k1 + 1);
      const denominator = tf + this.config.k1 * (
        1 - this.config.b + this.config.b * (docLength / stats.avgLength)
      );

      score += idf * (numerator / denominator);
    }

    // Boost score for trading-specific terms
    score *= this.calculateTradingRelevanceBoost(queryTokens, docTokens);

    return score;
  }

  /**
   * Calculate document statistics for BM25
   */
  private calculateDocumentStats(chunks: ContextualChunk[]): DocumentStats {
    // Check cache
    const cacheKey = chunks.map(c => `${c.symbol}-${c.timestamp}`).join(':');
    const cached = this.statsCache.get(cacheKey);
    if (cached) return cached;

    const docFreq = new Map<string, number>();
    let totalLength = 0;

    // Calculate document frequencies
    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.contextualContent);
      const uniqueTokens = new Set(tokens);
      
      totalLength += tokens.length;
      
      for (const token of uniqueTokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }

    const stats: DocumentStats = {
      docFreq,
      totalDocs: chunks.length,
      avgLength: totalLength / chunks.length
    };

    // Cache stats
    this.statsCache.set(cacheKey, stats);
    return stats;
  }

  /**
   * Tokenize text for BM25 processing
   */
  private tokenize(text: string): string[] {
    // Check cache
    const cached = this.tokenCache.get(text);
    if (cached) return cached;

    // Convert to lowercase and split
    let tokens = text.toLowerCase()
      .replace(/[^\w\s$%.-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);

    // Handle trading-specific tokens
    tokens = this.processTradingTokens(tokens);

    // Cache tokens
    this.tokenCache.set(text, tokens);
    return tokens;
  }

  /**
   * Process trading-specific tokens
   */
  private processTradingTokens(tokens: string[]): string[] {
    const processed: string[] = [];
    
    for (const token of tokens) {
      // Keep financial symbols intact
      if (token.startsWith('$')) {
        processed.push(token);
        processed.push(token.substring(1)); // Also index without $
        continue;
      }

      // Handle percentages
      if (token.endsWith('%')) {
        processed.push(token);
        processed.push(token.slice(0, -1)); // Also index number
        continue;
      }

      // Handle price levels (e.g., "450.50")
      if (/^\d+\.?\d*$/.test(token)) {
        processed.push(token);
        // Also add rounded version for fuzzy matching
        const rounded = Math.round(parseFloat(token)).toString();
        if (rounded !== token) {
          processed.push(rounded);
        }
        continue;
      }

      // Add synonyms for common trading terms
      const synonyms = this.getTradingSynonyms(token);
      processed.push(token, ...synonyms);
    }

    return processed;
  }

  /**
   * Get synonyms for trading terms
   */
  private getTradingSynonyms(token: string): string[] {
    const synonymMap: Record<string, string[]> = {
      'buy': ['purchase', 'long', 'bid'],
      'sell': ['short', 'ask', 'dump'],
      'bullish': ['positive', 'upward', 'rising'],
      'bearish': ['negative', 'downward', 'falling'],
      'volume': ['vol', 'size', 'quantity'],
      'price': ['px', 'cost', 'value'],
      'option': ['opt', 'contract'],
      'strike': ['k', 'exercise'],
      'call': ['c'],
      'put': ['p'],
      'volatility': ['vol', 'iv', 'sigma'],
      'gamma': ['γ'],
      'delta': ['δ'],
      'theta': ['θ'],
      'vega': ['ν'],
      'rho': ['ρ']
    };

    return synonymMap[token] || [];
  }

  /**
   * Calculate relevance boost for trading-specific content
   */
  private calculateTradingRelevanceBoost(
    queryTokens: string[],
    docTokens: string[]
  ): number {
    let boost = 1.0;
    const docTokenSet = new Set(docTokens);

    // Boost for options-related queries
    const optionsTerms = ['option', 'call', 'put', 'strike', 'expiry', 'gamma', 'delta'];
    const hasOptionsQuery = queryTokens.some(t => optionsTerms.includes(t));
    const hasOptionsDoc = optionsTerms.some(t => docTokenSet.has(t));
    
    if (hasOptionsQuery && hasOptionsDoc) {
      boost *= 1.2;
    }

    // Boost for urgency indicators
    const urgencyTerms = ['now', 'urgent', 'immediately', 'alert', 'breaking'];
    const hasUrgency = queryTokens.some(t => urgencyTerms.includes(t));
    if (hasUrgency) {
      boost *= 1.15;
    }

    // Boost for technical analysis
    const technicalTerms = ['rsi', 'macd', 'bollinger', 'support', 'resistance', 'breakout'];
    const hasTechnicalQuery = queryTokens.some(t => technicalTerms.includes(t));
    const hasTechnicalDoc = technicalTerms.some(t => docTokenSet.has(t));
    
    if (hasTechnicalQuery && hasTechnicalDoc) {
      boost *= 1.1;
    }

    return boost;
  }

  /**
   * Update BM25 configuration
   */
  updateConfig(newConfig: Partial<BM25Config>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Updated BM25 config', { config: this.config });
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.statsCache.clear();
    this.tokenCache.clear();
    this.logger.info('Cleared BM25 caches');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    statsCacheSize: number;
    tokenCacheSize: number;
  } {
    return {
      statsCacheSize: this.statsCache.size,
      tokenCacheSize: this.tokenCache.size
    };
  }
}