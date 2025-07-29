/**
 * Trading Time Utility
 * Provides real-time market hours tracking and time zone conversions
 */

export interface MarketHours {
  preMarket: { start: string; end: string };
  regular: { start: string; end: string };
  afterHours: { start: string; end: string };
}

export interface MarketStatus {
  isOpen: boolean;
  isPreMarket: boolean;
  isAfterHours: boolean;
  isWeekend: boolean;
  currentSession: 'closed' | 'pre-market' | 'regular' | 'after-hours';
  nextOpen: Date | null;
  timeToOpen: string;
  timeToClose: string;
}

export class TradingTime {
  private date: Date;
  private readonly timezone = 'America/New_York'; // NYSE timezone
  
  constructor(date = new Date()) {
    this.date = date;
  }
  
  /**
   * Get current time in market timezone (ET)
   */
  getMarketTime(): Date {
    // Convert to ET timezone
    const etTime = new Date(this.date.toLocaleString('en-US', { timeZone: this.timezone }));
    return etTime;
  }
  
  /**
   * Get current Eastern Time
   */
  getCurrentEasternTime(): Date {
    return this.getMarketTime();
  }
  
  /**
   * Get formatted market time
   */
  getMarketTimeString(): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: this.timezone,
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    return this.date.toLocaleString('en-US', options);
  }
  
  /**
   * Check if market is currently open
   */
  isMarketOpen(): boolean {
    const marketTime = this.getMarketTime();
    const day = marketTime.getDay();
    
    // Market closed on weekends
    if (day === 0 || day === 6) return false;
    
    const hours = marketTime.getHours();
    const minutes = marketTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    // Regular hours: 9:30 AM - 4:00 PM ET
    const openMinutes = 9 * 60 + 30; // 570
    const closeMinutes = 16 * 60; // 960
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }
  
  /**
   * Check if in pre-market hours
   */
  isPreMarket(): boolean {
    const marketTime = this.getMarketTime();
    const day = marketTime.getDay();
    
    if (day === 0 || day === 6) return false;
    
    const hours = marketTime.getHours();
    const minutes = marketTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    // Pre-market: 4:00 AM - 9:30 AM ET
    const preMarketStart = 4 * 60; // 240
    const preMarketEnd = 9 * 60 + 30; // 570
    
    return currentMinutes >= preMarketStart && currentMinutes < preMarketEnd;
  }
  
  /**
   * Check if in after-hours trading
   */
  isAfterHours(): boolean {
    const marketTime = this.getMarketTime();
    const day = marketTime.getDay();
    
    if (day === 0 || day === 6) return false;
    
    const hours = marketTime.getHours();
    const minutes = marketTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    // After-hours: 4:00 PM - 8:00 PM ET
    const afterHoursStart = 16 * 60; // 960
    const afterHoursEnd = 20 * 60; // 1200
    
    return currentMinutes >= afterHoursStart && currentMinutes < afterHoursEnd;
  }
  
  /**
   * Get comprehensive market status
   */
  getMarketStatus(): MarketStatus {
    const isOpen = this.isMarketOpen();
    const isPreMarket = this.isPreMarket();
    const isAfterHours = this.isAfterHours();
    const marketTime = this.getMarketTime();
    const isWeekend = marketTime.getDay() === 0 || marketTime.getDay() === 6;
    
    let currentSession: MarketStatus['currentSession'] = 'closed';
    if (isOpen) currentSession = 'regular';
    else if (isPreMarket) currentSession = 'pre-market';
    else if (isAfterHours) currentSession = 'after-hours';
    
    return {
      isOpen,
      isPreMarket,
      isAfterHours,
      isWeekend,
      currentSession,
      nextOpen: this.getNextMarketOpen(),
      timeToOpen: this.getTimeToOpen(),
      timeToClose: this.getTimeToClose()
    };
  }
  
  /**
   * Get next market open time
   */
  getNextMarketOpen(): Date {
    const marketTime = this.getMarketTime();
    const nextOpen = new Date(marketTime);
    
    // If it's before 9:30 AM on a weekday, market opens today
    if (!this.isWeekend() && marketTime.getHours() < 9 || 
        (marketTime.getHours() === 9 && marketTime.getMinutes() < 30)) {
      nextOpen.setHours(9, 30, 0, 0);
      return nextOpen;
    }
    
    // Otherwise, find next weekday
    do {
      nextOpen.setDate(nextOpen.getDate() + 1);
    } while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6);
    
    nextOpen.setHours(9, 30, 0, 0);
    return nextOpen;
  }
  
  /**
   * Get time until market opens
   */
  getTimeToOpen(): string {
    if (this.isMarketOpen()) return 'Market is open';
    
    const nextOpen = this.getNextMarketOpen();
    const diff = nextOpen.getTime() - this.date.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h ${minutes}m`;
    }
    
    return `${hours}h ${minutes}m`;
  }
  
  /**
   * Get time until market closes
   */
  getTimeToClose(): string {
    if (!this.isMarketOpen()) return 'Market is closed';
    
    const marketTime = this.getMarketTime();
    const closeTime = new Date(marketTime);
    closeTime.setHours(16, 0, 0, 0);
    
    const diff = closeTime.getTime() - marketTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  }
  
  /**
   * Check if it's a weekend
   */
  isWeekend(): boolean {
    const day = this.getMarketTime().getDay();
    return day === 0 || day === 6;
  }
  
  /**
   * Get trading session progress (0-100%)
   */
  getSessionProgress(): number {
    if (!this.isMarketOpen()) return 0;
    
    const marketTime = this.getMarketTime();
    const hours = marketTime.getHours();
    const minutes = marketTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    const openMinutes = 9 * 60 + 30; // 570
    const closeMinutes = 16 * 60; // 960
    const totalMinutes = closeMinutes - openMinutes; // 390
    
    const elapsedMinutes = currentMinutes - openMinutes;
    return Math.round((elapsedMinutes / totalMinutes) * 100);
  }
  
  /**
   * Format for display
   */
  toString(): string {
    const status = this.getMarketStatus();
    const marketTime = this.getMarketTimeString();
    
    return `${marketTime} ET - ${status.currentSession.toUpperCase()}`;
  }
  
  /**
   * JSON representation
   */
  toJSON() {
    return {
      marketTime: this.getMarketTimeString(),
      status: this.getMarketStatus(),
      sessionProgress: this.getSessionProgress()
    };
  }
}

/**
 * Real-time market clock that updates every second
 */
export class MarketClock {
  private timer: NodeJS.Timeout | null = null;
  private callback: (time: TradingTime) => void;
  
  constructor(callback: (time: TradingTime) => void) {
    this.callback = callback;
  }
  
  start(): void {
    this.stop(); // Clear any existing timer
    
    // Update immediately
    this.callback(new TradingTime());
    
    // Update every second
    this.timer = setInterval(() => {
      this.callback(new TradingTime());
    }, 1000);
  }
  
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Utility functions
export function isMarketOpen(): boolean {
  return new TradingTime().isMarketOpen();
}

export function getMarketStatus(): MarketStatus {
  return new TradingTime().getMarketStatus();
}

export function getTimeToMarketOpen(): string {
  return new TradingTime().getTimeToOpen();
}

export function getTimeToMarketClose(): string {
  return new TradingTime().getTimeToClose();
}