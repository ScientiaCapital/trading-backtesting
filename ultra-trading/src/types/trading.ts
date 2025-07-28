/**
 * Trading Types
 * Core types for trading operations
 */

// Re-export Signal type from strategy (for backward compatibility)
export type { Signal } from './strategy';

export enum AssetClass {
  US_EQUITY = 'us_equity',
  US_OPTION = 'us_option',
  CRYPTO = 'crypto'
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP = 'stop',
  STOP_LIMIT = 'stop_limit',
  TRAILING_STOP = 'trailing_stop'
}

export enum TimeInForce {
  DAY = 'day',
  GTC = 'gtc',
  IOC = 'ioc',
  FOK = 'fok',
  GTX = 'gtx',
  GTD = 'gtd',
  OPG = 'opg',
  CLS = 'cls'
}

export enum OrderStatus {
  NEW = 'new',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  DONE_FOR_DAY = 'done_for_day',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  REPLACED = 'replaced',
  PENDING_CANCEL = 'pending_cancel',
  PENDING_REPLACE = 'pending_replace',
  ACCEPTED = 'accepted',
  PENDING_NEW = 'pending_new',
  ACCEPTED_FOR_BIDDING = 'accepted_for_bidding',
  STOPPED = 'stopped',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
  CALCULATED = 'calculated'
}

export interface Order {
  id: string;
  clientOrderId?: string;
  symbol: string;
  assetClass: AssetClass;
  quantity: number;
  filledQuantity: number;
  side: OrderSide;
  orderType: OrderType;
  timeInForce: TimeInForce;
  limitPrice?: number;
  stopPrice?: number;
  filledAvgPrice?: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date;
  filledAt?: Date;
  canceledAt?: Date;
  failedAt?: Date;
  replacedAt?: Date;
  replacedBy?: string;
  replaces?: string;
  notional?: number;
  legs?: Order[];
  trailPrice?: number;
  trailPercent?: number;
  hwm?: number;
}

export interface Position {
  assetId: string;
  symbol: string;
  exchange: string;
  assetClass: AssetClass;
  quantity: number;
  availableQuantity: number;
  avgEntryPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  currentPrice: number;
  lastPrice: number;
  changeToday: number;
}

export interface Account {
  id: string;
  accountNumber: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  accountBlocked: boolean;
  optionsApproved: boolean;
  optionsLevel: number;
  marketOpen: boolean;
  createdAt: Date;
  currency: string;
  shortMarketValue?: number;
  longMarketValue?: number;
  equity?: number;
  lastEquity?: number;
  multiplier?: number;
  initialMargin?: number;
  maintenanceMargin?: number;
  daytradeCount?: number;
  sma?: number;
}

export interface TradeUpdate {
  event: 'new' | 'fill' | 'partial_fill' | 'canceled' | 'expired' | 'replaced' | 'rejected';
  order: Order;
  timestamp: Date;
  positionQty?: number;
  price?: number;
  qty?: number;
}

export interface Clock {
  timestamp: Date;
  isOpen: boolean;
  nextOpen: Date;
  nextClose: Date;
}

export interface Calendar {
  date: string;
  open: string;
  close: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  assetClass: AssetClass;
  status: 'active' | 'inactive';
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  easyToBorrow: boolean;
  fractionable: boolean;
  minOrderSize?: number;
  minTradeIncrement?: number;
  priceIncrement?: number;
}

export interface Bar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount?: number;
  vwap?: number;
}

export interface Quote {
  timestamp: Date;
  askPrice: number;
  askSize: number;
  bidPrice: number;
  bidSize: number;
  askExchange?: string;
  bidExchange?: string;
  conditions?: string[];
}

export interface Trade {
  timestamp: Date;
  price: number;
  size: number;
  exchange?: string;
  conditions?: string[];
  id?: string;
  tape?: string;
}