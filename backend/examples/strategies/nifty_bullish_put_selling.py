"""
Nifty Bullish Put Selling Strategy (Modified) - Spot/Index adaptation.

Adapted from the options strategy: sell ITM puts when Nifty drops 100 pts from 9:30 AM,
scale in every 40 pts drop (max 10 lots), book profit when price recovers 40 pts per lot.

This version uses underlying price (candle OHLC) with no options; logic is equivalent:
- Reference = open of first candle of each day (9:30 AM equivalent; no data leakage).
- Trigger: price drops trigger_drop points from reference -> first LONG entry.
- Scale in: every scale_step points below last entry, add another lot (max max_lots).
- Exit: take_profit = entry + profit_target points per lot (engine closes when hit).
"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict, List

# One day in milliseconds (for session detection)
MS_PER_DAY = 24 * 60 * 60 * 1000


class NiftyBullishPutSellingStrategy(BaseStrategy):
    """
    Bullish put-selling style: enter LONG when price drops from session open,
    scale in on further drops, exit each lot at fixed profit target.
    """

    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        # Strategy parameters (points; configurable for Nifty ~16000 or index scale)
        self.trigger_drop = self.config.get("trigger_drop", 100)
        self.scale_step = self.config.get("scale_step", 40)
        self.profit_target = self.config.get("profit_target", 40)
        self.max_lots = self.config.get("max_lots", 10)
        self.lot_quantity = self.config.get("lot_quantity", 0.01)

        # Session state (no data leakage: reference set only from current candle open)
        self._reference_price: Optional[float] = None
        self._reference_date: Optional[int] = None
        self._triggered = False
        self._entries_this_chain: List[float] = []

    def initialize(self):
        self.initialized = True

    def _current_date(self, timestamp: int) -> int:
        """Date bucket (day) from timestamp - for session boundary only."""
        return timestamp // MS_PER_DAY

    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()

        today = self._current_date(candle.timestamp)

        # 1) Set reference only at start of each new day (9:30 AM equivalent).
        #    Use OPEN of first candle of that day - no future data.
        if self._reference_date is None or today != self._reference_date:
            self._reference_price = candle.open
            self._reference_date = today
            self._triggered = False
            self._entries_this_chain = []

        ref = self._reference_price
        if ref is None:
            return None

        # 2) Trigger: price has dropped trigger_drop points from reference.
        #    Use current candle CLOSE only (no lookahead).
        if not self._triggered:
            if candle.close <= ref - self.trigger_drop:
                self._triggered = True
                self._entries_this_chain.append(candle.close)
                return self._make_order(candle.close, "TRIGGER_ENTRY")

        # 3) Scale in: for every scale_step below last entry, add one lot (max max_lots).
        #    Use current candle LOW to see if level was hit (standard intra-candle check).
        if self._triggered and len(self._entries_this_chain) < self.max_lots:
            last_entry = self._entries_this_chain[-1]
            next_level = last_entry - self.scale_step
            if candle.low <= next_level:
                # Add one lot at current close (market execution at end of candle)
                self._entries_this_chain.append(candle.close)
                return self._make_order(candle.close, "SCALE_IN")

        return None

    def _make_order(self, entry_price: float, exit_reason: str) -> Dict:
        """Single LONG order with take_profit = entry + profit_target (no stop for this strategy)."""
        take_profit_price = entry_price + self.profit_target
        return {
            "action": "BUY",
            "quantity": self.lot_quantity,
            "order_type": "MARKET",
            "price": None,
            "take_profit": take_profit_price,
            "exit_reason": exit_reason,
        }
