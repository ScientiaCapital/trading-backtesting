"""
Personal Quant Trading System for Claude Desktop
Integrates all 6 specialized agents for 24/7 trading
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from alpaca.trading.client import TradingClient
from alpaca.data import StockHistoricalDataClient, CryptoHistoricalDataClient, OptionHistoricalDataClient
from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest
from alpaca.data.requests import StockBarsRequest, CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame
from collections import deque
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AlphaSignalGenerator:
    """
    Generates alpha signals across multiple asset classes
    """
    def __init__(self, data_client: StockHistoricalDataClient):
        self.data_client = data_client
        self.signals_history = deque(maxlen=1000)
        
    async def generate_signals(self, universe: List[str], timeframe: str = "1Min") -> Dict[str, Dict]:
        """Generate trading signals for given universe"""
        signals = {}
        
        for symbol in universe:
            try:
                # Get microstructure features
                micro_features = await self.calculate_microstructure_alpha(symbol)
                
                # Technical signals
                tech_signals = await self.calculate_technical_signals(symbol)
                
                # ML prediction (simplified for now)
                ml_signal = self.ml_predict(micro_features, tech_signals)
                
                # Combine signals
                combined_signal = {
                    'symbol': symbol,
                    'direction': ml_signal['direction'],  # 1 for long, -1 for short, 0 for neutral
                    'confidence': ml_signal['confidence'],
                    'expected_return': ml_signal['expected_return'],
                    'holding_period': ml_signal['holding_period'],
                    'features': {
                        'microstructure': micro_features,
                        'technical': tech_signals
                    },
                    'timestamp': datetime.now().isoformat()
                }
                
                signals[symbol] = combined_signal
                self.signals_history.append(combined_signal)
                
            except Exception as e:
                logger.error(f"Error generating signal for {symbol}: {e}")
                
        return signals
    
    async def calculate_microstructure_alpha(self, symbol: str) -> Dict:
        """Calculate market microstructure features"""
        try:
            # Get recent trades and quotes
            bars = self.data_client.get_stock_bars(
                StockBarsRequest(
                    symbol_or_symbols=symbol,
                    timeframe=TimeFrame.Minute,
                    limit=100
                )
            )
            
            if symbol not in bars.data or len(bars.data[symbol]) < 10:
                return {}
            
            df = pd.DataFrame([{
                'high': bar.high,
                'low': bar.low,
                'close': bar.close,
                'volume': bar.volume,
                'trade_count': bar.trade_count,
                'vwap': bar.vwap
            } for bar in bars.data[symbol]])
            
            # Calculate microstructure features
            features = {
                'spread': (df['high'] - df['low']).mean(),
                'volume_imbalance': self.calculate_vpin(df),
                'kyle_lambda': self.calculate_kyle_lambda(df),
                'roll_spread': self.calculate_roll_spread(df),
                'amihud_illiquidity': self.calculate_amihud_illiquidity(df),
                'price_impact': self.estimate_price_impact(df)
            }
            
            return features
            
        except Exception as e:
            logger.error(f"Microstructure calculation error: {e}")
            return {}
    
    def calculate_vpin(self, df: pd.DataFrame) -> float:
        """Volume-synchronized Probability of Informed Trading"""
        if len(df) < 50:
            return 0.0
            
        # Simplified VPIN calculation
        df['price_change'] = df['close'].pct_change()
        df['buy_volume'] = df['volume'] * (df['price_change'] > 0).astype(int)
        df['sell_volume'] = df['volume'] * (df['price_change'] < 0).astype(int)
        
        # Create volume buckets
        bucket_size = df['volume'].sum() / 50
        vpin_values = []
        
        current_bucket_volume = 0
        buy_volume = 0
        sell_volume = 0
        
        for _, row in df.iterrows():
            current_bucket_volume += row['volume']
            buy_volume += row['buy_volume']
            sell_volume += row['sell_volume']
            
            if current_bucket_volume >= bucket_size:
                if buy_volume + sell_volume > 0:
                    vpin = abs(buy_volume - sell_volume) / (buy_volume + sell_volume)
                    vpin_values.append(vpin)
                
                current_bucket_volume = 0
                buy_volume = 0
                sell_volume = 0
        
        return np.mean(vpin_values) if vpin_values else 0.0
    
    def calculate_kyle_lambda(self, df: pd.DataFrame) -> float:
        """Kyle's Lambda - price impact coefficient"""
        if len(df) < 20:
            return 0.0
            
        # Regress price changes on signed volume
        df['price_change'] = df['close'].pct_change()
        df['signed_volume'] = df['volume'] * np.sign(df['price_change'])
        
        # Remove NaN values
        clean_df = df.dropna()
        
        if len(clean_df) < 10:
            return 0.0
            
        # Simple linear regression
        X = clean_df['signed_volume'].values
        y = clean_df['price_change'].values
        
        # Add small epsilon to avoid division by zero
        denominator = np.sum((X - X.mean())**2)
        if denominator < 1e-10:
            return 0.0
            
        kyle_lambda = np.sum((X - X.mean()) * (y - y.mean())) / denominator
        
        return kyle_lambda
    
    def calculate_roll_spread(self, df: pd.DataFrame) -> float:
        """Roll's implied spread estimator"""
        if len(df) < 10:
            return 0.0
            
        price_changes = df['close'].diff().dropna()
        
        if len(price_changes) < 2:
            return 0.0
            
        cov = price_changes.cov(price_changes.shift(1))
        
        if cov >= 0:
            return 0.0
            
        roll_spread = 2 * np.sqrt(-cov)
        return roll_spread
    
    def calculate_amihud_illiquidity(self, df: pd.DataFrame) -> float:
        """Amihud illiquidity measure"""
        if len(df) < 5:
            return 0.0
            
        df['returns'] = df['close'].pct_change().abs()
        df['dollar_volume'] = df['close'] * df['volume']
        
        # Avoid division by zero
        df = df[df['dollar_volume'] > 0]
        
        if len(df) < 5:
            return 0.0
            
        illiquidity = (df['returns'] / df['dollar_volume']).mean() * 1e6
        
        return illiquidity
    
    def estimate_price_impact(self, df: pd.DataFrame) -> float:
        """Estimate permanent price impact"""
        if len(df) < 20:
            return 0.0
            
        # Use volume-weighted price movements
        df['price_change'] = df['close'].pct_change()
        df['volume_ratio'] = df['volume'] / df['volume'].rolling(20).mean()
        
        # Clean data
        clean_df = df.dropna()
        
        if len(clean_df) < 10:
            return 0.0
            
        # Estimate impact as correlation between volume and price changes
        impact = clean_df['volume_ratio'].corr(clean_df['price_change'].abs())
        
        return impact if not np.isnan(impact) else 0.0
    
    async def calculate_technical_signals(self, symbol: str) -> Dict:
        """Calculate technical indicators"""
        try:
            bars = self.data_client.get_stock_bars(
                StockBarsRequest(
                    symbol_or_symbols=symbol,
                    timeframe=TimeFrame.Day,
                    limit=100
                )
            )
            
            if symbol not in bars.data or len(bars.data[symbol]) < 20:
                return {}
                
            df = pd.DataFrame([{
                'close': bar.close,
                'high': bar.high,
                'low': bar.low,
                'volume': bar.volume
            } for bar in bars.data[symbol]])
            
            # Calculate indicators
            features = {
                'rsi': self.calculate_rsi(df['close']),
                'macd_signal': self.calculate_macd_signal(df['close']),
                'bb_position': self.calculate_bollinger_position(df['close']),
                'volume_trend': df['volume'].pct_change().rolling(5).mean().iloc[-1],
                'momentum': (df['close'].iloc[-1] / df['close'].iloc[-20] - 1) * 100
            }
            
            return features
            
        except Exception as e:
            logger.error(f"Technical calculation error: {e}")
            return {}
    
    def calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calculate RSI"""
        if len(prices) < period + 1:
            return 50.0
            
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi.iloc[-1] if not np.isnan(rsi.iloc[-1]) else 50.0
    
    def calculate_macd_signal(self, prices: pd.Series) -> float:
        """Calculate MACD signal"""
        if len(prices) < 26:
            return 0.0
            
        exp1 = prices.ewm(span=12, adjust=False).mean()
        exp2 = prices.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=9, adjust=False).mean()
        
        return (macd - signal).iloc[-1]
    
    def calculate_bollinger_position(self, prices: pd.Series, period: int = 20) -> float:
        """Calculate position within Bollinger Bands"""
        if len(prices) < period:
            return 0.5
            
        sma = prices.rolling(window=period).mean()
        std = prices.rolling(window=period).std()
        
        upper_band = sma + (std * 2)
        lower_band = sma - (std * 2)
        
        current_price = prices.iloc[-1]
        position = (current_price - lower_band.iloc[-1]) / (upper_band.iloc[-1] - lower_band.iloc[-1])
        
        return np.clip(position, 0, 1)
    
    def ml_predict(self, micro_features: Dict, tech_signals: Dict) -> Dict:
        """Simplified ML prediction (replace with actual model)"""
        # Combine all features
        all_features = {**micro_features, **tech_signals}
        
        # Simple heuristic model for now
        score = 0
        confidence = 0.5
        
        # Microstructure signals
        if micro_features.get('kyle_lambda', 0) < 0:  # Price impact is negative
            score += 1
            confidence += 0.1
            
        if micro_features.get('vpin', 0) < 0.3:  # Low probability of informed trading
            score += 1
            confidence += 0.1
            
        # Technical signals
        if tech_signals.get('rsi', 50) < 30:  # Oversold
            score += 2
            confidence += 0.2
        elif tech_signals.get('rsi', 50) > 70:  # Overbought
            score -= 2
            confidence += 0.2
            
        if tech_signals.get('macd_signal', 0) > 0:  # Bullish MACD
            score += 1
            confidence += 0.1
            
        # Determine direction
        if score > 1:
            direction = 1  # Long
        elif score < -1:
            direction = -1  # Short
        else:
            direction = 0  # Neutral
            
        return {
            'direction': direction,
            'confidence': min(confidence, 0.9),
            'expected_return': direction * confidence * 0.02,  # 2% base return
            'holding_period': '1D' if confidence > 0.7 else '4H'
        }


class RiskManagementEngine:
    """
    Manages portfolio risk and position sizing
    """
    def __init__(self, trading_client: TradingClient):
        self.trading_client = trading_client
        self.max_position_size = 0.1  # 10% max per position
        self.max_leverage = 2.0
        self.max_drawdown = 0.15  # 15% max drawdown
        self.var_confidence = 0.99
        
    async def optimize_portfolio(self, signals: Dict[str, Dict], current_portfolio: Dict) -> List[Dict]:
        """Optimize portfolio based on signals and risk constraints"""
        orders = []
        
        # Get current account info
        account = self.trading_client.get_account()
        buying_power = float(account.buying_power)
        portfolio_value = float(account.equity)
        
        # Calculate current risk metrics
        risk_metrics = await self.calculate_portfolio_risk(current_portfolio)
        
        # Filter signals by confidence
        high_confidence_signals = {
            symbol: signal for symbol, signal in signals.items()
            if signal['confidence'] > 0.6
        }
        
        # Position sizing based on Kelly Criterion (simplified)
        for symbol, signal in high_confidence_signals.items():
            if signal['direction'] == 0:
                continue
                
            # Calculate position size
            kelly_fraction = self.calculate_kelly_fraction(
                signal['expected_return'],
                signal['confidence']
            )
            
            # Apply constraints
            position_size = min(
                kelly_fraction * portfolio_value,
                self.max_position_size * portfolio_value,
                buying_power * 0.9  # Leave some buffer
            )
            
            # Generate order
            if position_size > 100:  # Minimum order size
                quantity = int(position_size / self.get_current_price(symbol))
                
                if quantity > 0:
                    orders.append({
                        'symbol': symbol,
                        'quantity': quantity,
                        'side': 'buy' if signal['direction'] > 0 else 'sell',
                        'type': 'limit',  # Use limit orders for better execution
                        'time_in_force': 'day',
                        'signal': signal
                    })
        
        # Apply portfolio-level risk constraints
        orders = self.apply_risk_constraints(orders, risk_metrics)
        
        return orders
    
    def calculate_kelly_fraction(self, expected_return: float, win_probability: float) -> float:
        """Calculate Kelly fraction for position sizing"""
        if expected_return <= 0 or win_probability <= 0.5:
            return 0.0
            
        # Simplified Kelly: f = p - q/b
        # where p = win probability, q = loss probability, b = win/loss ratio
        loss_probability = 1 - win_probability
        win_loss_ratio = 2.0  # Assume 2:1 reward/risk
        
        kelly = win_probability - (loss_probability / win_loss_ratio)
        
        # Apply Kelly fraction scaling (never full Kelly)
        return max(0, min(kelly * 0.25, 0.1))  # Max 10% per position
    
    def get_current_price(self, symbol: str) -> float:
        """Get current price for a symbol"""
        try:
            position = self.trading_client.get_position(symbol)
            return float(position.current_price)
        except:
            # Fallback to last trade price
            return 100.0  # Default for now
    
    async def calculate_portfolio_risk(self, portfolio: Dict) -> Dict:
        """Calculate comprehensive risk metrics"""
        positions = self.trading_client.get_all_positions()
        
        if not positions:
            return {
                'var_95': 0,
                'var_99': 0,
                'expected_shortfall': 0,
                'current_leverage': 0,
                'concentration_risk': 0,
                'correlation_risk': 0
            }
        
        # Calculate position values and weights
        position_values = {}
        total_value = 0
        
        for position in positions:
            value = float(position.market_value)
            position_values[position.symbol] = value
            total_value += abs(value)
        
        # Calculate concentration risk (HHI)
        if total_value > 0:
            weights = [abs(value) / total_value for value in position_values.values()]
            concentration_risk = sum(w**2 for w in weights)
        else:
            concentration_risk = 0
        
        # Simplified VaR calculation
        # In production, use historical returns and proper VaR methodology
        portfolio_volatility = 0.15  # Assume 15% annual volatility
        daily_vol = portfolio_volatility / np.sqrt(252)
        
        var_95 = total_value * 1.645 * daily_vol
        var_99 = total_value * 2.326 * daily_vol
        expected_shortfall = total_value * 2.665 * daily_vol
        
        # Calculate leverage
        account = self.trading_client.get_account()
        leverage = total_value / float(account.equity)
        
        return {
            'var_95': var_95,
            'var_99': var_99,
            'expected_shortfall': expected_shortfall,
            'current_leverage': leverage,
            'concentration_risk': concentration_risk,
            'correlation_risk': 0.5  # Placeholder
        }
    
    def apply_risk_constraints(self, orders: List[Dict], risk_metrics: Dict) -> List[Dict]:
        """Apply portfolio-level risk constraints"""
        # Check leverage constraint
        if risk_metrics['current_leverage'] > self.max_leverage * 0.8:
            # Reduce all order sizes proportionally
            reduction_factor = 0.5
            for order in orders:
                order['quantity'] = int(order['quantity'] * reduction_factor)
        
        # Check concentration risk
        if risk_metrics['concentration_risk'] > 0.3:  # HHI > 0.3 indicates high concentration
            # Limit orders to diversify
            orders = orders[:3]  # Take only top 3 signals
        
        # Remove orders that are too small
        orders = [order for order in orders if order['quantity'] > 0]
        
        return orders


class ExecutionEngine:
    """
    Handles order execution with smart routing and anti-slippage logic
    """
    def __init__(self, trading_client: TradingClient):
        self.trading_client = trading_client
        self.max_slippage = 0.002  # 20 bps
        
    async def execute_order(self, order: Dict) -> Dict:
        """Execute order with smart routing"""
        try:
            # Determine execution strategy based on order size and urgency
            execution_strategy = self.select_execution_strategy(order)
            
            if execution_strategy == 'AGGRESSIVE':
                result = await self.aggressive_execution(order)
            elif execution_strategy == 'PASSIVE':
                result = await self.passive_execution(order)
            else:
                result = await self.adaptive_execution(order)
            
            return result
            
        except Exception as e:
            logger.error(f"Execution error for {order['symbol']}: {e}")
            return {'status': 'failed', 'error': str(e)}
    
    def select_execution_strategy(self, order: Dict) -> str:
        """Select execution strategy based on order characteristics"""
        # High confidence signals should be executed aggressively
        if order['signal']['confidence'] > 0.8:
            return 'AGGRESSIVE'
        
        # Large orders should be executed passively
        if order['quantity'] > 1000:  # Adjust threshold as needed
            return 'PASSIVE'
        
        return 'ADAPTIVE'
    
    async def aggressive_execution(self, order: Dict) -> Dict:
        """Execute aggressively using market orders"""
        request = MarketOrderRequest(
            symbol=order['symbol'],
            qty=order['quantity'],
            side=order['side'],
            time_in_force='day'
        )
        
        result = self.trading_client.submit_order(request)
        
        return {
            'status': 'submitted',
            'order_id': result.id,
            'strategy': 'aggressive',
            'order': result
        }
    
    async def passive_execution(self, order: Dict) -> Dict:
        """Execute passively using limit orders"""
        # Get current quote
        current_price = self.get_current_price(order['symbol'])
        
        # Place limit order at favorable price
        if order['side'] == 'buy':
            limit_price = current_price * (1 - 0.0001)  # 1 bp below market
        else:
            limit_price = current_price * (1 + 0.0001)  # 1 bp above market
        
        request = LimitOrderRequest(
            symbol=order['symbol'],
            qty=order['quantity'],
            side=order['side'],
            time_in_force='day',
            limit_price=round(limit_price, 2)
        )
        
        result = self.trading_client.submit_order(request)
        
        return {
            'status': 'submitted',
            'order_id': result.id,
            'strategy': 'passive',
            'limit_price': limit_price,
            'order': result
        }
    
    async def adaptive_execution(self, order: Dict) -> Dict:
        """Adaptive execution using TWAP-like approach"""
        # Split order into smaller chunks
        chunk_size = max(1, order['quantity'] // 5)
        chunks = []
        
        remaining = order['quantity']
        while remaining > 0:
            current_chunk = min(chunk_size, remaining)
            chunks.append(current_chunk)
            remaining -= current_chunk
        
        # Execute chunks with delays
        results = []
        for i, chunk in enumerate(chunks):
            chunk_order = {
                **order,
                'quantity': chunk
            }
            
            # Alternate between market and limit orders
            if i % 2 == 0:
                result = await self.aggressive_execution(chunk_order)
            else:
                result = await self.passive_execution(chunk_order)
            
            results.append(result)
            
            # Add delay between chunks (except for last one)
            if i < len(chunks) - 1:
                await asyncio.sleep(2)  # 2 second delay
        
        return {
            'status': 'submitted',
            'strategy': 'adaptive',
            'chunks': len(chunks),
            'results': results
        }
    
    def get_current_price(self, symbol: str) -> float:
        """Get current price for limit orders"""
        try:
            position = self.trading_client.get_position(symbol)
            return float(position.current_price)
        except:
            return 100.0  # Fallback


class MarketDataEngine:
    """
    Processes real-time market data and maintains order book state
    """
    def __init__(self):
        self.tick_buffers = {}
        self.order_books = {}
        self.features_cache = {}
        
    async def process_tick(self, tick: Dict):
        """Process incoming tick data"""
        symbol = tick['symbol']
        
        # Update tick buffer
        if symbol not in self.tick_buffers:
            self.tick_buffers[symbol] = deque(maxlen=10000)
        
        self.tick_buffers[symbol].append({
            **tick,
            'timestamp': datetime.now()
        })
        
        # Calculate real-time features
        features = await self.calculate_features(symbol)
        self.features_cache[symbol] = features
        
        # Detect anomalies
        anomalies = await self.detect_anomalies(symbol)
        if anomalies:
            logger.warning(f"Anomalies detected for {symbol}: {anomalies}")
        
        return features
    
    async def calculate_features(self, symbol: str) -> Dict:
        """Calculate real-time market features"""
        if symbol not in self.tick_buffers or len(self.tick_buffers[symbol]) < 10:
            return {}
        
        ticks = list(self.tick_buffers[symbol])
        
        # Convert to DataFrame for easier calculation
        df = pd.DataFrame(ticks)
        
        features = {
            'spread': self.calculate_spread(df),
            'volatility': self.calculate_volatility(df),
            'volume_profile': self.calculate_volume_profile(df),
            'momentum': self.calculate_momentum(df),
            'liquidity': self.estimate_liquidity(df)
        }
        
        return features
    
    def calculate_spread(self, df: pd.DataFrame) -> float:
        """Calculate average spread"""
        if 'bid' in df.columns and 'ask' in df.columns:
            spreads = df['ask'] - df['bid']
            return spreads.mean()
        return 0.0
    
    def calculate_volatility(self, df: pd.DataFrame) -> float:
        """Calculate realized volatility"""
        if 'price' in df.columns and len(df) > 2:
            returns = df['price'].pct_change().dropna()
            if len(returns) > 0:
                return returns.std() * np.sqrt(252 * 390)  # Annualized
        return 0.0
    
    def calculate_volume_profile(self, df: pd.DataFrame) -> Dict:
        """Calculate volume profile statistics"""
        if 'volume' not in df.columns:
            return {}
        
        return {
            'mean_volume': df['volume'].mean(),
            'volume_trend': df['volume'].pct_change().mean(),
            'volume_volatility': df['volume'].std()
        }
    
    def calculate_momentum(self, df: pd.DataFrame) -> float:
        """Calculate price momentum"""
        if 'price' in df.columns and len(df) > 20:
            return (df['price'].iloc[-1] / df['price'].iloc[-20] - 1) * 100
        return 0.0
    
    def estimate_liquidity(self, df: pd.DataFrame) -> float:
        """Estimate market liquidity"""
        if 'volume' in df.columns and 'price' in df.columns:
            # Amihud illiquidity ratio
            price_impact = (df['price'].pct_change().abs() / df['volume']).mean()
            return 1 / (price_impact + 1e-10)  # Higher value = more liquid
        return 0.0
    
    async def detect_anomalies(self, symbol: str) -> List[Dict]:
        """Detect market anomalies"""
        anomalies = []
        
        if symbol not in self.tick_buffers or len(self.tick_buffers[symbol]) < 100:
            return anomalies
        
        ticks = list(self.tick_buffers[symbol])
        df = pd.DataFrame(ticks)
        
        # Fat finger detection
        if 'price' in df.columns:
            price_changes = df['price'].pct_change().abs()
            fat_finger_threshold = price_changes.std() * 5
            
            if price_changes.iloc[-1] > fat_finger_threshold:
                anomalies.append({
                    'type': 'fat_finger',
                    'severity': 'high',
                    'details': f'Price moved {price_changes.iloc[-1]*100:.2f}%'
                })
        
        # Volume spike detection
        if 'volume' in df.columns:
            volume_mean = df['volume'].rolling(50).mean()
            if df['volume'].iloc[-1] > volume_mean.iloc[-1] * 10:
                anomalies.append({
                    'type': 'volume_spike',
                    'severity': 'medium',
                    'details': f'Volume {df["volume"].iloc[-1]/volume_mean.iloc[-1]:.1f}x average'
                })
        
        return anomalies


class ComplianceEngine:
    """
    Monitors trading activity for compliance and regulatory requirements
    """
    def __init__(self):
        self.trade_log = deque(maxlen=10000)
        self.alerts = []
        
    async def pre_trade_check(self, order: Dict) -> Tuple[bool, List[str]]:
        """Pre-trade compliance checks"""
        violations = []
        
        # Pattern Day Trading check
        if await self.is_pattern_day_trader_violation(order):
            violations.append("Pattern day trading rule violation")
        
        # Position concentration check
        if await self.exceeds_position_limit(order):
            violations.append("Position concentration limit exceeded")
        
        # Wash sale check
        if await self.is_wash_sale(order):
            violations.append("Potential wash sale detected")
        
        return len(violations) == 0, violations
    
    async def post_trade_surveillance(self, execution: Dict):
        """Post-trade surveillance and reporting"""
        # Log trade
        self.trade_log.append({
            'timestamp': datetime.now(),
            'execution': execution,
            'market_conditions': await self.capture_market_conditions(execution['symbol'])
        })
        
        # Check for suspicious patterns
        await self.check_manipulation_patterns()
        
        # Generate required reports
        if self.is_reporting_time():
            await self.generate_regulatory_reports()
    
    async def is_pattern_day_trader_violation(self, order: Dict) -> bool:
        """Check PDT rule compliance"""
        # Simplified check - in production, track day trades properly
        account = TradingClient(
            api_key=os.getenv("ALPACA_API_KEY_ID"),
            secret_key=os.getenv("ALPACA_API_SECRET"),
            paper=True
        ).get_account()
        
        if float(account.equity) < 25000 and account.pattern_day_trader:
            return True
        
        return False
    
    async def exceeds_position_limit(self, order: Dict) -> bool:
        """Check position concentration limits"""
        # Implement position limit checks
        return False
    
    async def is_wash_sale(self, order: Dict) -> bool:
        """Check for wash sale violations"""
        # Look for sells followed by buys within 30 days
        symbol = order['symbol']
        
        recent_trades = [
            trade for trade in self.trade_log 
            if trade['execution'].get('symbol') == symbol
            and (datetime.now() - trade['timestamp']).days <= 30
        ]
        
        # Simplified wash sale detection
        for trade in recent_trades:
            if (trade['execution'].get('side') == 'sell' and 
                order['side'] == 'buy'):
                return True
        
        return False
    
    async def capture_market_conditions(self, symbol: str) -> Dict:
        """Capture market conditions at time of trade"""
        return {
            'timestamp': datetime.now().isoformat(),
            'symbol': symbol,
            'market_phase': 'regular' if self.is_market_hours() else 'extended',
            'volatility': 'normal'  # Placeholder
        }
    
    def is_market_hours(self) -> bool:
        """Check if market is open"""
        now = datetime.now()
        market_open = now.replace(hour=9, minute=30, second=0)
        market_close = now.replace(hour=16, minute=0, second=0)
        
        return market_open <= now <= market_close and now.weekday() < 5
    
    def is_reporting_time(self) -> bool:
        """Check if it's time to generate reports"""
        now = datetime.now()
        return now.hour == 16 and now.minute == 30  # 4:30 PM
    
    async def check_manipulation_patterns(self):
        """Check for market manipulation patterns"""
        # Implement spoofing, layering, and other manipulation detection
        pass
    
    async def generate_regulatory_reports(self):
        """Generate required regulatory reports"""
        logger.info("Generating regulatory reports...")
        # Implement report generation
        pass


class TradingOrchestrator:
    """
    Master orchestrator that coordinates all trading agents
    """
    def __init__(self):
        # Initialize Alpaca clients
        self.trading_client = TradingClient(
            api_key=os.getenv("ALPACA_API_KEY_ID"),
            secret_key=os.getenv("ALPACA_API_SECRET"),
            paper=True
        )
        
        self.data_client = StockHistoricalDataClient(
            api_key=os.getenv("ALPACA_API_KEY_ID"),
            secret_key=None
        )
        
        # Initialize agents
        self.alpha_engine = AlphaSignalGenerator(self.data_client)
        self.risk_engine = RiskManagementEngine(self.trading_client)
        self.execution_engine = ExecutionEngine(self.trading_client)
        self.market_data_engine = MarketDataEngine()
        self.compliance_engine = ComplianceEngine()
        
        # Trading universe
        self.universe = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'SPY', 'QQQ']
        
        # Control flags
        self.is_running = False
        self.trading_enabled = True
    
    async def run_trading_cycle(self):
        """Main trading loop"""
        logger.info("Starting trading cycle...")
        
        try:
            # 1. Generate alpha signals
            signals = await self.alpha_engine.generate_signals(self.universe)
            logger.info(f"Generated {len(signals)} signals")
            
            # 2. Get current portfolio
            positions = self.trading_client.get_all_positions()
            current_portfolio = {
                pos.symbol: {
                    'quantity': float(pos.qty),
                    'market_value': float(pos.market_value),
                    'cost_basis': float(pos.cost_basis)
                }
                for pos in positions
            }
            
            # 3. Optimize portfolio and generate orders
            orders = await self.risk_engine.optimize_portfolio(signals, current_portfolio)
            logger.info(f"Generated {len(orders)} orders")
            
            # 4. Compliance pre-trade checks
            for order in orders:
                passed, violations = await self.compliance_engine.pre_trade_check(order)
                
                if not passed:
                    logger.warning(f"Order for {order['symbol']} failed compliance: {violations}")
                    continue
                
                # 5. Execute order
                if self.trading_enabled:
                    execution = await self.execution_engine.execute_order(order)
                    logger.info(f"Executed order for {order['symbol']}: {execution['status']}")
                    
                    # 6. Post-trade surveillance
                    await self.compliance_engine.post_trade_surveillance(execution)
                else:
                    logger.info(f"Trading disabled - would execute: {order}")
            
        except Exception as e:
            logger.error(f"Error in trading cycle: {e}")
    
    async def start(self):
        """Start the trading system"""
        self.is_running = True
        logger.info("Trading system started")
        
        while self.is_running:
            if self.is_market_hours():
                await self.run_trading_cycle()
                await asyncio.sleep(60)  # Run every minute
            else:
                logger.info("Market closed - waiting...")
                await asyncio.sleep(300)  # Check every 5 minutes
    
    def stop(self):
        """Stop the trading system"""
        self.is_running = False
        logger.info("Trading system stopped")
    
    def is_market_hours(self) -> bool:
        """Check if market is open (including extended hours)"""
        now = datetime.now()
        
        # Extended hours: 4:00 AM - 8:00 PM ET
        market_open = now.replace(hour=4, minute=0, second=0)
        market_close = now.replace(hour=20, minute=0, second=0)
        
        return market_open <= now <= market_close and now.weekday() < 5
    
    async def get_system_status(self) -> Dict:
        """Get current system status"""
        account = self.trading_client.get_account()
        positions = self.trading_client.get_all_positions()
        
        return {
            'status': 'running' if self.is_running else 'stopped',
            'trading_enabled': self.trading_enabled,
            'account': {
                'equity': float(account.equity),
                'buying_power': float(account.buying_power),
                'cash': float(account.cash),
                'pattern_day_trader': account.pattern_day_trader
            },
            'positions': len(positions),
            'universe': self.universe,
            'last_update': datetime.now().isoformat()
        }


# FastAPI endpoints for the trading system
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Personal Quant Trading System")

# Global orchestrator instance
orchestrator = None

class TradingCommand(BaseModel):
    action: str  # start, stop, enable_trading, disable_trading
    params: Optional[Dict] = {}

class UniverseUpdate(BaseModel):
    symbols: List[str]

@app.on_event("startup")
async def startup_event():
    global orchestrator
    orchestrator = TradingOrchestrator()
    
@app.post("/trading/control")
async def control_trading(command: TradingCommand):
    """Control the trading system"""
    if command.action == "start":
        asyncio.create_task(orchestrator.start())
        return {"status": "Trading system started"}
    
    elif command.action == "stop":
        orchestrator.stop()
        return {"status": "Trading system stopped"}
    
    elif command.action == "enable_trading":
        orchestrator.trading_enabled = True
        return {"status": "Trading enabled"}
    
    elif command.action == "disable_trading":
        orchestrator.trading_enabled = False
        return {"status": "Trading disabled (simulation mode)"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@app.get("/trading/status")
async def get_status():
    """Get current system status"""
    return await orchestrator.get_system_status()

@app.post("/trading/universe")
async def update_universe(update: UniverseUpdate):
    """Update trading universe"""
    orchestrator.universe = update.symbols
    return {"status": "Universe updated", "symbols": update.symbols}

@app.get("/trading/signals")
async def get_signals():
    """Get current trading signals"""
    signals = await orchestrator.alpha_engine.generate_signals(orchestrator.universe)
    return signals

@app.get("/trading/risk")
async def get_risk_metrics():
    """Get current risk metrics"""
    positions = orchestrator.trading_client.get_all_positions()
    current_portfolio = {
        pos.symbol: {
            'quantity': float(pos.qty),
            'market_value': float(pos.market_value)
        }
        for pos in positions
    }
    
    risk_metrics = await orchestrator.risk_engine.calculate_portfolio_risk(current_portfolio)
    return risk_metrics

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
