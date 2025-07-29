/**
 * ULTRA Trading Platform - Backtest Scheduler
 * Durable Object for scheduling and managing backtest runs
 */

import type { CloudflareBindings } from '../types';
import { IntradayBacktester } from '../services/backtesting/IntradayBacktester';
import { MultiAssetValidator } from '../services/backtesting/MultiAssetValidator';

interface ScheduledBacktest {
  id: string;
  type: 'intraday' | 'multi-asset' | 'after-hours';
  schedule: {
    time: string; // HH:MM format
    timezone: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    daysOfWeek?: number[]; // 0 = Sunday, 6 = Saturday
  };
  config: {
    symbols: string[];
    strategies?: string[];
    parameters?: any;
  };
  lastRun?: string;
  nextRun: string;
  enabled: boolean;
}

export class BacktestScheduler {
  private state: DurableObjectState;
  private env: CloudflareBindings;
  private schedules: Map<string, ScheduledBacktest> = new Map();
  private activeBacktests: Map<string, AbortController> = new Map();

  constructor(state: DurableObjectState, env: CloudflareBindings) {
    this.state = state;
    this.env = env;
    
    // Initialize alarm for next scheduled run
    this.state.blockConcurrencyWhile(async () => {
      await this.loadSchedules();
      await this.scheduleNextRun();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/schedule':
          if (request.method === 'POST') {
            return this.createSchedule(request);
          } else if (request.method === 'GET') {
            return this.listSchedules();
          }
          break;
          
        case '/schedule/update':
          return this.updateSchedule(request);
          
        case '/schedule/delete':
          return this.deleteSchedule(request);
          
        case '/run':
          return this.runBacktest(request);
          
        case '/status':
          return this.getStatus();
          
        case '/history':
          return this.getHistory();
          
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('BacktestScheduler error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response('Method not allowed', { status: 405 });
  }

  async alarm(): Promise<void> {
    // This is called when a scheduled time is reached
    console.log('BacktestScheduler alarm triggered');
    
    try {
      // Find all schedules that should run now
      const now = new Date();
      const toRun: ScheduledBacktest[] = [];
      
      for (const schedule of this.schedules.values()) {
        if (schedule.enabled && new Date(schedule.nextRun) <= now) {
          toRun.push(schedule);
        }
      }
      
      // Run backtests
      for (const schedule of toRun) {
        await this.executeScheduledBacktest(schedule);
      }
      
      // Schedule next run
      await this.scheduleNextRun();
    } catch (error) {
      console.error('Alarm execution error:', error);
    }
  }

  private async createSchedule(request: Request): Promise<Response> {
    const data = await request.json() as ScheduledBacktest;
    
    // Generate ID if not provided
    if (!data.id) {
      data.id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Calculate next run time
    data.nextRun = this.calculateNextRun(data.schedule);
    data.enabled = data.enabled !== false; // Default to enabled
    
    // Save schedule
    this.schedules.set(data.id, data);
    await this.saveSchedules();
    
    // Update alarm if this is the next schedule to run
    await this.scheduleNextRun();
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async updateSchedule(request: Request): Promise<Response> {
    const { id, ...updates } = await request.json() as Partial<ScheduledBacktest>;
    
    const schedule = this.schedules.get(id!);
    if (!schedule) {
      return new Response('Schedule not found', { status: 404 });
    }
    
    // Update schedule
    Object.assign(schedule, updates);
    
    // Recalculate next run if schedule changed
    if (updates.schedule) {
      schedule.nextRun = this.calculateNextRun(schedule.schedule);
    }
    
    await this.saveSchedules();
    await this.scheduleNextRun();
    
    return new Response(JSON.stringify(schedule), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async deleteSchedule(request: Request): Promise<Response> {
    const { id } = await request.json() as { id: string };
    
    if (!this.schedules.has(id)) {
      return new Response('Schedule not found', { status: 404 });
    }
    
    this.schedules.delete(id);
    await this.saveSchedules();
    await this.scheduleNextRun();
    
    return new Response('Schedule deleted', { status: 200 });
  }

  private async listSchedules(): Promise<Response> {
    const schedules = Array.from(this.schedules.values());
    
    return new Response(JSON.stringify(schedules), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async runBacktest(request: Request): Promise<Response> {
    const { scheduleId, immediate } = await request.json() as {
      scheduleId?: string;
      immediate?: boolean;
    };
    
    if (scheduleId) {
      const schedule = this.schedules.get(scheduleId);
      if (!schedule) {
        return new Response('Schedule not found', { status: 404 });
      }
      
      // Run the scheduled backtest
      const result = await this.executeScheduledBacktest(schedule);
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (immediate) {
      // Run all enabled schedules immediately
      const results = [];
      
      for (const schedule of this.schedules.values()) {
        if (schedule.enabled) {
          const result = await this.executeScheduledBacktest(schedule);
          results.push(result);
        }
      }
      
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Invalid request', { status: 400 });
  }

  private async executeScheduledBacktest(
    schedule: ScheduledBacktest
  ): Promise<any> {
    console.log(`Executing scheduled backtest: ${schedule.id}`);
    
    const requestId = `scheduled_${schedule.id}_${Date.now()}`;
    const abortController = new AbortController();
    
    // Track active backtest
    this.activeBacktests.set(schedule.id, abortController);
    
    try {
      let result;
      
      switch (schedule.type) {
        case 'intraday':
          const intradayBacktester = new IntradayBacktester(this.env, requestId);
          result = await intradayBacktester.validateDailyTarget(schedule.config.symbols);
          break;
          
        case 'multi-asset':
          const multiAssetValidator = new MultiAssetValidator(this.env, requestId);
          result = await multiAssetValidator.validatePortfolio({
            assets: schedule.config.symbols.map(symbol => ({
              symbol,
              allocation: 1 / schedule.config.symbols.length,
              assetClass: symbol.includes('BTC') || symbol.includes('ETH') ? 'crypto' : 'stock'
            })),
            rebalanceFrequency: 'monthly',
            startDate: this.getStartDate(30),
            endDate: new Date().toISOString().split('T')[0] || '',
            initialCapital: 200000
          });
          break;
          
        case 'after-hours':
          // This would trigger the AfterHoursResearcher
          result = { message: 'After-hours analysis scheduled' };
          break;
      }
      
      // Update last run time
      schedule.lastRun = new Date().toISOString();
      schedule.nextRun = this.calculateNextRun(schedule.schedule);
      await this.saveSchedules();
      
      // Store result
      await this.storeResult(schedule.id, result);
      
      return {
        scheduleId: schedule.id,
        success: true,
        result,
        executedAt: schedule.lastRun
      };
    } catch (error) {
      console.error(`Scheduled backtest ${schedule.id} failed:`, error);
      
      return {
        scheduleId: schedule.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date().toISOString()
      };
    } finally {
      this.activeBacktests.delete(schedule.id);
    }
  }

  private async getStatus(): Promise<Response> {
    const status = {
      totalSchedules: this.schedules.size,
      enabledSchedules: Array.from(this.schedules.values()).filter(s => s.enabled).length,
      activeBacktests: this.activeBacktests.size,
      nextScheduledRun: this.getNextScheduledRun()
    };
    
    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getHistory(): Promise<Response> {
    // Get last 10 backtest results
    const history = [];
    
    for (const schedule of this.schedules.values()) {
      const results = await this.getScheduleResults(schedule.id, 10);
      history.push({
        scheduleId: schedule.id,
        type: schedule.type,
        lastRun: schedule.lastRun,
        results
      });
    }
    
    return new Response(JSON.stringify(history), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private calculateNextRun(schedule: ScheduledBacktest['schedule']): string {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    const nextRun = new Date();
    nextRun.setHours(hours || 0, minutes || 0, 0, 0);
    
    // If time has passed today, move to next occurrence
    if (nextRun <= now) {
      switch (schedule.frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
          
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
          
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }
    
    // Handle specific days of week for weekly schedules
    if (schedule.frequency === 'weekly' && schedule.daysOfWeek) {
      while (!schedule.daysOfWeek.includes(nextRun.getDay())) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }
    
    return nextRun.toISOString();
  }

  private async scheduleNextRun(): Promise<void> {
    // Find the next schedule to run
    let nextRun: Date | null = null;
    
    for (const schedule of this.schedules.values()) {
      if (schedule.enabled) {
        const runTime = new Date(schedule.nextRun);
        if (!nextRun || runTime < nextRun) {
          nextRun = runTime;
        }
      }
    }
    
    if (nextRun) {
      // Set alarm for next run
      const delay = Math.max(0, nextRun.getTime() - Date.now());
      console.log(`Scheduling next run at ${nextRun.toISOString()} (${delay}ms)`);
      
      await this.state.storage.setAlarm(nextRun.getTime());
    }
  }

  private getNextScheduledRun(): string | null {
    let nextRun: Date | null = null;
    
    for (const schedule of this.schedules.values()) {
      if (schedule.enabled) {
        const runTime = new Date(schedule.nextRun);
        if (!nextRun || runTime < nextRun) {
          nextRun = runTime;
        }
      }
    }
    
    return nextRun ? nextRun.toISOString() : null;
  }

  private async loadSchedules(): Promise<void> {
    const stored = await this.state.storage.get<ScheduledBacktest[]>('schedules');
    
    if (stored) {
      for (const schedule of stored) {
        this.schedules.set(schedule.id, schedule);
      }
    }
  }

  private async saveSchedules(): Promise<void> {
    const schedules = Array.from(this.schedules.values());
    await this.state.storage.put('schedules', schedules);
  }

  private async storeResult(scheduleId: string, result: any): Promise<void> {
    const key = `results:${scheduleId}`;
    const existing = await this.state.storage.get<any[]>(key) || [];
    
    // Keep last 100 results
    existing.unshift({
      timestamp: new Date().toISOString(),
      result
    });
    
    if (existing.length > 100) {
      existing.length = 100;
    }
    
    await this.state.storage.put(key, existing);
  }

  private async getScheduleResults(scheduleId: string, limit: number = 10): Promise<any[]> {
    const key = `results:${scheduleId}`;
    const results = await this.state.storage.get<any[]>(key) || [];
    
    return results.slice(0, limit);
  }

  private getStartDate(daysBack: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return date.toISOString().split('T')[0] || '';
  }
}