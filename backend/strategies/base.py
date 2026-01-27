"""
Base strategy class that all strategies must inherit from.
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from core.candle import Candle
from brokers.base import BrokerBase


class BaseStrategy(ABC):
    """
    Abstract base class for all trading strategies.
    
    All user-uploaded strategies must inherit from this class
    and implement the required methods.
    """
    
    def __init__(self, broker: BrokerBase):
        """
        Initialize strategy with a broker instance.
        
        Args:
            broker: Broker instance for fetching data and placing orders
        """
        self.broker = broker
        self.initialized = False
    
    @abstractmethod
    def initialize(self):
        """
        Initialize strategy - called once before processing candles.
        
        Use this to:
        - Set up indicators
        - Initialize variables
        - Configure strategy parameters
        """
        pass
    
    @abstractmethod
    def on_candle(self, candle: Candle) -> Optional[Dict[str, Any]]:
        """
        Called for each new candle.
        
        Args:
            candle: Current candle data
            
        Returns:
            Optional dictionary with order details if trade should be placed:
            {
                "action": "BUY" or "SELL",
                "quantity": float,
                "price": float or None (for market orders),
                "order_type": "MARKET" or "LIMIT",
                "stop_loss": float (optional),
                "take_profit": float (optional)
            }
            Returns None if no trade should be placed
        """
        pass
    
    def get_name(self) -> str:
        """
        Get strategy name (defaults to class name).
        
        Returns:
            Strategy name
        """
        return self.__class__.__name__
