/**
 * Cron Handler for Scheduled Trading Tasks
 * Manages automated trading based on schedule
 */

import { CloudflareBindings } from '@/types';
import { TradingPipeline } from '@/services/TradingPipeline';
import { AlpacaTradingService } from '@/services/alpaca/AlpacaTradingService';
import { RealtimeService } from '@/services/RealtimeService';

interface CronEvent {
  cron: string;
  scheduledTime: number;
}

export class CronHandler {
  private env: CloudflareBindings;
  private pipeline?: TradingPipeline;
  private realtimeService: RealtimeService;

  constructor(env: CloudflareBindings) {
    this.env = env;
    this.realtimeService = new RealtimeService(env);
  }

  /**
   * Handle scheduled cron event
   */
  async handle(event: CronEvent): Promise<void> {
    const cronTime = new Date(event.scheduledTime);
    const cronPattern = event.cron;
    
    console.log('Cron triggered', {
      pattern: cronPattern,
      time: cronTime.toISOString()
    });

    try {
      // Determine which task to run based on cron pattern
      switch (cronPattern) {
        case '30 9 * * 1-5':
          await this.handleMarketOpen();
          break;
          
        case '0 10-15 * * 1-5':
          await this.handleHourlyCheck();
          break;
          
        case '30 15 * * 1-5':
          await this.handlePreClose();
          break;
          
        case '0 16 * * 1-5':
          await this.handleMarketClose();
          break;
          
        default:
          console.log('Unknown cron pattern:', cronPattern);
      }
    } catch (error) {
      console.error('Cron handler error:', error);
      
      // Send alert if critical
      await this.sendAlert({
        type: 'CRON_ERROR',
        message: `Cron task failed: ${cronPattern}`,
        error: (error as Error).message
      });
    }
  }

  /**
   * Handle market open (9:30 AM ET)
   */
  private async handleMarketOpen(): Promise<void> {
    console.log('Market open handler started');

    // Check if trading is enabled
    const isTradingEnabled = await this.isTradingEnabled();
    if (!isTradingEnabled) {
      console.log('Trading is disabled, skipping market open');
      return;
    }

    // Initialize trading service to check market status
    const tradingService = new AlpacaTradingService(
      this.env,
      `cron-${Date.now()}`
    );

    // Verify market is open
    const isMarketOpen = await tradingService.isMarketOpen();
    if (!isMarketOpen) {
      console.log('Market is not open yet');
      return;
    }

    // Initialize trading pipeline
    this.pipeline = new TradingPipeline(this.env, {
      dailyProfitTarget: 300,
      dailyLossLimit: 300,
      maxConcurrentTrades: 5
    });

    // Start automated trading
    await this.pipeline.start();
    
    console.log('Automated trading started for the day');
    
    // Send notification
    await this.sendNotification({
      type: 'TRADING_STARTED',
      message: 'Automated trading has started for the day',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle hourly check during market hours
   */
  private async handleHourlyCheck(): Promise<void> {
    console.log('Hourly check handler started');

    if (!this.pipeline) {
      console.log('Trading pipeline not active');
      return;
    }

    // Get current status
    const status = this.pipeline.getStatus();
    
    if (!status.isRunning) {
      console.log('Trading is not running');
      return;
    }

    // Log hourly performance
    console.log('Hourly performance update', {
      dailyPnL: status.dailyPnL,
      tradesExecuted: status.tradesExecuted,
      currentPositions: status.currentPositions,
      targetProgress: `${((status.dailyPnL / 300) * 100).toFixed(1)}%`
    });

    // Store hourly snapshot
    await this.storePerformanceSnapshot({
      timestamp: new Date().toISOString(),
      ...status
    });

    // Check if we're on track
    const hoursIntoTrading = new Date().getHours() - 9.5; // 9:30 AM start
    const expectedProgress = (hoursIntoTrading / 6.5) * 300; // 6.5 trading hours
    
    if (status.dailyPnL < expectedProgress * 0.5) {
      console.log('Trading performance below expectations', {
        expected: expectedProgress,
        actual: status.dailyPnL
      });
    }
  }

  /**
   * Handle pre-close check (3:30 PM ET)
   */
  private async handlePreClose(): Promise<void> {
    console.log('Pre-close handler started');

    if (!this.pipeline) {
      console.log('Trading pipeline not active');
      return;
    }

    const status = this.pipeline.getStatus();
    
    // Send pre-close summary
    await this.sendNotification({
      type: 'PRE_CLOSE_SUMMARY',
      message: `Pre-close update: P&L $${status.dailyPnL.toFixed(2)}, Trades: ${status.tradesExecuted}`,
      data: status
    });

    // Check if we should close positions
    if (status.currentPositions > 0 && status.dailyPnL < 0) {
      console.log('Considering position closure due to negative P&L');
      
      // The pipeline will handle position management
      // based on its risk rules
    }
  }

  /**
   * Handle market close (4:00 PM ET)
   */
  private async handleMarketClose(): Promise<void> {
    console.log('Market close handler started');

    let finalStatus = null;

    // Stop trading if still running
    if (this.pipeline) {
      finalStatus = this.pipeline.getStatus();
      
      if (finalStatus.isRunning) {
        await this.pipeline.stop('Market closed');
      }
    }

    // Generate daily summary
    const summary = await this.generateDailySummary(finalStatus);
    
    // Store daily results
    await this.storeDailyResults(summary);
    
    // Send daily report
    await this.sendNotification({
      type: 'DAILY_SUMMARY',
      message: `Trading day complete: ${summary.result}`,
      data: summary
    });

    console.log('Daily trading summary', summary);
    
    // Clear pipeline reference
    this.pipeline = undefined;
  }

  /**
   * Check if trading is enabled
   */
  private async isTradingEnabled(): Promise<boolean> {
    try {
      const settings = await this.env.CACHE.get('trading:enabled', 'json') as { enabled: boolean } | null;
      return settings?.enabled ?? true; // Default to enabled
    } catch {
      return true;
    }
  }

  /**
   * Store performance snapshot
   */
  private async storePerformanceSnapshot(snapshot: any): Promise<void> {
    const key = `performance:snapshot:${new Date().toISOString()}`;
    await this.env.CACHE.put(key, JSON.stringify(snapshot), {
      expirationTtl: 7 * 24 * 60 * 60 // Keep for 7 days
    });
  }

  /**
   * Generate daily summary
   */
  private async generateDailySummary(status: any): Promise<any> {
    const summary = {
      date: new Date().toISOString().split('T')[0],
      result: 'No trades',
      dailyPnL: 0,
      tradesExecuted: 0,
      winningTrades: 0,
      losingTrades: 0,
      targetAchieved: false,
      finalPositions: 0
    };

    if (status) {
      summary.dailyPnL = status.dailyPnL;
      summary.tradesExecuted = status.tradesExecuted;
      summary.finalPositions = status.currentPositions;
      summary.targetAchieved = status.dailyPnL >= 300;
      
      if (status.dailyPnL > 0) {
        summary.result = `Profit: $${status.dailyPnL.toFixed(2)}`;
      } else if (status.dailyPnL < 0) {
        summary.result = `Loss: $${Math.abs(status.dailyPnL).toFixed(2)}`;
      } else {
        summary.result = 'Break even';
      }
    }

    return summary;
  }

  /**
   * Store daily results
   */
  private async storeDailyResults(summary: any): Promise<void> {
    const key = `results:daily:${summary.date}`;
    await this.env.CACHE.put(key, JSON.stringify(summary), {
      expirationTtl: 30 * 24 * 60 * 60 // Keep for 30 days
    });

    // Update monthly aggregate
    await this.updateMonthlyAggregate(summary);
  }

  /**
   * Update monthly aggregate
   */
  private async updateMonthlyAggregate(dailySummary: any): Promise<void> {
    const monthKey = `results:monthly:${dailySummary.date.substring(0, 7)}`;
    
    const existing = await this.env.CACHE.get(monthKey, 'json') as any || {
      totalPnL: 0,
      tradingDays: 0,
      profitDays: 0,
      lossDays: 0,
      totalTrades: 0,
      targetDaysAchieved: 0
    };

    existing.totalPnL += dailySummary.dailyPnL;
    existing.tradingDays += 1;
    existing.totalTrades += dailySummary.tradesExecuted;
    
    if (dailySummary.dailyPnL > 0) {
      existing.profitDays += 1;
    } else if (dailySummary.dailyPnL < 0) {
      existing.lossDays += 1;
    }
    
    if (dailySummary.targetAchieved) {
      existing.targetDaysAchieved += 1;
    }

    await this.env.CACHE.put(monthKey, JSON.stringify(existing), {
      expirationTtl: 365 * 24 * 60 * 60 // Keep for 1 year
    });
  }

  /**
   * Send notification
   */
  private async sendNotification(notification: any): Promise<void> {
    // In production, this could send to Slack, email, etc.
    console.log('Notification:', notification);
    
    // Broadcast as alert
    const severity = notification.type.includes('ERROR') ? 'error' : 'info';
    await this.realtimeService.broadcastAlert(severity, notification.message, notification.data);
    
    // Store in KV for dashboard
    const key = `notifications:${Date.now()}`;
    await this.env.CACHE.put(key, JSON.stringify(notification), {
      expirationTtl: 24 * 60 * 60 // Keep for 24 hours
    });
  }

  /**
   * Send alert for critical issues
   */
  private async sendAlert(alert: any): Promise<void> {
    console.error('ALERT:', alert);
    
    // In production, this would trigger immediate notifications
    await this.sendNotification({
      ...alert,
      type: 'ALERT',
      severity: 'HIGH'
    });
  }
}

/**
 * Main cron handler export
 */
export async function handleScheduled(
  event: CronEvent,
  env: CloudflareBindings,
  _ctx: ExecutionContext
): Promise<void> {
  const handler = new CronHandler(env);
  await handler.handle(event);
}