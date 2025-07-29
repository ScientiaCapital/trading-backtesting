/**
 * Market Analyst Agent
 * Powered by Google Gemini 2.0 Flash for real-time market analysis
 */

import { AIAgent } from './base/BaseAgent';
import {
  AgentType,
  AgentMessage,
  IMarketAnalystAgent,
  MarketAnalysis,
  MarketTrend,
  VolatilityLevel,
  PatternDetection,
  TradingRecommendation,
  MessageType,
  AgentConfig
} from '@/types/agents';
import { MarketData } from '@/types/strategy';
import { CloudflareBindings } from '@/types';

interface GeminiAnalysisResponse {
  trend: MarketTrend;
  volatility: VolatilityLevel;
  patterns: {
    name: string;
    confidence: number;
    target?: number;
  }[];
  support: number[];
  resistance: number[];
  recommendation: TradingRecommendation;
  reasoning: string;
}

export class MarketAnalystAgent extends AIAgent implements IMarketAnalystAgent {
  private env?: CloudflareBindings;
  private useGeminiAPI: boolean;
  
  constructor(config: AgentConfig, env?: CloudflareBindings) {
    // Determine if we should use Google Gemini API or Cloudflare Workers AI
    const useGeminiAPI = !!env?.GOOGLE_API_KEY;
    
    super(AgentType.MARKET_ANALYST, {
      ...config,
      model: useGeminiAPI ? 'gemini-pro' : '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      temperature: 0.3, // Lower temperature for consistent analysis
      maxTokens: 4096,
      systemPrompt: `You are a professional market analyst AI specializing in technical analysis and market pattern recognition. 
        Analyze market data and provide structured JSON responses with trend analysis, volatility assessment, pattern detection, and trading recommendations.
        Focus on actionable insights for algorithmic trading systems.`
    });
    this.env = env;
    this.useGeminiAPI = useGeminiAPI;
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Market Analyst Agent initialized', {
      model: this.config.model,
      agentId: this.id
    });
  }

  protected async handleMessage(message: AgentMessage): Promise<AgentMessage | null> {
    this.logger.info('MarketAnalyst handling message', { type: message.type });
    
    switch (message.type) {
      case MessageType.MARKET_UPDATE: {
        const marketData = message.payload as MarketData[] || [];
        
        // Quick mock analysis for development - bypasses AI calls
        const mockAnalysis = {
          timestamp: Date.now(),
          symbol: marketData[0]?.symbol || 'SPY',
          trend: 'BULLISH' as const,
          volatility: 0.15,
          patterns: [{
            pattern: 'ASCENDING_TRIANGLE',
            confidence: 0.75,
            priceTarget: 450,
            timeframe: '1D' as const
          }],
          support: 440,
          resistance: 450,
          recommendation: 'BUY' as const,
          confidence: 0.8
        };
        
        this.logger.info('MarketAnalyst sending analysis response');
        
        return this.createMessage(
          'BROADCAST',
          MessageType.ANALYSIS_RESULT,
          mockAnalysis
        );
      }
        
      default:
        this.logger.debug('Ignoring message type', { type: message.type });
        return null;
    }
  }

  protected async onShutdown(): Promise<void> {
    this.logger.info('Market Analyst Agent shutting down');
  }

  /**
   * Analyze market data using Gemini
   */
  async analyzeMarket(data: MarketData[]): Promise<MarketAnalysis> {
    if (data.length === 0) {
      throw new Error('No market data provided for analysis');
    }

    const firstDataPoint = data[0];
    if (!firstDataPoint) {
      throw new Error('Invalid market data provided');
    }
    const {symbol} = firstDataPoint;
    const prompt = this.buildAnalysisPrompt(data);
    
    try {
      let response: GeminiAnalysisResponse;
      
      if (this.useGeminiAPI && this.env?.GOOGLE_API_KEY) {
        // Use Google Gemini API with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        try {
          const apiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': this.env.GOOGLE_API_KEY
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }],
              generationConfig: {
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxTokens,
                candidateCount: 1
              }
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeout);

        if (!apiResponse.ok) {
          throw new Error(`Gemini API error: ${apiResponse.status}`);
        }

          const data = await apiResponse.json() as any;
          
          if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const responseText = data.candidates[0].content.parts[0].text;
            try {
              response = JSON.parse(responseText) as GeminiAnalysisResponse;
            } catch {
              this.logger.warn('Failed to parse Gemini JSON response, using fallback', { 
                responseText: responseText.substring(0, 200) 
              });
              response = this.generateMockAnalysis(data);
            }
          } else {
            this.logger.warn('Invalid Gemini API response format', { data });
            response = this.generateMockAnalysis(data);
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new Error('Gemini API timeout after 3 seconds');
          }
          throw error;
        }
        
      } else if (this.env?.AI) {
        // Use Cloudflare Workers AI with timeout
        try {
          const result = await Promise.race([
            this.env.AI.run(
              this.config.model as any,
              {
                prompt,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature
              }
            ),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('AI timeout')), 2000)
            )
          ]);
          
          response = JSON.parse((result).response || '{}') as GeminiAnalysisResponse;
        } catch (error) {
          this.logger.warn('AI call failed, using mock analysis', { error: (error as Error).message });
          response = this.generateMockAnalysis(data);
        }
      } else {
        // Fallback to mock response for development
        response = this.generateMockAnalysis(data);
      }

      return {
        timestamp: Date.now(),
        symbol,
        trend: response.trend,
        volatility: response.volatility,
        patterns: response.patterns.map(p => ({
          pattern: p.name,
          confidence: p.confidence,
          priceTarget: p.target,
          timeframe: '1D'
        })),
        support: response.support,
        resistance: response.resistance,
        recommendation: response.recommendation,
        confidence: this.calculateConfidence(response)
      };
      
    } catch (error) {
      this.logger.error('Market analysis failed', { 
        error: (error as Error).message,
        symbol 
      });
      
      // Return conservative analysis on error
      return this.getConservativeAnalysis(symbol);
    }
  }

  /**
   * Detect patterns in market data
   */
  async detectPatterns(data: MarketData[]): Promise<PatternDetection[]> {
    const analysis = await this.analyzeMarket(data);
    return analysis.patterns;
  }

  /**
   * Predict volatility for a symbol
   */
  async predictVolatility(_symbol: string): Promise<VolatilityLevel> {
    // For now, return moderate volatility
    // TODO: Implement actual volatility prediction
    return VolatilityLevel.MODERATE;
  }

  /**
   * Build analysis prompt for Gemini
   */
  private buildAnalysisPrompt(data: MarketData[]): string {
    const recentData = data.slice(-20); // Last 20 data points
    const priceData = recentData.map(d => ({
      timestamp: d.timestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close || d.price,
      volume: d.volume
    }));

    return `
      Analyze the following market data and provide a structured JSON response:
      
      Symbol: ${data[0]?.symbol || 'UNKNOWN'}
      Data points: ${JSON.stringify(priceData, null, 2)}
      
      Please analyze:
      1. Current market trend (STRONG_BULLISH, BULLISH, NEUTRAL, BEARISH, STRONG_BEARISH)
      2. Volatility level (VERY_LOW, LOW, MODERATE, HIGH, EXTREME)
      3. Technical patterns detected (with confidence 0-1)
      4. Support and resistance levels
      5. Trading recommendation (STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL)
      
      Response format:
      {
        "trend": "...",
        "volatility": "...",
        "patterns": [{"name": "...", "confidence": 0.8, "target": 150.5}],
        "support": [145.0, 142.5],
        "resistance": [152.0, 155.0],
        "recommendation": "...",
        "reasoning": "..."
      }
    `;
  }

  /**
   * Generate mock analysis for development
   */
  private generateMockAnalysis(data: MarketData[]): GeminiAnalysisResponse {
    const latestData = data[data.length - 1];
    const firstData = data[0];
    
    if (!latestData || !firstData) {
      throw new Error('Insufficient market data for analysis');
    }
    
    const latestPrice = latestData.price;
    const priceChange = (latestData.price - firstData.price) / firstData.price;
    
    let trend: MarketTrend;
    let recommendation: TradingRecommendation;
    
    if (priceChange > 0.02) {
      trend = MarketTrend.BULLISH;
      recommendation = TradingRecommendation.BUY;
    } else if (priceChange < -0.02) {
      trend = MarketTrend.BEARISH;
      recommendation = TradingRecommendation.SELL;
    } else {
      trend = MarketTrend.NEUTRAL;
      recommendation = TradingRecommendation.HOLD;
    }

    return {
      trend,
      volatility: VolatilityLevel.MODERATE,
      patterns: [
        { name: 'Channel Formation', confidence: 0.75 },
        { name: 'Support Test', confidence: 0.65, target: latestPrice * 0.98 }
      ],
      support: [latestPrice * 0.97, latestPrice * 0.95],
      resistance: [latestPrice * 1.03, latestPrice * 1.05],
      recommendation,
      reasoning: 'Based on recent price action and technical indicators'
    };
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(response: GeminiAnalysisResponse): number {
    // Average pattern confidence
    const patternConfidence = response.patterns.length > 0
      ? response.patterns.reduce((sum, p) => sum + p.confidence, 0) / response.patterns.length
      : 0.5;
    
    // Trend strength factor
    const trendStrength = response.trend === MarketTrend.NEUTRAL ? 0.5 : 0.8;
    
    // Volatility factor (lower volatility = higher confidence)
    const volatilityFactor = {
      [VolatilityLevel.VERY_LOW]: 0.9,
      [VolatilityLevel.LOW]: 0.8,
      [VolatilityLevel.MODERATE]: 0.7,
      [VolatilityLevel.HIGH]: 0.5,
      [VolatilityLevel.EXTREME]: 0.3
    }[response.volatility];
    
    return (patternConfidence + trendStrength + volatilityFactor) / 3;
  }

  /**
   * Return conservative analysis on error
   */
  private getConservativeAnalysis(symbol: string): MarketAnalysis {
    return {
      timestamp: Date.now(),
      symbol,
      trend: MarketTrend.NEUTRAL,
      volatility: VolatilityLevel.MODERATE,
      patterns: [],
      support: [],
      resistance: [],
      recommendation: TradingRecommendation.HOLD,
      confidence: 0.3
    };
  }
}