"""
Streamlit UI for Trading Backtesting Visualization
"""
import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from datetime import datetime, timedelta
import os

# Page configuration
st.set_page_config(
    page_title="Trading Backtesting Dashboard",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Title and description
st.title("📈 Trading Backtesting Dashboard")
st.markdown("Analyze and visualize your algorithmic trading strategies")

# Sidebar
with st.sidebar:
    st.header("Configuration")
    
    # Strategy selection
    strategy = st.selectbox(
        "Select Strategy",
        ["Moving Average Crossover", "RSI Oversold", "Bollinger Bands", "MACD Signal", "Mean Reversion"]
    )
    
    # Symbol selection
    symbol = st.selectbox(
        "Select Symbol",
        ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "SPY", "QQQ"]
    )
    
    # Date range
    col1, col2 = st.columns(2)
    with col1:
        start_date = st.date_input(
            "Start Date",
            datetime.now() - timedelta(days=365)
        )
    with col2:
        end_date = st.date_input(
            "End Date",
            datetime.now()
        )
    
    # Parameters
    st.subheader("Strategy Parameters")
    
    if strategy == "Moving Average Crossover":
        fast_period = st.slider("Fast MA Period", 5, 50, 10)
        slow_period = st.slider("Slow MA Period", 20, 200, 50)
    elif strategy == "RSI Oversold":
        rsi_period = st.slider("RSI Period", 5, 30, 14)
        oversold_threshold = st.slider("Oversold Threshold", 10, 40, 30)
    
    # Run backtest button
    run_backtest = st.button("Run Backtest", type="primary", use_container_width=True)

# Main content area
if run_backtest:
    # Placeholder for backtest results
    st.success("Backtest completed successfully!")
    
    # Metrics row
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Total Return", "+15.5%", "+2.3%")
    with col2:
        st.metric("Sharpe Ratio", "1.2", "+0.1")
    with col3:
        st.metric("Max Drawdown", "-8.3%", "-1.2%")
    with col4:
        st.metric("Win Rate", "57%", "+3%")
    
    # Tabs for different views
    tab1, tab2, tab3, tab4 = st.tabs(["📊 Performance", "📈 Trades", "📉 Drawdown", "📋 Statistics"])
    
    with tab1:
        st.subheader("Portfolio Performance")
        
        # Generate sample data
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        returns = np.random.randn(len(dates)) * 0.02
        cumulative_returns = (1 + returns).cumprod()
        
        # Create performance chart
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=dates,
            y=cumulative_returns * 10000,
            mode='lines',
            name='Portfolio Value',
            line=dict(color='blue', width=2)
        ))
        
        fig.update_layout(
            title="Portfolio Value Over Time",
            xaxis_title="Date",
            yaxis_title="Portfolio Value ($)",
            hovermode='x unified'
        )
        
        st.plotly_chart(fig, use_container_width=True)
    
    with tab2:
        st.subheader("Trade History")
        
        # Sample trade data
        trade_data = {
            "Date": pd.date_range(start=start_date, periods=10, freq='W'),
            "Symbol": [symbol] * 10,
            "Action": ["BUY", "SELL"] * 5,
            "Quantity": np.random.randint(10, 100, 10),
            "Price": np.random.uniform(100, 200, 10).round(2),
            "P&L": np.random.uniform(-500, 1000, 10).round(2)
        }
        
        df_trades = pd.DataFrame(trade_data)
        st.dataframe(df_trades, use_container_width=True)
    
    with tab3:
        st.subheader("Drawdown Analysis")
        
        # Create drawdown chart
        drawdown = (cumulative_returns - cumulative_returns.cummax()) / cumulative_returns.cummax() * 100
        
        fig_dd = go.Figure()
        fig_dd.add_trace(go.Scatter(
            x=dates,
            y=drawdown,
            fill='tozeroy',
            mode='lines',
            name='Drawdown %',
            line=dict(color='red')
        ))
        
        fig_dd.update_layout(
            title="Drawdown Over Time",
            xaxis_title="Date",
            yaxis_title="Drawdown (%)",
            hovermode='x unified'
        )
        
        st.plotly_chart(fig_dd, use_container_width=True)
    
    with tab4:
        st.subheader("Statistical Summary")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("""
            **Performance Metrics**
            - Annual Return: 15.5%
            - Annual Volatility: 12.8%
            - Sharpe Ratio: 1.2
            - Sortino Ratio: 1.5
            - Calmar Ratio: 1.8
            """)
        
        with col2:
            st.markdown("""
            **Risk Metrics**
            - Maximum Drawdown: -8.3%
            - Value at Risk (95%): -2.1%
            - Expected Shortfall: -3.2%
            - Beta: 0.85
            - Alpha: 0.03
            """)

else:
    # Welcome message
    st.info("👈 Configure your backtest parameters in the sidebar and click 'Run Backtest' to begin")
    
    # Quick start guide
    with st.expander("Quick Start Guide"):
        st.markdown("""
        1. **Select a Strategy**: Choose from available trading strategies
        2. **Pick a Symbol**: Select the stock or ETF to backtest
        3. **Set Date Range**: Define the historical period for backtesting
        4. **Adjust Parameters**: Fine-tune strategy-specific parameters
        5. **Run Backtest**: Click the button to execute the backtest
        6. **Analyze Results**: Review performance metrics and visualizations
        """)

# Footer
st.markdown("---")
st.markdown("Trading Backtesting Dashboard v0.1.0 | Built with Streamlit")
