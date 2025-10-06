# Alpaca API Integration

This document describes the Alpaca API integration for the ULTRA Trading MVP.

## Overview

The Iron Condor backtesting system now uses real historical market data from Alpaca Markets instead of mock data. This provides more accurate backtesting results based on actual market prices.

## Features

### 1. Real Market Data
- Fetches daily price bars from Alpaca's Data API v2
- Supports any US equity symbol available on Alpaca
- Handles date ranges with automatic pagination for large datasets

### 2. Error Handling
- Comprehensive error handling for API failures
- Automatic retry logic with exponential backoff for transient errors
- Detailed error messages for debugging

### 3. Rate Limiting Protection
- Built-in retry mechanism for rate limit errors (429)
- Exponential backoff with jitter to prevent thundering herd

## API Integration Details

### AlpacaClient Class

Located in `/api/alpacaClient.js`, this class handles all interactions with the Alpaca API:

```javascript
const client = new AlpacaClient(apiKey, apiSecret, endpoint);
const prices = await client.getHistoricalBars({
  symbol: 'SPY',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  timeframe: '1Day'
});
```

### Key Features:
- **Input Validation**: Validates symbol, date formats, and date ranges
- **Pagination Support**: Automatically handles paginated responses for large date ranges
- **Error Recovery**: Retries failed requests up to 3 times with exponential backoff
- **Network Resilience**: Handles network errors gracefully

## Configuration

The integration uses environment variables stored in `.env`:

```bash
ALPACA_API_KEY=your_api_key_here
ALPACA_API_SECRET=your_api_secret_here
ALPACA_API_ENDPOINT=https://paper-api.alpaca.markets
```

## Testing

Run the integration test to verify everything is working:

```bash
node api/testAlpacaIntegration.js
```

This will:
1. Test the connection to Alpaca
2. Fetch sample historical data
3. Verify error handling
4. Display recent price data

## API Endpoints

### POST /api/backtest
Now fetches real market data from Alpaca:

```json
{
  "symbol": "SPY",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "strikeWidth": 10,
  "daysToExpiry": 30
}
```

Response includes a `dataSource` field indicating "Alpaca Markets (Real Data)".

### GET /api/health
Enhanced to show Alpaca API status:

```json
{
  "status": "ok",
  "message": "ULTRA Trading MVP is running",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "services": {
    "database": "connected",
    "alpaca": "configured"
  }
}
```

## Error Handling

The system handles various error scenarios:

1. **API Errors**: Returns detailed error information including status codes
2. **Network Errors**: Provides clear messages about connectivity issues
3. **Invalid Symbols**: Returns appropriate error when symbol doesn't exist
4. **Date Range Issues**: Validates dates and ensures start date is before end date

## Performance Considerations

- Data is fetched with a page limit of 10,000 bars per request
- Pagination is handled automatically for large date ranges
- Consider caching frequently requested data for better performance

## Future Enhancements

1. Add support for intraday data (1Min, 5Min, etc.)
2. Implement data caching layer
3. Add support for options data when available
4. Include market holidays handling
5. Add real-time data streaming capability