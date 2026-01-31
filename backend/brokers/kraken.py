"""
Kraken broker - fetches real OHLC data from Kraken public API.
"""
import httpx
from typing import List, Dict, Any, Optional
from brokers.base import BrokerBase
from core.candle import Candle


class KrakenBroker(BrokerBase):
    """
    Kraken broker implementation.

    Fetches real market data from Kraken public API.
    No API keys required for public endpoints.

    Note: Kraken returns max 720 candles per request.
    Uses XXBTZUSD, XETHZUSD etc. - maps common symbols (BTCUSDT, ETHUSDT) automatically.
    """

    BASE_URL = "https://api.kraken.com/0/public"

    def __init__(self):
        """Initialize the Kraken broker."""
        self.name = "kraken"

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
    ) -> List[Candle]:
        """
        Fetch OHLC data from Kraken API.

        Args:
            symbol: Trading symbol (e.g., "BTCUSDT", "ETHUSDT", or Kraken format "XXBTZUSD")
            interval: Time interval (e.g., "1m", "5m", "1h", "1d")
            limit: Number of candles to return (default: 500, max: 720 for Kraken)
            start_time: Start timestamp in milliseconds (optional)
            end_time: End timestamp in milliseconds (optional)

        Returns:
            List of Candle objects with normalized format
        """
        # Default limit (Kraken max is 720)
        if limit is None:
            limit = 500
        elif limit > 720:
            limit = 720

        # Convert symbol to Kraken format
        kraken_pair = self._to_kraken_pair(symbol)

        # Convert interval to Kraken format (minutes)
        kraken_interval = self._normalize_interval(interval)

        params: Dict[str, Any] = {
            "pair": kraken_pair,
            "interval": kraken_interval,
        }

        # Kraken uses 'since' in seconds
        if start_time:
            params["since"] = start_time // 1000

        try:
            url = f"{self.BASE_URL}/OHLC"
            with httpx.Client(timeout=15.0) as client:
                response = client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

            # Check for API errors
            if data.get("error") and data["error"]:
                raise Exception(f"Kraken API error: {', '.join(data['error'])}")

            result = data.get("result", {})
            # Kraken returns data under the pair key (which may differ slightly, e.g. XXBTZUSD)
            pair_key = kraken_pair
            if pair_key not in result:
                # Find the first key that's not 'last'
                for key in result:
                    if key != "last" and isinstance(result[key], list):
                        pair_key = key
                        break
                else:
                    raise Exception("No OHLC data in Kraken response")

            raw_candles = result.get(pair_key, [])
            if not raw_candles:
                return []

            # Convert to Candle format
            # Kraken format: [time, open, high, low, close, vwap, volume, count]
            candles = []
            for candle in raw_candles[-limit:]:  # Take last 'limit' candles
                candles.append(Candle(
                    timestamp=int(candle[0]) * 1000,  # Kraken uses seconds, we need ms
                    open=float(candle[1]),
                    high=float(candle[2]),
                    low=float(candle[3]),
                    close=float(candle[4]),
                    volume=float(candle[6])  # Volume is at index 6
                ))

            return candles

        except httpx.HTTPStatusError as e:
            raise Exception(f"Kraken API error: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            raise Exception(f"Network error connecting to Kraken: {str(e)}")
        except Exception as e:
            raise Exception(f"Error fetching Kraken data: {str(e)}")

    def place_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        price: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Place a trading order (not implemented - requires authentication).
        """
        raise NotImplementedError(
            "Order placement requires Kraken API keys and authentication. "
            "This feature is not implemented for the public endpoint."
        )

    def _to_kraken_pair(self, symbol: str) -> str:
        """
        Convert common symbol format (BTCUSDT) to Kraken pair format (XXBTZUSD).
        """
        symbol_upper = symbol.upper()
        # Map common Binance-style symbols to Kraken pairs (USD pairs - most liquid)
        symbol_map = {
            "BTCUSDT": "XXBTZUSD",
            "BTCUSD": "XXBTZUSD",
            "ETHUSDT": "XETHZUSD",
            "ETHUSD": "XETHZUSD",
            "SOLUSDT": "SOLUSD",
            "SOLUSD": "SOLUSD",
            "ADAUSDT": "ADAUSD",
            "ADAUSD": "ADAUSD",
            "XRPUSDT": "XXRPZUSD",
            "XRPUSD": "XXRPZUSD",
            "DOGEUSDT": "XDGUSD",
            "DOGEUSD": "XDGUSD",
            "AVAXUSDT": "AVAXUSD",
            "AVAXUSD": "AVAXUSD",
            "LINKUSDT": "LINKUSD",
            "LINKUSD": "LINKUSD",
            "DOTUSDT": "DOTUSD",
            "DOTUSD": "DOTUSD",
            "MATICUSDT": "MATICUSD",
            "MATICUSD": "MATICUSD",
            "UNIUSDT": "UNIUSD",
            "UNIUSD": "UNIUSD",
            "ATOMUSDT": "ATOMUSD",
            "ATOMUSD": "ATOMUSD",
            "BNBUSDT": "BNBUSD",
            "BNBUSD": "BNBUSD",
        }
        return symbol_map.get(symbol_upper, symbol_upper)

    def _normalize_interval(self, interval: str) -> int:
        """
        Normalize interval to Kraken format (minutes).
        Kraken supports: 1, 5, 15, 30, 60, 240, 1440, 10080, 21600
        Unsupported intervals map to nearest valid (e.g. 2h -> 1h).
        """
        interval_map = {
            "1m": 1,
            "5m": 5,
            "15m": 15,
            "30m": 30,
            "1h": 60,
            "2h": 60,    # Kraken doesn't support 120, use 1h
            "4h": 240,
            "6h": 240,   # Use 4h as nearest
            "8h": 240,
            "12h": 1440, # Use 1d as nearest
            "1d": 1440,
            "3d": 1440,  # Use 1d as nearest
            "1w": 10080,
            "1M": 21600, # Kraken 21600 = 15 days (nearest to monthly)
        }
        interval_lower = interval.lower()
        return interval_map.get(interval_lower, interval_map.get(interval, 60))
