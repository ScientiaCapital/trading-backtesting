// Tests for Alpaca API Client
import { jest } from '@jest/globals';
import axios from 'axios';
import { AlpacaClient } from './alpacaClient.js';

// Mock axios
jest.mock('axios');

describe('AlpacaClient', () => {
  let client;
  const mockApiKey = 'test-api-key';
  const mockApiSecret = 'test-api-secret';
  const mockEndpoint = 'https://paper-api.alpaca.markets';

  beforeEach(() => {
    client = new AlpacaClient(mockApiKey, mockApiSecret, mockEndpoint);
    jest.clearAllMocks();
  });

  describe('getHistoricalBars', () => {
    it('should fetch historical bars successfully', async () => {
      const mockResponse = {
        data: {
          bars: {
            'SPY': [
              {
                t: '2024-01-01T09:30:00Z',
                o: 470.50,
                h: 471.20,
                l: 469.80,
                c: 470.90,
                v: 1000000
              },
              {
                t: '2024-01-02T09:30:00Z',
                o: 471.00,
                h: 472.50,
                l: 470.50,
                c: 472.00,
                v: 1200000
              }
            ]
          },
          next_page_token: null
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await client.getHistoricalBars({
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        timeframe: '1Day'
      });

      expect(axios.get).toHaveBeenCalledWith(
        `${mockEndpoint}/v2/stocks/SPY/bars`,
        {
          headers: {
            'APCA-API-KEY-ID': mockApiKey,
            'APCA-API-SECRET-KEY': mockApiSecret
          },
          params: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-01-02T23:59:59Z',
            timeframe: '1Day',
            adjustment: 'raw',
            feed: 'sip',
            page_limit: 10000
          }
        }
      );

      expect(result).toEqual({
        '2024-01-01': 470.90,
        '2024-01-02': 472.00
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          status: 429,
          data: {
            message: 'Rate limit exceeded'
          }
        }
      };

      axios.get.mockRejectedValueOnce(mockError);

      await expect(client.getHistoricalBars({
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-02'
      })).rejects.toThrow('Alpaca API Error (429): Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      const mockError = new Error('Network error');
      mockError.code = 'ECONNREFUSED';

      axios.get.mockRejectedValueOnce(mockError);

      await expect(client.getHistoricalBars({
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-02'
      })).rejects.toThrow('Network error connecting to Alpaca API: Network error');
    });

    it('should handle pagination for large date ranges', async () => {
      const mockResponse1 = {
        data: {
          bars: {
            'SPY': [
              { t: '2024-01-01T09:30:00Z', c: 470.90 },
              { t: '2024-01-02T09:30:00Z', c: 472.00 }
            ]
          },
          next_page_token: 'token123'
        }
      };

      const mockResponse2 = {
        data: {
          bars: {
            'SPY': [
              { t: '2024-01-03T09:30:00Z', c: 473.50 },
              { t: '2024-01-04T09:30:00Z', c: 474.00 }
            ]
          },
          next_page_token: null
        }
      };

      axios.get
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await client.getHistoricalBars({
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-04'
      });

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        '2024-01-01': 470.90,
        '2024-01-02': 472.00,
        '2024-01-03': 473.50,
        '2024-01-04': 474.00
      });
    });

    it('should validate input parameters', async () => {
      await expect(client.getHistoricalBars({
        symbol: '',
        startDate: '2024-01-01',
        endDate: '2024-01-02'
      })).rejects.toThrow('Symbol is required');

      await expect(client.getHistoricalBars({
        symbol: 'SPY',
        startDate: 'invalid-date',
        endDate: '2024-01-02'
      })).rejects.toThrow('Invalid start date format');

      await expect(client.getHistoricalBars({
        symbol: 'SPY',
        startDate: '2024-01-02',
        endDate: '2024-01-01'
      })).rejects.toThrow('Start date must be before end date');
    });
  });

  describe('retry logic', () => {
    it('should retry on transient errors', async () => {
      const mockError = {
        response: {
          status: 503,
          data: { message: 'Service unavailable' }
        }
      };

      const mockSuccess = {
        data: {
          bars: {
            'SPY': [{ t: '2024-01-01T09:30:00Z', c: 470.90 }]
          },
          next_page_token: null
        }
      };

      axios.get
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);

      const result = await client.getHistoricalBars({
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-01'
      });

      expect(axios.get).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ '2024-01-01': 470.90 });
    });

    it('should not retry on client errors', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Bad request' }
        }
      };

      axios.get.mockRejectedValueOnce(mockError);

      await expect(client.getHistoricalBars({
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-02'
      })).rejects.toThrow('Alpaca API Error (400): Bad request');

      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });
});