"""
Paper trading broker - simulated broker for testing.
Returns dummy/mock OHLC data without making real API calls.
"""
import time
import random
from typing import List, Dict, Any, Optional
from brokers.base import BrokerBase


class PaperBroker(BrokerBase):
    """
    Paper trading broker - a fake broker for testing and development.
    
    This broker generates dummy OHLC data without making real API calls.
    Useful for:
    - Development and testing
    - Strategy development without real market data
    - Backtesting with controlled data
    """
    
    def __init__(self):
        """Initialize the paper broker."""
        self.name = "paper"
    
    def get_name(self) -> str:
        """Get the broker name."""
        return self.name
    
    def get_ohlc(
        self,
        symbol: str,
        interval: str,
        limit: Optional[int] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate dummy OHLC data.
        
        Args:
            symbol: Trading symbol (e.g., "BTCUSDT")
            interval: Time interval (e.g., "1h", "1d")
            limit: Number of candles to generate (default: 100)
            start_time: Start timestamp (optional, not used in paper broker)
            end_time: End timestamp (optional, not used in paper broker)
            
        Returns:
            List of dummy candle dictionaries
        """
        # Default to 100 candles if limit not specified
        if limit is None:
            limit = 100
        
        # Parse interval to milliseconds
        interval_ms = self._parse_interval(interval)
        
        # Generate dummy candles
        candles = []
        base_price = 50000.0  # Base price for dummy data
        current_time = int(time.time() * 1000)  # Current time in milliseconds
        
        for i in range(limit):
            # Generate timestamp (going backwards from current time)
            timestamp = current_time - (limit - i - 1) * interval_ms
            
            # Generate random price movement
            # Start from base_price and add some random walk
            price_change = random.uniform(-0.02, 0.02)  # ±2% change
            base_price = base_price * (1 + price_change)
            
            # Generate OHLC values
            open_price = base_price
            close_price = open_price * random.uniform(0.98, 1.02)
            high_price = max(open_price, close_price) * random.uniform(1.0, 1.01)
            low_price = min(open_price, close_price) * random.uniform(0.99, 1.0)
            volume = random.uniform(100, 1000)
            
            candle = {
                "timestamp": timestamp,
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2),
                "volume": round(volume, 2)
            }
            
            candles.append(candle)
            base_price = close_price  # Next candle starts where this one closed
        
        return candles
    
    def place_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        price: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Simulate placing an order (paper trading).
        
        Args:
            symbol: Trading symbol
            side: "BUY" or "SELL"
            order_type: "MARKET" or "LIMIT"
            quantity: Order quantity
            price: Limit price (required for LIMIT orders)
            
        Returns:
            Simulated order response
        """
        # Generate a fake order ID
        order_id = f"PAPER_{int(time.time() * 1000)}"
        
        # For market orders, use a simulated price
        if order_type.upper() == "MARKET":
            # Simulate getting current market price
            simulated_price = random.uniform(49000, 51000)
        else:
            # For limit orders, use provided price
            if price is None:
                raise ValueError("Price is required for LIMIT orders")
            simulated_price = price
        
        return {
            "order_id": order_id,
            "symbol": symbol,
            "side": side.upper(),
            "order_type": order_type.upper(),
            "status": "FILLED",
            "filled_quantity": quantity,
            "price": round(simulated_price, 2),
            "broker": "paper"
        }
    
    def _parse_interval(self, interval: str) -> int:
        """
        Parse interval string to milliseconds.
        
        Args:
            interval: Interval string (e.g., "1m", "5m", "1h", "1d")
            
        Returns:
            Interval in milliseconds
        """
        interval_map = {
            "1m": 60 * 1000,
            "5m": 5 * 60 * 1000,
            "15m": 15 * 60 * 1000,
            "30m": 30 * 60 * 1000,
            "1h": 60 * 60 * 1000,
            "4h": 4 * 60 * 60 * 1000,
            "1d": 24 * 60 * 60 * 1000,
        }
        
        # Try to parse custom intervals like "1h", "5m", etc.
        if interval in interval_map:
            return interval_map[interval]
        
        # Try to parse numeric intervals
        try:
            if interval.endswith("m"):
                minutes = int(interval[:-1])
                return minutes * 60 * 1000
            elif interval.endswith("h"):
                hours = int(interval[:-1])
                return hours * 60 * 60 * 1000
            elif interval.endswith("d"):
                days = int(interval[:-1])
                return days * 24 * 60 * 60 * 1000
        except ValueError:
            pass
        
        # Default to 1 hour if parsing fails
        return 60 * 60 * 1000
