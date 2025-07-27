# Trading Backtesting

A comprehensive framework for backtesting trading strategies and market analysis.

## Features

- Historical data analysis
- Strategy backtesting capabilities
- Performance metrics and reporting
- Modular architecture for extensibility

## Structure

- `fastquant/` - Backtesting components
- `alpaca-py/` - Market data integration
- `docs/` - Documentation

## Setup

```bash
# Create virtual environment
python -m venv trading_env
source trading_env/bin/activate  # On macOS/Linux
# or
# trading_env\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt
```

## Usage

```python
# Example usage
from fastquant import backtest

# Run backtesting with your strategy
results = backtest(strategy='smac', data=df)
```

## Testing

```bash
# Run tests
python -m pytest tests/
```

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*This project is under active development.*