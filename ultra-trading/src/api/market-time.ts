/**
 * Market Time API Routes
 * Real-time market hours and session tracking
 */

import { Hono } from 'hono';
import { CloudflareBindings } from '@/types';
import { createApiResponse, createErrorResponse, createError } from '@/utils';
import { TradingTime } from '@/utils/TradingTime';

const marketTimeRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * Get current market time and status
 */
marketTimeRoutes.get('/status', async (c) => {
  try {
    const tradingTime = new TradingTime();
    const status = tradingTime.getMarketStatus();
    
    return c.json(createApiResponse({
      currentTime: new Date().toISOString(),
      marketTime: tradingTime.getMarketTimeString(),
      marketDate: tradingTime.getMarketTime().toLocaleDateString(),
      status: {
        ...status,
        sessionProgress: tradingTime.getSessionProgress()
      },
      nextEvents: {
        marketOpen: status.nextOpen?.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        observationEnd: '11:00 AM ET',
        tradingStart: '11:00 AM ET',
        marketClose: '4:00 PM ET'
      }
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('MARKET_TIME_ERROR', 'Failed to get market time')),
      500
    );
  }
});

/**
 * Get session timeline for the current day
 */
marketTimeRoutes.get('/timeline', async (c) => {
  try {
    const tradingTime = new TradingTime();
    const marketTime = tradingTime.getMarketTime();
    
    // Build timeline for the day
    const timeline = [
      {
        session: 'Pre-Market',
        start: '4:00 AM ET',
        end: '9:30 AM ET',
        status: tradingTime.isPreMarket() ? 'active' : 'inactive'
      },
      {
        session: 'Observation Mode',
        start: '9:30 AM ET',
        end: '11:00 AM ET',
        status: tradingTime.isMarketOpen() && marketTime.getHours() < 11 ? 'active' : 'inactive'
      },
      {
        session: 'Trading Mode',
        start: '11:00 AM ET',
        end: '4:00 PM ET',
        status: tradingTime.isMarketOpen() && marketTime.getHours() >= 11 ? 'active' : 'inactive'
      },
      {
        session: 'After-Hours',
        start: '4:00 PM ET',
        end: '8:00 PM ET',
        status: tradingTime.isAfterHours() ? 'active' : 'inactive'
      }
    ];
    
    return c.json(createApiResponse({
      date: marketTime.toLocaleDateString(),
      timeline,
      currentSession: timeline.find(t => t.status === 'active')?.session || 'Market Closed'
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('TIMELINE_ERROR', 'Failed to get session timeline')),
      500
    );
  }
});

/**
 * Get countdown timers for key events
 */
marketTimeRoutes.get('/countdown', async (c) => {
  try {
    const tradingTime = new TradingTime();
    const marketTime = tradingTime.getMarketTime();
    const now = new Date();
    
    // Calculate countdowns
    interface Countdown {
      marketOpen?: { time: number; formatted: string };
      tradingModeStart?: { time: number; formatted: string };
      marketClose?: { time: number; formatted: string };
    }
    const countdowns: Countdown = {};
    
    // Market open countdown
    if (!tradingTime.isMarketOpen()) {
      const nextOpen = tradingTime.getNextMarketOpen();
      const msToOpen = nextOpen.getTime() - now.getTime();
      countdowns.marketOpen = {
        time: Math.max(0, msToOpen),
        formatted: formatCountdown(msToOpen)
      };
    }
    
    // Observation mode end (11 AM)
    if (tradingTime.isMarketOpen() && marketTime.getHours() < 11) {
      const observationEnd = new Date(marketTime);
      observationEnd.setHours(11, 0, 0, 0);
      const msToTradingMode = observationEnd.getTime() - now.getTime();
      countdowns.tradingModeStart = {
        time: Math.max(0, msToTradingMode),
        formatted: formatCountdown(msToTradingMode)
      };
    }
    
    // Market close countdown
    if (tradingTime.isMarketOpen()) {
      const closeTime = new Date(marketTime);
      closeTime.setHours(16, 0, 0, 0);
      const msToClose = closeTime.getTime() - now.getTime();
      countdowns.marketClose = {
        time: Math.max(0, msToClose),
        formatted: formatCountdown(msToClose)
      };
    }
    
    return c.json(createApiResponse({
      serverTime: now.toISOString(),
      countdowns
    }));
  } catch (error) {
    return c.json(
      createErrorResponse(createError('COUNTDOWN_ERROR', 'Failed to get countdowns')),
      500
    );
  }
});

/**
 * Format countdown time
 */
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export { marketTimeRoutes };