# Strategy Testing Guide - Complete Workflow

This guide walks you through testing the complete strategy backtesting workflow using Postman.

## Prerequisites

1. Backend server running on `http://localhost:8000`
2. Postman installed
3. Sample strategies (we'll provide examples)

---

## Step 1: Register a User

**Endpoint:** `POST http://localhost:8000/auth/register`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "trader@example.com",
  "password": "SecurePassword123!"
}
```

**Expected Response:**
```json
{
  "id": 1,
  "email": "trader@example.com",
  "is_active": true,
  "created_at": "2026-01-27T12:00:00",
  "updated_at": "2026-01-27T12:00:00"
}
```

---

## Step 2: Login and Get JWT Token

**Endpoint:** `POST http://localhost:8000/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "trader@example.com",
  "password": "SecurePassword123!"
}
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Save the `access_token` - you'll need it for all subsequent requests!**

---

## Step 3: Verify Broker Data is Available

**Endpoint:** `GET http://localhost:8000/brokers/available`

**No authentication required**

**Expected Response:**
```json
{
  "brokers": ["binance"],
  "count": 1
}
```

**Test fetching OHLC data:**

**Endpoint:** `GET http://localhost:8000/brokers/ohlc?broker=binance&symbol=BTCUSDT&interval=1h&limit=10`

**Expected Response:**
```json
{
  "broker": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "candles": [
    {
      "timestamp": 1706284800000,
      "open": 43250.50,
      "high": 43500.00,
      "low": 43100.00,
      "close": 43350.75,
      "volume": 1234.56
    },
    ...
  ],
  "count": 10
}
```

---

## Step 4: Prepare Your Strategy

### Strategy Format Requirements

Your strategy **MUST** follow this format:

1. **Inherit from `BaseStrategy`**
2. **Implement `initialize()` method**
3. **Implement `on_candle(candle)` method**
4. **Return order dictionary or `None`**

### Example Strategy Template

Here's a simple Moving Average Crossover strategy:

```python
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class MACrossoverStrategy(BaseStrategy):
    """
    Simple Moving Average Crossover Strategy
    
    Entry: Fast MA crosses above Slow MA
    Exit: Fast MA crosses below Slow MA OR stop loss/take profit
    """
    
    def __init__(self, broker):
        super().__init__(broker)
        
        # Configuration
        self.fast_period = 10
        self.slow_period = 20
        self.quantity = 0.001
        self.stop_loss_pct = 0.02  # 2%
        self.take_profit_pct = 0.05  # 5%
        
        # Data storage
        self.price_history = []
        self.fast_ma = []
        self.slow_ma = []
        self.position = None
        self.entry_price = None
        
        self.initialized = False
    
    def initialize(self):
        """Initialize strategy."""
        self.initialized = True
    
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        """Main strategy logic."""
        if not self.initialized:
            self.initialize()
        
        # Update price history
        self.price_history.append(candle.close)
        
        # Keep only last 100 prices
        if len(self.price_history) > 100:
            self.price_history.pop(0)
        
        # Calculate MAs if we have enough data
        if len(self.price_history) >= self.slow_period:
            # Calculate SMAs
            fast_ma = sum(self.price_history[-self.fast_period:]) / self.fast_period
            slow_ma = sum(self.price_history[-self.slow_period:]) / self.slow_period
            
            self.fast_ma.append(fast_ma)
            self.slow_ma.append(slow_ma)
            
            # Keep only last 50 MA values
            if len(self.fast_ma) > 50:
                self.fast_ma.pop(0)
                self.slow_ma.pop(0)
            
            # Check exit first (if we have a position)
            if self.position == "LONG":
                # Stop loss
                if candle.low <= self.entry_price * (1 - self.stop_loss_pct):
                    self.position = None
                    return {
                        "action": "SELL",
                        "quantity": self.quantity,
                        "price": None,
                        "order_type": "MARKET",
                        "exit_reason": "STOP_LOSS"
                    }
                
                # Take profit
                if candle.high >= self.entry_price * (1 + self.take_profit_pct):
                    self.position = None
                    return {
                        "action": "SELL",
                        "quantity": self.quantity,
                        "price": None,
                        "order_type": "MARKET",
                        "exit_reason": "TAKE_PROFIT"
                    }
                
                # MA crossover exit
                if len(self.fast_ma) >= 2 and len(self.slow_ma) >= 2:
                    # Fast MA crosses below Slow MA
                    if self.fast_ma[-2] >= self.slow_ma[-2] and self.fast_ma[-1] < self.slow_ma[-1]:
                        self.position = None
                        return {
                            "action": "SELL",
                            "quantity": self.quantity,
                            "price": None,
                            "order_type": "MARKET",
                            "exit_reason": "MA_CROSSOVER"
                        }
            
            # Check entry (if we don't have a position)
            if self.position is None and len(self.fast_ma) >= 2 and len(self.slow_ma) >= 2:
                # Fast MA crosses above Slow MA
                if self.fast_ma[-2] <= self.slow_ma[-2] and self.fast_ma[-1] > self.slow_ma[-1]:
                    self.position = "LONG"
                    self.entry_price = candle.close
                    return {
                        "action": "BUY",
                        "quantity": self.quantity,
                        "price": None,
                        "order_type": "MARKET",
                        "stop_loss": self.entry_price * (1 - self.stop_loss_pct),
                        "take_profit": self.entry_price * (1 + self.take_profit_pct)
                    }
        
        return None
```

### Converting Open Source Strategies

If you have a strategy from an open source platform, you need to:

1. **Wrap it in a class** that inherits from `BaseStrategy`
2. **Replace their data fetching** with `self.broker.get_ohlc()` (if needed)
3. **Convert their order format** to our standard format:
   ```python
   {
       "action": "BUY" or "SELL",
       "quantity": float,
       "price": float or None,
       "order_type": "MARKET" or "LIMIT",
       "stop_loss": float (optional),
       "take_profit": float (optional),
       "exit_reason": str (optional, for SELL orders)
   }
   ```
4. **Use our indicators** from `strategies.indicators` instead of their libraries
5. **Process candles sequentially** in `on_candle()` method

---

## Step 5: Upload Strategy

**Endpoint:** `POST http://localhost:8000/strategies/upload`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your_access_token>
```

**Body (JSON):**
```json
{
  "name": "MA Crossover Strategy",
  "description": "Simple moving average crossover strategy with stop loss and take profit",
  "class_name": "MACrossoverStrategy",
  "code": "from strategies.base import BaseStrategy\nfrom core.candle import Candle\nfrom typing import Optional, Dict\nfrom strategies import indicators\n\nclass MACrossoverStrategy(BaseStrategy):\n    def __init__(self, broker):\n        super().__init__(broker)\n        self.fast_period = 10\n        self.slow_period = 20\n        self.quantity = 0.001\n        self.stop_loss_pct = 0.02\n        self.take_profit_pct = 0.05\n        self.price_history = []\n        self.fast_ma = []\n        self.slow_ma = []\n        self.position = None\n        self.entry_price = None\n        self.initialized = False\n    \n    def initialize(self):\n        self.initialized = True\n    \n    def on_candle(self, candle: Candle) -> Optional[Dict]:\n        if not self.initialized:\n            self.initialize()\n        \n        self.price_history.append(candle.close)\n        if len(self.price_history) > 100:\n            self.price_history.pop(0)\n        \n        if len(self.price_history) >= self.slow_period:\n            fast_ma = sum(self.price_history[-self.fast_period:]) / self.fast_period\n            slow_ma = sum(self.price_history[-self.slow_period:]) / self.slow_period\n            \n            self.fast_ma.append(fast_ma)\n            self.slow_ma.append(slow_ma)\n            \n            if len(self.fast_ma) > 50:\n                self.fast_ma.pop(0)\n                self.slow_ma.pop(0)\n            \n            if self.position == \"LONG\":\n                if candle.low <= self.entry_price * (1 - self.stop_loss_pct):\n                    self.position = None\n                    return {\"action\": \"SELL\", \"quantity\": self.quantity, \"price\": None, \"order_type\": \"MARKET\", \"exit_reason\": \"STOP_LOSS\"}\n                \n                if candle.high >= self.entry_price * (1 + self.take_profit_pct):\n                    self.position = None\n                    return {\"action\": \"SELL\", \"quantity\": self.quantity, \"price\": None, \"order_type\": \"MARKET\", \"exit_reason\": \"TAKE_PROFIT\"}\n                \n                if len(self.fast_ma) >= 2 and len(self.slow_ma) >= 2:\n                    if self.fast_ma[-2] >= self.slow_ma[-2] and self.fast_ma[-1] < self.slow_ma[-1]:\n                        self.position = None\n                        return {\"action\": \"SELL\", \"quantity\": self.quantity, \"price\": None, \"order_type\": \"MARKET\", \"exit_reason\": \"MA_CROSSOVER\"}\n            \n            if self.position is None and len(self.fast_ma) >= 2 and len(self.slow_ma) >= 2:\n                if self.fast_ma[-2] <= self.slow_ma[-2] and self.fast_ma[-1] > self.slow_ma[-1]:\n                    self.position = \"LONG\"\n                    self.entry_price = candle.close\n                    return {\"action\": \"BUY\", \"quantity\": self.quantity, \"price\": None, \"order_type\": \"MARKET\", \"stop_loss\": self.entry_price * (1 - self.stop_loss_pct), \"take_profit\": self.entry_price * (1 + self.take_profit_pct)}\n        \n        return None"
}
```

**Note:** The `code` field should contain the **entire Python code as a string** (with `\n` for newlines).

**Expected Response:**
```json
{
  "id": 1,
  "name": "MA Crossover Strategy",
  "description": "Simple moving average crossover strategy with stop loss and take profit",
  "class_name": "MACrossoverStrategy",
  "is_active": true,
  "user_id": 1,
  "created_at": "2026-01-27T12:00:00",
  "updated_at": "2026-01-27T12:00:00"
}
```

**Save the `id` - you'll need it for running backtests!**

---

## Step 6: List Your Strategies

**Endpoint:** `GET http://localhost:8000/strategies`

**Headers:**
```
Authorization: Bearer <your_access_token>
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "name": "MA Crossover Strategy",
    "description": "Simple moving average crossover strategy with stop loss and take profit",
    "class_name": "MACrossoverStrategy",
    "is_active": true,
    "user_id": 1,
    "created_at": "2026-01-27T12:00:00",
    "updated_at": "2026-01-27T12:00:00"
  }
]
```

---

## Step 7: Run Backtest

**Endpoint:** `POST http://localhost:8000/strategies/backtest/run`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your_access_token>
```

**Body (JSON):**
```json
{
  "strategy_id": 1,
  "broker": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "limit": 500,
  "initial_capital": 10000
}
```

**Alternative with time range:**
```json
{
  "strategy_id": 1,
  "broker": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "start_time": 1704067200000,
  "end_time": 1704153600000,
  "initial_capital": 10000
}
```

**Note:** 
- `start_time` and `end_time` are timestamps in **milliseconds**
- Use `limit` OR `start_time`/`end_time`, not both
- Common intervals: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`

**Expected Response:**
```json
{
  "backtest_id": 1,
  "strategy_name": "MA Crossover Strategy",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "initial_capital": 10000,
  "final_capital": 11500.50,
  "metrics": {
    "total_return": 0.15,
    "sharpe_ratio": 1.2,
    "max_drawdown": -0.08,
    "win_rate": 0.55,
    "avg_win": 150.25,
    "avg_loss": -75.50,
    "profit_factor": 2.0
  },
  "total_trades": 20,
  "winning_trades": 11,
  "losing_trades": 9,
  "trades": [
    {
      "entry_time": 1704067200000,
      "exit_time": 1704070800000,
      "side": "LONG",
      "entry_price": 43250.50,
      "exit_price": 43800.75,
      "quantity": 0.001,
      "pnl": 0.55,
      "return_pct": 1.27,
      "exit_reason": "TAKE_PROFIT",
      "candles_held": 1
    },
    ...
  ],
  "equity_curve": [10000, 10050, 10100, ...],
  "created_at": "2026-01-27T12:00:00"
}
```

---

## Step 8: View Backtest Results

**List all backtests:**

**Endpoint:** `GET http://localhost:8000/strategies/backtest/results`

**Headers:**
```
Authorization: Bearer <your_access_token>
```

**Filter by strategy:**
```
GET http://localhost:8000/strategies/backtest/results?strategy_id=1
```

**Get specific backtest details:**

**Endpoint:** `GET http://localhost:8000/strategies/backtest/results/1`

**Headers:**
```
Authorization: Bearer <your_access_token>
```

---

## Postman Collection Setup

### 1. Create Environment Variables

In Postman, create an environment with:
- `base_url`: `http://localhost:8000`
- `access_token`: (will be set after login)

### 2. Collection Structure

```
Algo Trading Backend
├── Authentication
│   ├── Register User
│   └── Login
├── Brokers
│   ├── Get Available Brokers
│   └── Get OHLC Data
├── Strategies
│   ├── Upload Strategy
│   ├── List Strategies
│   ├── Get Strategy
│   └── Delete Strategy
└── Backtesting
    ├── Run Backtest
    ├── List Backtest Results
    └── Get Backtest Result
```

### 3. Auto-set Token Script

Add this script to your Login request (Tests tab):

```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.environment.set("access_token", jsonData.access_token);
}
```

Then use `{{access_token}}` in Authorization headers.

---

## Common Issues and Solutions

### Issue 1: Strategy Upload Fails

**Error:** `Invalid strategy code: Class 'MyStrategy' must inherit from BaseStrategy`

**Solution:** Make sure your strategy class inherits from `BaseStrategy`:
```python
class MyStrategy(BaseStrategy):
    ...
```

### Issue 2: Strategy Code Execution Error

**Error:** `Error executing strategy code: name 'indicators' is not defined`

**Solution:** Use `from strategies import indicators` in your strategy code, or use the full path `strategies.indicators.calculate_sma(...)`

### Issue 3: No Historical Data

**Error:** `No historical data available for backtest`

**Solution:** 
- Check symbol format (e.g., `BTCUSDT` not `BTC/USDT`)
- Verify interval is supported (e.g., `1h`, `1d`)
- Check if Binance API is accessible
- Try a different time range

### Issue 4: Insufficient Capital

**Symptom:** No trades executed

**Solution:** Increase `initial_capital` or decrease `quantity` in strategy

### Issue 5: Strategy Returns Wrong Format

**Error:** Backtest runs but no trades

**Solution:** Ensure `on_candle()` returns:
- `None` (no trade)
- Dictionary with required fields: `action`, `quantity`, `order_type`

---

## Testing Checklist

- [ ] User registration works
- [ ] Login returns JWT token
- [ ] Can fetch broker data (OHLC)
- [ ] Strategy uploads successfully
- [ ] Strategy validation works (catches errors)
- [ ] Backtest runs without errors
- [ ] Backtest returns metrics
- [ ] Trades are recorded correctly
- [ ] Equity curve is generated
- [ ] Results are saved to database
- [ ] Can retrieve backtest results

---

## Example: Complete Workflow

1. **Register:** `POST /auth/register`
2. **Login:** `POST /auth/login` → Save token
3. **Check Brokers:** `GET /brokers/available`
4. **Test Data:** `GET /brokers/ohlc?broker=binance&symbol=BTCUSDT&interval=1h&limit=10`
5. **Upload Strategy:** `POST /strategies/upload` → Save strategy_id
6. **Run Backtest:** `POST /strategies/backtest/run` → Save backtest_id
7. **View Results:** `GET /strategies/backtest/results/{backtest_id}`

---

## Tips for Converting Open Source Strategies

1. **Identify entry/exit logic** - Extract the core trading rules
2. **Map to our format** - Convert to `on_candle()` method
3. **Replace data sources** - Use `self.broker.get_ohlc()` if needed
4. **Use our indicators** - Replace their indicator libraries with `strategies.indicators`
5. **Test incrementally** - Start with simple logic, add complexity gradually
6. **Handle state** - Store indicators, positions in `__init__` or instance variables

---

## Next Steps

- Try different strategies
- Test with different symbols (ETHUSDT, BNBUSDT, etc.)
- Experiment with different intervals
- Compare backtest results
- Optimize strategy parameters
