/**
 * Real-time Trading Dashboard Component
 * Displays live trading updates using WebSocket connections
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  channel: string;
  type: string;
  data: any;
  timestamp?: string;
}

interface Position {
  symbol: string;
  qty: number;
  side: 'long' | 'short';
  market_value: number;
  unrealized_pl: number;
  unrealized_plpc: number;
}

interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type: string;
  status: string;
  filled_qty?: number;
  filled_avg_price?: number;
}

interface PerformanceMetrics {
  dailyPnL: number;
  dailyTarget: number;
  targetProgress: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  currentDrawdown: number;
}

interface AgentStatus {
  agent: string;
  status: 'idle' | 'analyzing' | 'executing' | 'error';
  details?: any;
  timestamp: string;
}

export const RealtimeDashboard: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    dailyPnL: 0,
    dailyTarget: 300,
    targetProgress: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    currentDrawdown: 0
  });
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [alerts, setAlerts] = useState<Array<{ id: string; severity: string; message: string; timestamp: string }>>([]);
  const [systemStatus, setSystemStatus] = useState<'online' | 'offline' | 'degraded'>('offline');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const {host} = window.location;
    return `${protocol}//${host}/ws/realtime`;
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Subscribe to all channels
      const channels = [
        'orders', 'positions', 'agent_status', 'agent_decisions',
        'agent_analysis', 'performance', 'daily_pnl', 'alerts',
        'system_status', 'errors'
      ];
      
      channels.forEach(channel => {
        ws.send(JSON.stringify({ type: 'subscribe', channel }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      wsRef.current = null;
      
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };
  }, [getWebSocketUrl]);

  // Handle incoming messages
  const handleMessage = useCallback((message: WebSocketMessage) => {
    const { channel, type, data } = message;

    switch (channel) {
      case 'positions':
        if (type === 'position.opened' || type === 'position.updated') {
          setPositions(prev => {
            const index = prev.findIndex(p => p.symbol === data.symbol);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = data;
              return updated;
            }
            return [...prev, data];
          });
        } else if (type === 'position.closed') {
          setPositions(prev => prev.filter(p => p.symbol !== data.symbol));
        }
        break;

      case 'orders':
        setRecentOrders(prev => {
          const updated = [data, ...prev].slice(0, 20); // Keep last 20 orders
          return updated;
        });
        break;

      case 'performance':
        setPerformance(data);
        break;

      case 'daily_pnl':
        setPerformance(prev => ({
          ...prev,
          dailyPnL: data.value,
          targetProgress: data.progress
        }));
        break;

      case 'agent_status':
        setAgentStatuses(prev => ({
          ...prev,
          [data.agent]: {
            agent: data.agent,
            status: data.status,
            details: data.details,
            timestamp: data.timestamp
          }
        }));
        break;

      case 'alerts':
        setAlerts(prev => [{
          id: Date.now().toString(),
          severity: type.split('.')[1] || 'info',
          message: data.message,
          timestamp: data.timestamp
        }, ...prev].slice(0, 10)); // Keep last 10 alerts
        break;

      case 'system_status':
        setSystemStatus(data.status);
        break;

      case 'errors':
        setAlerts(prev => [{
          id: Date.now().toString(),
          severity: 'error',
          message: `Error: ${data.message} (${data.context})`,
          timestamp: data.timestamp
        }, ...prev].slice(0, 10));
        break;
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Format currency
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

  // Format percentage
  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  return (
    <div className="realtime-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>ULTRA Trading Dashboard</h1>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* System Status Bar */}
      <div className={`system-status-bar status-${systemStatus}`}>
        System Status: {systemStatus.toUpperCase()}
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Daily P&L</h3>
          <div className={`metric-value ${performance.dailyPnL >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(performance.dailyPnL)}
          </div>
          <div className="metric-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${Math.min(100, performance.targetProgress)}%` }}
              />
            </div>
            <span>{performance.targetProgress.toFixed(1)}% of target</span>
          </div>
        </div>

        <div className="metric-card">
          <h3>Trades Today</h3>
          <div className="metric-value">{performance.totalTrades}</div>
          <div className="metric-details">
            <span className="positive">{performance.winningTrades} wins</span>
            <span className="negative">{performance.losingTrades} losses</span>
          </div>
        </div>

        <div className="metric-card">
          <h3>Open Positions</h3>
          <div className="metric-value">{positions.length}</div>
          <div className="metric-details">
            Total Value: {formatCurrency(positions.reduce((sum, p) => sum + p.market_value, 0))}
          </div>
        </div>

        <div className="metric-card">
          <h3>Drawdown</h3>
          <div className={`metric-value ${performance.currentDrawdown > 5 ? 'negative' : ''}`}>
            {performance.currentDrawdown.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="content-grid">
        {/* Positions */}
        <div className="content-card">
          <h2>Open Positions</h2>
          <div className="positions-table">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Value</th>
                  <th>P&L</th>
                  <th>P&L %</th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">No open positions</td>
                  </tr>
                ) : (
                  positions.map((position, index) => (
                    <tr key={`${position.symbol}-${index}`}>
                      <td className="symbol">{position.symbol}</td>
                      <td className={position.side}>{position.side.toUpperCase()}</td>
                      <td>{position.qty}</td>
                      <td>{formatCurrency(position.market_value)}</td>
                      <td className={position.unrealized_pl >= 0 ? 'positive' : 'negative'}>
                        {formatCurrency(position.unrealized_pl)}
                      </td>
                      <td className={position.unrealized_plpc >= 0 ? 'positive' : 'negative'}>
                        {formatPercent(position.unrealized_plpc)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="content-card">
          <h2>Recent Orders</h2>
          <div className="orders-list">
            {recentOrders.length === 0 ? (
              <div className="empty-state">No recent orders</div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="order-item">
                  <div className="order-header">
                    <span className="symbol">{order.symbol}</span>
                    <span className={`order-side ${order.side}`}>{order.side.toUpperCase()}</span>
                    <span className="order-qty">{order.qty} shares</span>
                  </div>
                  <div className="order-details">
                    <span className={`order-status status-${order.status}`}>{order.status}</span>
                    {order.filled_qty && (
                      <span>Filled: {order.filled_qty} @ {formatCurrency(order.filled_avg_price || 0)}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Agents Status */}
        <div className="content-card">
          <h2>AI Agents</h2>
          <div className="agents-grid">
            {Object.values(agentStatuses).map((agent) => (
              <div key={agent.agent} className={`agent-card status-${agent.status}`}>
                <div className="agent-name">{agent.agent}</div>
                <div className="agent-status">{agent.status}</div>
                {agent.details && (
                  <div className="agent-details">{JSON.stringify(agent.details)}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="content-card">
          <h2>Alerts & Notifications</h2>
          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="empty-state">No recent alerts</div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className={`alert-item severity-${alert.severity}`}>
                  <span className="alert-time">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="alert-message">{alert.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .realtime-dashboard {
          padding: 20px;
          background-color: #0a0a0a;
          color: #e0e0e0;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .dashboard-header h1 {
          color: #00ff88;
          margin: 0;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-indicator.connected {
          background-color: #00ff88;
        }

        .status-indicator.disconnected {
          background-color: #ff4444;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .system-status-bar {
          padding: 10px;
          text-align: center;
          font-weight: bold;
          margin-bottom: 20px;
          border-radius: 4px;
        }

        .system-status-bar.status-online {
          background-color: #00ff8833;
          color: #00ff88;
        }

        .system-status-bar.status-offline {
          background-color: #ff444433;
          color: #ff4444;
        }

        .system-status-bar.status-degraded {
          background-color: #ffaa0033;
          color: #ffaa00;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .metric-card {
          background-color: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
        }

        .metric-card h3 {
          margin: 0 0 10px 0;
          color: #999;
          font-size: 14px;
          text-transform: uppercase;
        }

        .metric-value {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .metric-value.positive {
          color: #00ff88;
        }

        .metric-value.negative {
          color: #ff4444;
        }

        .metric-progress {
          margin-top: 10px;
        }

        .progress-bar {
          height: 6px;
          background-color: #333;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 5px;
        }

        .progress-fill {
          height: 100%;
          background-color: #00ff88;
          transition: width 0.3s ease;
        }

        .metric-details {
          display: flex;
          gap: 20px;
          font-size: 14px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 20px;
        }

        .content-card {
          background-color: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
        }

        .content-card h2 {
          margin: 0 0 20px 0;
          color: #00ff88;
          font-size: 18px;
        }

        .positions-table {
          overflow-x: auto;
        }

        .positions-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .positions-table th {
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid #333;
          color: #999;
          font-weight: normal;
          font-size: 14px;
        }

        .positions-table td {
          padding: 10px;
          border-bottom: 1px solid #222;
        }

        .positions-table .symbol {
          font-weight: bold;
          color: #00ff88;
        }

        .positions-table .long {
          color: #00ff88;
        }

        .positions-table .short {
          color: #ff4444;
        }

        .orders-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .order-item {
          padding: 12px;
          border: 1px solid #333;
          border-radius: 4px;
          margin-bottom: 10px;
        }

        .order-header {
          display: flex;
          gap: 15px;
          margin-bottom: 8px;
        }

        .order-side.buy {
          color: #00ff88;
        }

        .order-side.sell {
          color: #ff4444;
        }

        .order-details {
          display: flex;
          gap: 15px;
          font-size: 14px;
          color: #999;
        }

        .order-status {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .order-status.status-filled {
          background-color: #00ff8833;
          color: #00ff88;
        }

        .order-status.status-pending {
          background-color: #ffaa0033;
          color: #ffaa00;
        }

        .agents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }

        .agent-card {
          padding: 15px;
          border: 1px solid #333;
          border-radius: 4px;
          text-align: center;
        }

        .agent-card.status-analyzing {
          border-color: #00ff88;
          background-color: #00ff8811;
        }

        .agent-card.status-executing {
          border-color: #ffaa00;
          background-color: #ffaa0011;
        }

        .agent-card.status-error {
          border-color: #ff4444;
          background-color: #ff444411;
        }

        .agent-name {
          font-weight: bold;
          margin-bottom: 5px;
        }

        .agent-status {
          font-size: 14px;
          color: #999;
        }

        .alerts-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .alert-item {
          display: flex;
          gap: 15px;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .alert-item.severity-info {
          background-color: #00ff8811;
          border-left: 4px solid #00ff88;
        }

        .alert-item.severity-warning {
          background-color: #ffaa0011;
          border-left: 4px solid #ffaa00;
        }

        .alert-item.severity-error,
        .alert-item.severity-critical {
          background-color: #ff444411;
          border-left: 4px solid #ff4444;
        }

        .alert-time {
          color: #666;
          flex-shrink: 0;
        }

        .empty-state {
          text-align: center;
          color: #666;
          padding: 40px;
        }
      `}</style>
    </div>
  );
};