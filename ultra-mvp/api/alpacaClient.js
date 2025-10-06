// Alpaca API Client for fetching historical market data
import axios from 'axios';

export class AlpacaClient {
  constructor(apiKey, apiSecret, endpoint) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.endpoint = endpoint;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
  }

  /**
   * Fetch historical price bars from Alpaca API
   * @param {Object} params - Parameters for the API call
   * @param {string} params.symbol - Stock symbol (e.g., 'SPY')
   * @param {string} params.startDate - Start date in YYYY-MM-DD format
   * @param {string} params.endDate - End date in YYYY-MM-DD format
   * @param {string} params.timeframe - Timeframe (default: '1Day')
   * @returns {Object} Object with date as key and closing price as value
   */
  async getHistoricalBars({ symbol, startDate, endDate, timeframe = '1Day' }) {
    // Validate inputs
    if (!symbol || symbol.trim() === '') {
      throw new Error('Symbol is required');
    }

    if (!this.isValidDate(startDate)) {
      throw new Error(`Invalid start date format: ${startDate}. Use YYYY-MM-DD format.`);
    }

    if (!this.isValidDate(endDate)) {
      throw new Error(`Invalid end date format: ${endDate}. Use YYYY-MM-DD format.`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const maxDate = new Date('2025-01-04');
    
    if (end >= maxDate) {
      throw new Error(`No historical data available for dates after January 3, 2025. You requested end date: ${endDate}`);
    }

    if (start >= end) {
      throw new Error(`Start date (${startDate}) must be before end date (${endDate})`);
    }
    
    if (start < new Date('2015-01-01')) {
      throw new Error(`Limited historical data available before 2015. You requested start date: ${startDate}`);
    }

    const prices = {};
    let pageToken = null;

    do {
      const params = {
        start: `${startDate}T00:00:00Z`,
        end: `${endDate}T23:59:59Z`,
        timeframe,
        adjustment: 'raw',
        feed: 'iex'
      };

      if (pageToken) {
        params.page_token = pageToken;
      }

      try {
        const dataEndpoint = this.endpoint.includes('paper-api') 
          ? 'https://data.alpaca.markets' 
          : this.endpoint;
        
        const response = await this.makeRequestWithRetry(
          `${dataEndpoint}/v2/stocks/${symbol}/bars`,
          params
        );

        // Process bars
        if (response.data.bars && response.data.bars[symbol]) {
          response.data.bars[symbol].forEach(bar => {
            const date = bar.t.split('T')[0];
            prices[date] = bar.c; // Store closing price
          });
        }

        pageToken = response.data.next_page_token;
      } catch (error) {
        throw this.handleError(error);
      }
    } while (pageToken);

    // Check if we got any data
    if (Object.keys(prices).length === 0) {
      throw new Error(`No historical data found for ${symbol} between ${startDate} and ${endDate}. This could be due to: 1) Weekend/holiday dates with no trading, 2) Invalid symbol, 3) Data not available for the requested period.`);
    }

    return prices;
  }

  /**
   * Make HTTP request with retry logic
   */
  async makeRequestWithRetry(url, params, retryCount = 0) {
    try {
      const response = await axios.get(url, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        },
        params
      });
      return response;
    } catch (error) {
      // Check if we should retry
      if (this.shouldRetry(error) && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount) * (1 + Math.random() * 0.1); // Exponential backoff with jitter
        await this.sleep(delay);
        return this.makeRequestWithRetry(url, params, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Determine if an error is retryable
   */
  shouldRetry(error) {
    if (!error.response) {
      // Network errors are retryable
      return true;
    }

    const status = error.response.status;
    // Retry on 5xx errors and rate limiting (429)
    return status >= 500 || status === 429;
  }

  /**
   * Handle and format errors
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Unknown error';
      return new Error(`Alpaca API Error (${status}): ${message}`);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new Error(`Network error connecting to Alpaca API: ${error.message}`);
    }
    return error;
  }

  /**
   * Validate date format
   */
  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a singleton instance with environment variables
 */
export function createAlpacaClient() {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_API_SECRET;
  const endpoint = process.env.ALPACA_API_ENDPOINT || 'https://paper-api.alpaca.markets';

  if (!apiKey || !apiSecret) {
    throw new Error('Alpaca API credentials not found in environment variables');
  }

  return new AlpacaClient(apiKey, apiSecret, endpoint);
}