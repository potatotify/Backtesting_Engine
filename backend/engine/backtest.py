"""
Backtesting engine - executes strategies on historical data.
"""
from typing import List, Dict, Any, Optional
from core.candle import Candle
from strategies.base import BaseStrategy
from strategies.loader import StrategyLoader
from brokers.base import BrokerBase
from brokers.factory import BrokerFactory
from engine.position import Position
import math


class BacktestingEngine:
    """
    Backtesting engine that executes strategies on historical candles.
    """
    
    def __init__(self, initial_capital: float = 10000.0):
        """
        Initialize backtesting engine.
        
        Args:
            initial_capital: Starting capital for backtest
        """
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.positions: List[Position] = []
        self.closed_trades: List[Dict[str, Any]] = []
        self.equity_curve: List[float] = []
    
    def run_backtest(
        self,
        strategy_code: str,
        class_name: str,
        broker_name: str,
        symbol: str,
        interval: str,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Run backtest on historical data.
        
        Args:
            strategy_code: Python code string for strategy
            class_name: Name of strategy class
            broker_name: Broker name (e.g., "binance")
            symbol: Trading symbol
            interval: Time interval
            start_time: Start timestamp (optional)
            end_time: End timestamp (optional)
            limit: Maximum candles (optional)
            
        Returns:
            Dictionary with backtest results and metrics
        """
        # Reset state
        self.capital = self.initial_capital
        self.positions = []
        self.closed_trades = []
        self.equity_curve = [self.initial_capital]
        
        # Create broker instance
        broker = BrokerFactory.create_broker(broker_name)
        
        # Fetch historical data
        candles = broker.get_ohlc(
            symbol=symbol,
            interval=interval,
            limit=limit,
            start_time=start_time,
            end_time=end_time
        )
        
        if not candles:
            raise ValueError("No historical data available for backtest")
        
        # Load and instantiate strategy
        strategy = StrategyLoader.create_strategy_instance(
            code=strategy_code,
            class_name=class_name,
            broker=broker
        )
        
        # Initialize strategy
        strategy.initialize()
        
        # Process each candle
        for candle in candles:
            self._process_candle(strategy, candle)
        
        # Close any remaining positions at the end
        for position in self.positions[:]:
            exit_price = candles[-1].close
            self._close_position(position, exit_price, "END_OF_BACKTEST", candles[-1].timestamp)
        
        # Calculate metrics
        metrics = self._calculate_metrics()
        
        return {
            "initial_capital": self.initial_capital,
            "final_capital": self.capital,
            "metrics": metrics,
            "trades": self.closed_trades,
            "equity_curve": self.equity_curve,
            "total_trades": len(self.closed_trades),
            "winning_trades": sum(1 for t in self.closed_trades if t["pnl"] > 0),
            "losing_trades": sum(1 for t in self.closed_trades if t["pnl"] <= 0)
        }
    
    def _process_candle(self, strategy: BaseStrategy, candle: Candle):
        """
        Process a single candle through the strategy.
        
        Args:
            strategy: Strategy instance
            candle: Current candle
        """
        # Update positions (check stop loss, take profit, trailing stops)
        for position in self.positions[:]:
            position.increment_candles_held()
            
            # Update trailing stop
            if position.trailing_stop:
                position.update_trailing_stop(candle)
            
            # Check stop loss
            if position.check_stop_loss(candle):
                exit_price = position.stop_loss
                self._close_position(position, exit_price, "STOP_LOSS", candle.timestamp)
                continue
            
            # Check take profit
            if position.check_take_profit(candle):
                exit_price = position.take_profit
                self._close_position(position, exit_price, "TAKE_PROFIT", candle.timestamp)
                continue
        
        # Get strategy signal
        order = strategy.on_candle(candle)
        
        if order:
            self._execute_order(order, candle)
        
        # Update equity curve
        self._update_equity_curve(candle)
    
    def _execute_order(self, order: Dict[str, Any], candle: Candle):
        """
        Execute an order (simulated).
        
        Args:
            order: Order dictionary from strategy
            candle: Current candle
        """
        action = order.get("action", "").upper()
        quantity = order.get("quantity", 0)
        order_type = order.get("order_type", "MARKET").upper()
        price = order.get("price")
        stop_loss = order.get("stop_loss")
        take_profit = order.get("take_profit")
        trailing_stop = order.get("trailing_stop")
        
        if action == "BUY":
            # Determine fill price
            if order_type == "MARKET" or price is None:
                fill_price = candle.close
            else:  # LIMIT order
                # Fill if limit price is touched during candle
                if candle.low <= price <= candle.high:
                    fill_price = price
                else:
                    return  # Order not filled
            
            # Check if we have enough capital
            cost = fill_price * quantity
            if cost > self.capital:
                return  # Insufficient capital
            
            # Open LONG position
            position = Position(
                side="LONG",
                entry_price=fill_price,
                quantity=quantity,
                entry_time=candle.timestamp,
                stop_loss=stop_loss,
                take_profit=take_profit,
                trailing_stop=trailing_stop
            )
            self.positions.append(position)
            self.capital -= cost
        
        elif action == "SELL":
            # Check if we have a position to close
            if not self.positions:
                return
            
            # Find LONG position to close (FIFO - first in, first out)
            position = None
            for pos in self.positions:
                if pos.side == "LONG":
                    position = pos
                    break
            
            # If no LONG position found, ignore SELL order
            if position is None:
                return
            
            # Determine fill price
            if order_type == "MARKET" or price is None:
                fill_price = candle.close
            else:  # LIMIT order
                if candle.low <= price <= candle.high:
                    fill_price = price
                else:
                    return  # Order not filled
            
            # Close position
            exit_reason = order.get("exit_reason", "STRATEGY_SIGNAL")
            self._close_position(position, fill_price, exit_reason, candle.timestamp)
    
    def _close_position(
        self,
        position: Position,
        exit_price: float,
        exit_reason: str,
        exit_time: int
    ):
        """
        Close a position and record the trade.
        
        Args:
            position: Position to close
            exit_price: Exit price
            exit_reason: Reason for exit
            exit_time: Exit timestamp
        """
        if position not in self.positions:
            return
        
        # Calculate P&L
        pnl = position.calculate_realized_pnl(exit_price)
        self.capital += (exit_price * position.quantity)  # Return capital
        
        # Record trade
        trade = {
            "entry_time": position.entry_time,
            "exit_time": exit_time,
            "side": position.side,
            "entry_price": position.entry_price,
            "exit_price": exit_price,
            "quantity": position.quantity,
            "pnl": pnl,
            "return_pct": (pnl / (position.entry_price * position.quantity)) * 100,
            "exit_reason": exit_reason,
            "candles_held": position.candles_held
        }
        
        self.closed_trades.append(trade)
        self.positions.remove(position)
    
    def _update_equity_curve(self, candle: Candle):
        """
        Update equity curve with current capital + unrealized P&L.
        
        Args:
            candle: Current candle
        """
        unrealized_pnl = sum(
            pos.calculate_unrealized_pnl(candle.close)
            for pos in self.positions
        )
        equity = self.capital + unrealized_pnl
        self.equity_curve.append(equity)
    
    def _calculate_metrics(self) -> Dict[str, float]:
        """
        Calculate performance metrics.
        
        Returns:
            Dictionary with performance metrics
        """
        if not self.closed_trades:
            return {
                "total_return": 0.0,
                "sharpe_ratio": 0.0,
                "max_drawdown": 0.0,
                "win_rate": 0.0,
                "avg_win": 0.0,
                "avg_loss": 0.0,
                "profit_factor": 0.0
            }
        
        # Total return
        total_return = (self.capital - self.initial_capital) / self.initial_capital
        
        # Win rate
        winning_trades = [t for t in self.closed_trades if t["pnl"] > 0]
        losing_trades = [t for t in self.closed_trades if t["pnl"] <= 0]
        win_rate = len(winning_trades) / len(self.closed_trades) if self.closed_trades else 0.0
        
        # Average win/loss
        avg_win = sum(t["pnl"] for t in winning_trades) / len(winning_trades) if winning_trades else 0.0
        avg_loss = abs(sum(t["pnl"] for t in losing_trades) / len(losing_trades)) if losing_trades else 0.0
        
        # Profit factor
        total_profit = sum(t["pnl"] for t in winning_trades) if winning_trades else 0.0
        total_loss = abs(sum(t["pnl"] for t in losing_trades)) if losing_trades else 0.0
        profit_factor = total_profit / total_loss if total_loss > 0 else 0.0
        
        # Sharpe ratio (simplified - using returns)
        returns = [(self.equity_curve[i] - self.equity_curve[i-1]) / self.equity_curve[i-1]
                   for i in range(1, len(self.equity_curve)) if self.equity_curve[i-1] > 0]
        
        if returns:
            avg_return = sum(returns) / len(returns)
            variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
            std_dev = math.sqrt(variance) if variance > 0 else 0.0
            sharpe_ratio = (avg_return / std_dev) * math.sqrt(252) if std_dev > 0 else 0.0
        else:
            sharpe_ratio = 0.0
        
        # Max drawdown
        max_drawdown = self._calculate_max_drawdown()
        
        return {
            "total_return": total_return,
            "sharpe_ratio": sharpe_ratio,
            "max_drawdown": max_drawdown,
            "win_rate": win_rate,
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "profit_factor": profit_factor
        }
    
    def _calculate_max_drawdown(self) -> float:
        """
        Calculate maximum drawdown from equity curve.
        
        Returns:
            Maximum drawdown as decimal (e.g., -0.08 for -8%)
        """
        if len(self.equity_curve) < 2:
            return 0.0
        
        peak = self.equity_curve[0]
        max_dd = 0.0
        
        for equity in self.equity_curve[1:]:
            if equity > peak:
                peak = equity
            else:
                dd = (equity - peak) / peak
                if dd < max_dd:
                    max_dd = dd
        
        return max_dd
