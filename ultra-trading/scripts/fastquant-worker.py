#!/usr/bin/env python3
"""
ULTRA Trading Platform - Fastquant Worker
Handles backtesting requests from the TypeScript services
"""

import json
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import sys
import os

# Add fastquant to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../fastquant/python'))

try:
    from fastquant import backtest, Strategy
    from fastquant import get_stock_data
except ImportError:
    print("Error: fastquant not found. Please ensure it's installed.")
    sys.exit(1)


class ODTEOptionsStrategy(Strategy):
    """
    Custom 0DTE options strategy for fastquant
    """
    
    def init(self, 
             delta_threshold=0.3,
             profit_target=0.3,
             stop_loss=0.5,
             volume_multiplier=5):
        """Initialize strategy parameters"""
        self.delta_threshold = delta_threshold
        self.profit_target = profit_target
        self.stop_loss = stop_loss
        self.volume_multiplier = volume_multiplier
        
    def next(self):
        """Execute strategy logic"""
        # Get current price and volume
        current_price = self.data.Close[-1]
        current_volume = self.data.Volume[-1]
        avg_volume = self.data.Volume[-20:].mean() if len(self.data.Volume) >= 20 else current_volume
        
        # Check for volume spike
        volume_spike = current_volume > (avg_volume * self.volume_multiplier)
        
        # Simple momentum indicator
        if len(self.data.Close) >= 20:
            sma20 = self.data.Close[-20:].mean()
            momentum = (current_price - sma20) / sma20
            
            # Entry conditions
            if not self.position and volume_spike:
                if momentum > self.delta_threshold:
                    # Buy signal
                    self.buy(size=0.95)  # Use 95% of available capital
                elif momentum < -self.delta_threshold:
                    # Short signal (if supported)
                    self.sell(size=0.95)
            
            # Exit conditions
            elif self.position:
                # Calculate P&L
                entry_price = self.position.price
                current_pnl = (current_price - entry_price) / entry_price
                
                if self.position.is_long:
                    if current_pnl >= self.profit_target or current_pnl <= -self.stop_loss:
                        self.position.close()
                else:  # Short position
                    if current_pnl <= -self.profit_target or current_pnl >= self.stop_loss:
                        self.position.close()


class FastquantWorker:
    """
    Worker class to handle backtesting requests
    """
    
    def __init__(self):
        self.strategy_mapping = {
            'RSI': 'rsi',
            'MACD': 'macd',
            'BBANDS': 'bbands',
            'SMA': 'smac',
            'EMA': 'emac',
            'ODDTE_OPTIONS': ODTEOptionsStrategy
        }
    
    def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process a backtest request"""
        try:
            request_type = request.get('type', 'single')
            
            if request_type == 'single':
                return self.run_single_backtest(request)
            elif request_type == 'grid':
                return self.run_grid_search(request)
            elif request_type == 'multi-asset':
                return self.run_multi_asset_backtest(request)
            else:
                raise ValueError(f"Unknown request type: {request_type}")
                
        except Exception as e:
            return {
                'requestId': request.get('requestId', 'unknown'),
                'success': False,
                'error': str(e)
            }
    
    def run_single_backtest(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single backtest"""
        config = request['config']
        data = request.get('data')
        
        # Convert data to DataFrame
        df = self.ohlcv_to_dataframe(data) if data else None
        
        if df is None:
            # Fetch data using fastquant (fallback)
            df = get_stock_data(
                config['symbol'],
                config['startDate'],
                config['endDate'],
                source='yahoo'
            )
        
        # Get strategy
        strategy = self.strategy_mapping.get(config['strategy'])
        if strategy is None:
            raise ValueError(f"Unknown strategy: {config['strategy']}")
        
        # Set parameters
        init_cash = config.get('initialCapital', 100000)
        commission = config.get('commission', 0.001)
        
        # Run backtest
        if config['strategy'] == 'ODDTE_OPTIONS':
            # Custom strategy
            params = config.get('parameters', {})
            result = backtest(
                strategy,
                df,
                init_cash=init_cash,
                commission=commission,
                **params
            )
        else:
            # Built-in strategy
            params = self.get_strategy_params(config['strategy'], config.get('parameters', {}))
            result = backtest(
                strategy,
                df,
                init_cash=init_cash,
                commission=commission,
                **params
            )
        
        # Convert result to our format
        metrics = self.calculate_metrics(result, init_cash)
        trades = self.extract_trades(result)
        equity_curve = result['portfolio_value'].tolist() if 'portfolio_value' in result else []
        dates = result.index.strftime('%Y-%m-%d').tolist() if hasattr(result, 'index') else []
        
        return {
            'requestId': request['requestId'],
            'success': True,
            'result': {
                'metrics': metrics,
                'trades': trades,
                'equityCurve': equity_curve,
                'dates': dates
            }
        }
    
    def run_grid_search(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Run grid search optimization"""
        config = request['config']
        param_ranges = config['parameterRanges']
        metric_to_optimize = config.get('metric', 'sharpe')
        
        # Generate parameter combinations
        param_combinations = self.generate_param_combinations(param_ranges)
        
        all_results = []
        best_metric = -float('inf')
        best_params = None
        
        for params in param_combinations:
            # Run backtest with these parameters
            single_request = {
                'type': 'single',
                'config': {
                    **request.get('config', {}),
                    'parameters': params
                },
                'data': request.get('data'),
                'requestId': request['requestId']
            }
            
            result = self.run_single_backtest(single_request)
            
            if result['success']:
                metrics = result['result']['metrics']
                metric_value = metrics.get(f'{metric_to_optimize}Ratio', metrics.get('totalReturn', 0))
                
                all_results.append({
                    'parameters': params,
                    'metric': metric_value,
                    'result': metrics
                })
                
                if metric_value > best_metric:
                    best_metric = metric_value
                    best_params = params
        
        return {
            'requestId': request['requestId'],
            'success': True,
            'result': {
                'bestParameters': best_params,
                'bestMetric': best_metric,
                'allResults': all_results
            }
        }
    
    def run_multi_asset_backtest(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Run multi-asset portfolio backtest"""
        config = request['config']
        assets = config['assets']
        
        # Run individual backtests
        asset_results = {}
        portfolio_values = []
        
        for asset in assets:
            # Run backtest for each asset
            single_request = {
                'type': 'single',
                'config': {
                    'symbol': asset['symbol'],
                    'startDate': config['startDate'],
                    'endDate': config['endDate'],
                    'initialCapital': config['initialCapital'] * asset['allocation'],
                    'strategy': 'SMA'  # Default strategy
                },
                'requestId': request['requestId']
            }
            
            result = self.run_single_backtest(single_request)
            
            if result['success']:
                asset_results[asset['symbol']] = result['result']['metrics']
                
                # Weight by allocation
                if result['result']['equityCurve']:
                    weighted_values = [v * asset['allocation'] for v in result['result']['equityCurve']]
                    if not portfolio_values:
                        portfolio_values = weighted_values
                    else:
                        portfolio_values = [p + w for p, w in zip(portfolio_values, weighted_values)]
        
        # Calculate portfolio metrics
        portfolio_metrics = self.calculate_portfolio_metrics(
            portfolio_values,
            config['initialCapital']
        )
        
        # Calculate correlation matrix (simplified)
        correlation_matrix = self.calculate_correlation_matrix(assets)
        
        # Optimize allocation (simplified - equal weight for now)
        optimal_allocation = {asset['symbol']: 1.0 / len(assets) for asset in assets}
        
        return {
            'requestId': request['requestId'],
            'success': True,
            'result': {
                'portfolioMetrics': portfolio_metrics,
                'assetMetrics': asset_results,
                'correlationMatrix': correlation_matrix,
                'optimalAllocation': optimal_allocation,
                'rebalanceDates': []  # Simplified
            }
        }
    
    def ohlcv_to_dataframe(self, data: Dict[str, List]) -> pd.DataFrame:
        """Convert OHLCV data to pandas DataFrame"""
        df = pd.DataFrame({
            'date': pd.to_datetime(data['date']),
            'open': data['open'],
            'high': data['high'],
            'low': data['low'],
            'close': data['close'],
            'volume': data['volume']
        })
        
        df.set_index('date', inplace=True)
        df.columns = [col.capitalize() for col in df.columns]  # Capitalize column names
        
        return df
    
    def calculate_metrics(self, result: pd.DataFrame, initial_capital: float) -> Dict[str, float]:
        """Calculate backtest metrics"""
        if isinstance(result, pd.DataFrame) and 'portfolio_value' in result.columns:
            portfolio_values = result['portfolio_value']
            returns = portfolio_values.pct_change().dropna()
            
            # Calculate metrics
            total_return = (portfolio_values.iloc[-1] - initial_capital) / initial_capital
            annualized_return = (1 + total_return) ** (252 / len(portfolio_values)) - 1
            
            # Sharpe ratio (assuming 0% risk-free rate)
            sharpe_ratio = returns.mean() / returns.std() * np.sqrt(252) if returns.std() > 0 else 0
            
            # Max drawdown
            cumulative = (1 + returns).cumprod()
            running_max = cumulative.expanding().max()
            drawdown = (cumulative - running_max) / running_max
            max_drawdown = drawdown.min()
            
            # Win rate (simplified)
            winning_days = (returns > 0).sum()
            total_days = len(returns)
            win_rate = winning_days / total_days if total_days > 0 else 0
            
            return {
                'totalReturn': total_return,
                'annualizedReturn': annualized_return,
                'sharpeRatio': sharpe_ratio,
                'maxDrawdown': abs(max_drawdown),
                'winRate': win_rate,
                'profitFactor': 1.5,  # Placeholder
                'totalTrades': 100,  # Placeholder
                'winningTrades': int(win_rate * 100),
                'losingTrades': int((1 - win_rate) * 100),
                'avgWin': 0.01,  # Placeholder
                'avgLoss': -0.01,  # Placeholder
                'bestTrade': 0.05,  # Placeholder
                'worstTrade': -0.03,  # Placeholder
                'avgHoldingPeriod': 5,  # Placeholder
                'finalValue': portfolio_values.iloc[-1]
            }
        else:
            # Return default metrics if result format is different
            return {
                'totalReturn': 0,
                'annualizedReturn': 0,
                'sharpeRatio': 0,
                'maxDrawdown': 0,
                'winRate': 0,
                'profitFactor': 0,
                'totalTrades': 0,
                'winningTrades': 0,
                'losingTrades': 0,
                'avgWin': 0,
                'avgLoss': 0,
                'bestTrade': 0,
                'worstTrade': 0,
                'avgHoldingPeriod': 0,
                'finalValue': initial_capital
            }
    
    def extract_trades(self, result: Any) -> List[Dict[str, Any]]:
        """Extract individual trades from backtest result"""
        # This is a simplified implementation
        # In production, parse actual trade history from fastquant
        return []
    
    def get_strategy_params(self, strategy: str, custom_params: Dict[str, Any]) -> Dict[str, Any]:
        """Get strategy parameters"""
        default_params = {
            'RSI': {
                'rsi_period': 14,
                'rsi_upper': 70,
                'rsi_lower': 30
            },
            'MACD': {
                'fast_period': 12,
                'slow_period': 26,
                'signal_period': 9
            },
            'BBANDS': {
                'period': 20,
                'devfactor': 2.0
            },
            'SMA': {
                'fast_period': 10,
                'slow_period': 30
            },
            'EMA': {
                'fast_period': 10,
                'slow_period': 30
            }
        }
        
        params = default_params.get(strategy, {})
        params.update(custom_params)
        
        return params
    
    def generate_param_combinations(self, param_ranges: Dict[str, Dict[str, float]]) -> List[Dict[str, float]]:
        """Generate all parameter combinations for grid search"""
        import itertools
        
        param_names = list(param_ranges.keys())
        param_values = []
        
        for name in param_names:
            range_spec = param_ranges[name]
            values = []
            current = range_spec['min']
            while current <= range_spec['max']:
                values.append(current)
                current += range_spec['step']
            param_values.append(values)
        
        combinations = []
        for combo in itertools.product(*param_values):
            combinations.append(dict(zip(param_names, combo)))
        
        return combinations
    
    def calculate_portfolio_metrics(self, portfolio_values: List[float], initial_capital: float) -> Dict[str, float]:
        """Calculate portfolio-level metrics"""
        if not portfolio_values:
            return self.calculate_metrics(None, initial_capital)
        
        # Convert to pandas Series for easier calculation
        values = pd.Series(portfolio_values)
        returns = values.pct_change().dropna()
        
        total_return = (values.iloc[-1] - initial_capital) / initial_capital
        annualized_return = (1 + total_return) ** (252 / len(values)) - 1
        sharpe_ratio = returns.mean() / returns.std() * np.sqrt(252) if returns.std() > 0 else 0
        
        # Max drawdown
        cumulative = (1 + returns).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        max_drawdown = drawdown.min()
        
        return {
            'totalReturn': total_return,
            'annualizedReturn': annualized_return,
            'sharpeRatio': sharpe_ratio,
            'maxDrawdown': abs(max_drawdown),
            'winRate': 0.5,  # Placeholder
            'profitFactor': 1.5,  # Placeholder
            'totalTrades': 0,
            'winningTrades': 0,
            'losingTrades': 0,
            'avgWin': 0,
            'avgLoss': 0,
            'bestTrade': 0,
            'worstTrade': 0,
            'avgHoldingPeriod': 0,
            'finalValue': values.iloc[-1]
        }
    
    def calculate_correlation_matrix(self, assets: List[Dict[str, Any]]) -> List[List[float]]:
        """Calculate correlation matrix between assets"""
        # Simplified - return identity matrix
        n = len(assets)
        return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]


def main():
    """Main entry point for the worker"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: fastquant-worker.py <request.json>")
        sys.exit(1)
    
    # Read request from file or stdin
    if sys.argv[1] == '-':
        request = json.loads(sys.stdin.read())
    else:
        with open(sys.argv[1], 'r') as f:
            request = json.load(f)
    
    # Process request
    worker = FastquantWorker()
    response = worker.process_request(request)
    
    # Output response
    print(json.dumps(response, indent=2))


if __name__ == '__main__':
    main()