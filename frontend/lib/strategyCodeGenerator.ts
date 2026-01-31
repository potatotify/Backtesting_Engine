/**
 * Strategy Code Generators - Each maps params (Record<string, unknown>) to Python code.
 * Used by strategyDefinitions.ts - add new generators here when adding strategy types.
 */

function getNum(params: Record<string, unknown>, key: string, def: number): number {
    const v = params[key];
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseFloat(v) || def;
    return def;
}

function getStr(params: Record<string, unknown>, key: string, def: string): string {
    const v = params[key];
    return (typeof v === "string" ? v : String(v ?? def)) || def;
}

export function generateMACrossover(params: Record<string, unknown>, strategyName: string): string {
    const fast = getNum(params, "fast_period", 10);
    const slow = getNum(params, "slow_period", 20);
    const sl = getNum(params, "stop_loss_pct", 2) / 100;
    const tp = getNum(params, "take_profit_pct", 5) / 100;
    const slPrice = (1 - sl).toFixed(4);
    return `"""${strategyName} - MA Crossover | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict

class MACrossoverStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.fast_period = ${fast}
        self.slow_period = ${slow}
        self.price_history = []
        self.position = None
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.price_history.append(candle.close)
        if len(self.price_history) > 100:
            self.price_history.pop(0)
        if len(self.price_history) >= self.slow_period:
            fast_ma = sum(self.price_history[-self.fast_period:]) / self.fast_period
            slow_ma = sum(self.price_history[-self.slow_period:]) / self.slow_period
            if self.position is None and fast_ma > slow_ma:
                self.position = "LONG"
                stop_loss_price = candle.close * ${slPrice}
                quantity = self.calculate_position_size(entry_price=candle.close, stop_loss_price=stop_loss_price)
                return {"action": "BUY", "quantity": quantity, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "MA_CROSSOVER_ENTRY"}
            if self.position == "LONG" and fast_ma < slow_ma:
                self.position = None
                return {"action": "CLOSE_ALL", "exit_reason": "MA_CROSSOVER_EXIT"}
        return None`;
}

export function generateEMACrossover(params: Record<string, unknown>, strategyName: string): string {
    const fast = getNum(params, "fast_period", 9);
    const slow = getNum(params, "slow_period", 21);
    const sl = getNum(params, "stop_loss_pct", 2) / 100;
    const tp = getNum(params, "take_profit_pct", 5) / 100;
    const slPrice = (1 - sl).toFixed(4);
    return `"""${strategyName} - EMA Crossover | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class EMACrossoverStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.fast_period = ${fast}
        self.slow_period = ${slow}
        self.price_history = []
        self.position = None
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.price_history.append(candle.close)
        if len(self.price_history) > 100:
            self.price_history.pop(0)
        if len(self.price_history) >= self.slow_period:
            ema_fast = indicators.calculate_ema(self.price_history, self.fast_period)[-1]
            ema_slow = indicators.calculate_ema(self.price_history, self.slow_period)[-1]
            if ema_fast is None or ema_slow is None:
                return None
            if self.position is None and ema_fast > ema_slow:
                self.position = "LONG"
                stop_loss_price = candle.close * ${slPrice}
                quantity = self.calculate_position_size(entry_price=candle.close, stop_loss_price=stop_loss_price)
                return {"action": "BUY", "quantity": quantity, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "EMA_CROSSOVER_ENTRY"}
            if self.position == "LONG" and ema_fast < ema_slow:
                self.position = None
                return {"action": "CLOSE_ALL", "exit_reason": "EMA_CROSSOVER_EXIT"}
        return None`;
}

export function generateTripleMA(params: Record<string, unknown>, strategyName: string): string {
    const fast = getNum(params, "fast_period", 5);
    const med = getNum(params, "medium_period", 13);
    const slow = getNum(params, "slow_period", 34);
    const sl = getNum(params, "stop_loss_pct", 2) / 100;
    const tp = getNum(params, "take_profit_pct", 5) / 100;
    const slPrice = (1 - sl).toFixed(4);
    return `"""${strategyName} - Triple MA | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class TripleMAStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.fast_period = ${fast}
        self.medium_period = ${med}
        self.slow_period = ${slow}
        self.price_history = []
        self.position = None
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.price_history.append(candle.close)
        if len(self.price_history) > 150:
            self.price_history.pop(0)
        if len(self.price_history) >= self.slow_period:
            f = indicators.calculate_sma(self.price_history, self.fast_period)[-1]
            m = indicators.calculate_sma(self.price_history, self.medium_period)[-1]
            s = indicators.calculate_sma(self.price_history, self.slow_period)[-1]
            if f is None or m is None or s is None:
                return None
            if self.position is None and f > m > s:
                self.position = "LONG"
                stop_loss_price = candle.close * ${slPrice}
                quantity = self.calculate_position_size(entry_price=candle.close, stop_loss_price=stop_loss_price)
                return {"action": "BUY", "quantity": quantity, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "TRIPLE_MA_ENTRY"}
            if self.position == "LONG" and f < m:
                self.position = None
                return {"action": "CLOSE_ALL", "exit_reason": "TRIPLE_MA_EXIT"}
        return None`;
}

export function generatePriceVsMA(params: Record<string, unknown>, strategyName: string): string {
    const period = getNum(params, "ma_period", 20);
    const maType = getStr(params, "ma_type", "sma");
    const direction = getStr(params, "direction", "long");
    const sl = getNum(params, "stop_loss_pct", 2) / 100;
    const tp = getNum(params, "take_profit_pct", 5) / 100;
    const useEMA = maType === "ema";
    const calcFn = useEMA ? "calculate_ema" : "calculate_sma";
    const slLong = (1 - sl).toFixed(4);
    const slShort = (1 + sl).toFixed(4);
    const isLong = direction === "long";
    const entryCond = isLong ? "candle.close > ma_val" : "candle.close < ma_val";
    const exitCond = isLong ? "candle.close < ma_val" : "candle.close > ma_val";
    const action = isLong ? "BUY" : "SELL";
    const posSide = isLong ? "" : ', "position_side": "SHORT"';
    const stopPrice = isLong ? slLong : slShort;
    const posVal = isLong ? "LONG" : "SHORT";
    return `"""${strategyName} - Price vs MA | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class PriceVsMAStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.ma_period = ${period}
        self.use_ema = ${useEMA}
        self.price_history = []
        self.position = None
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.price_history.append(candle.close)
        if len(self.price_history) > 100:
            self.price_history.pop(0)
        if len(self.price_history) >= self.ma_period:
            ma_vals = indicators.${calcFn}(self.price_history, self.ma_period)
            ma_val = ma_vals[-1]
            if ma_val is None:
                return None
            if self.position is None and ${entryCond}:
                self.position = "${posVal}"
                stop_loss_price = candle.close * ${stopPrice}
                quantity = self.calculate_position_size(entry_price=candle.close, stop_loss_price=stop_loss_price)
                return {"action": "${action}", "quantity": quantity, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}${posSide}, "exit_reason": "PRICE_MA_ENTRY"}
            if self.position and ${exitCond}:
                self.position = None
                return {"action": "CLOSE_ALL", "exit_reason": "PRICE_MA_EXIT"}
        return None`;
}

export function generateRSI(params: Record<string, unknown>, strategyName: string): string {
    const period = getNum(params, "rsi_period", 14);
    const oversold = getNum(params, "rsi_oversold", 30);
    const overbought = getNum(params, "rsi_overbought", 70);
    const exitMin = getNum(params, "rsi_exit_min", 40);
    const exitMax = getNum(params, "rsi_exit_max", 60);
    const sl = getNum(params, "stop_loss_pct", 3) / 100;
    const tp = getNum(params, "take_profit_pct", 6) / 100;
    return `"""${strategyName} - RSI Mean Reversion | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class RSIMeanReversionStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.rsi_period = ${period}
        self.rsi_oversold = ${oversold}
        self.rsi_overbought = ${overbought}
        self.exit_min = ${exitMin}
        self.exit_max = ${exitMax}
        self.price_history = []
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.price_history.append(candle.close)
        if len(self.price_history) > 200:
            self.price_history.pop(0)
        if len(self.price_history) >= self.rsi_period + 1:
            rsi_vals = indicators.calculate_rsi(self.price_history, self.rsi_period)
            curr = rsi_vals[-1]
            if curr is None:
                return None
            if curr < self.rsi_oversold:
                sl_p = candle.close * ${(1 - sl).toFixed(4)}
                qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
                return {"action": "BUY", "quantity": qty, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "RSI_OVERSOLD"}
            elif curr > self.rsi_overbought:
                sl_p = candle.close * ${(1 + sl).toFixed(4)}
                qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
                return {"action": "SELL", "quantity": qty, "order_type": "MARKET", "position_side": "SHORT", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "RSI_OVERBOUGHT"}
            elif self.exit_min <= curr <= self.exit_max:
                return {"action": "CLOSE_ALL", "exit_reason": "RSI_NEUTRAL"}
        return None`;
}

export function generateStochastic(params: Record<string, unknown>, strategyName: string): string {
    const pk = getNum(params, "period_k", 14);
    const pd = getNum(params, "period_d", 3);
    const oversold = getNum(params, "oversold", 20);
    const overbought = getNum(params, "overbought", 80);
    const direction = getStr(params, "direction", "both");
    const sl = getNum(params, "stop_loss_pct", 2) / 100;
    const tp = getNum(params, "take_profit_pct", 4) / 100;
    const doLong = direction === "long" || direction === "both";
    const doShort = direction === "short" || direction === "both";
    return `"""${strategyName} - Stochastic Oscillator | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class StochasticStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.period_k = ${pk}
        self.period_d = ${pd}
        self.oversold = ${oversold}
        self.overbought = ${overbought}
        self.highs, self.lows, self.closes = [], [], []
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.highs.append(candle.high)
        self.lows.append(candle.low)
        self.closes.append(candle.close)
        if len(self.closes) > 200:
            self.highs.pop(0); self.lows.pop(0); self.closes.pop(0)
        if len(self.closes) >= self.period_k + self.period_d:
            stoch = indicators.calculate_stochastic(self.highs, self.lows, self.closes, self.period_k, self.period_d)
            k, d = stoch['k'][-1], stoch['d'][-1]
            if k is None or d is None:
                return None
            if ${doLong} and k < self.oversold and k > d:
                sl_p = candle.close * ${(1 - sl).toFixed(4)}
                qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
                return {"action": "BUY", "quantity": qty, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "STOCH_OVERSOLD"}
            if ${doShort} and k > self.overbought and k < d:
                sl_p = candle.close * ${(1 + sl).toFixed(4)}
                qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
                return {"action": "SELL", "quantity": qty, "order_type": "MARKET", "position_side": "SHORT", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "STOCH_OVERBOUGHT"}
        return None`;
}

export function generateMACD(params: Record<string, unknown>, strategyName: string): string {
    const fast = getNum(params, "fast_period", 12);
    const slow = getNum(params, "slow_period", 26);
    const sig = getNum(params, "signal_period", 9);
    const sl = getNum(params, "stop_loss_pct", 5) / 100;
    const tp = getNum(params, "take_profit_pct", 10) / 100;
    const trail = getNum(params, "trailing_stop", 3) / 100;
    return `"""${strategyName} - MACD Momentum | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class MACDMomentumStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.fast_period = ${fast}
        self.slow_period = ${slow}
        self.signal_period = ${sig}
        self.price_history = []
        self.position = None
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.price_history.append(candle.close)
        if len(self.price_history) > 200:
            self.price_history.pop(0)
        if len(self.price_history) >= self.slow_period:
            md = indicators.calculate_macd(self.price_history, self.fast_period, self.slow_period, self.signal_period)
            macd_line, sig_line = md['macd'], md['signal']
            if len(macd_line) < 2 or macd_line[-1] is None or sig_line[-1] is None:
                return None
            curr_m, curr_s = macd_line[-1], sig_line[-1]
            prev_m, prev_s = macd_line[-2], sig_line[-2]
            if self.position is None and prev_m <= prev_s and curr_m > curr_s:
                self.position = "LONG"
                sl_p = candle.close * ${(1 - sl).toFixed(4)}
                qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
                return {"action": "BUY", "quantity": qty, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "trailing_stop": ${trail.toFixed(4)}, "exit_reason": "MACD_BULLISH"}
            if self.position == "LONG" and prev_m >= prev_s and curr_m < curr_s:
                self.position = None
                return {"action": "CLOSE_ALL", "exit_reason": "MACD_BEARISH"}
        return None`;
}

export function generateBollingerBands(params: Record<string, unknown>, strategyName: string): string {
    const period = getNum(params, "period", 20);
    const std = getNum(params, "std_dev", 2);
    const direction = getStr(params, "direction", "both");
    const sl = getNum(params, "stop_loss_pct", 2) / 100;
    const tp = getNum(params, "take_profit_pct", 4) / 100;
    const doLong = direction === "long" || direction === "both";
    const doShort = direction === "short" || direction === "both";
    return `"""${strategyName} - Bollinger Bands Bounce | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class BollingerBandsStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.period = ${period}
        self.std_dev = ${std}
        self.price_history = []
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.price_history.append(candle.close)
        if len(self.price_history) > 100:
            self.price_history.pop(0)
        if len(self.price_history) >= self.period:
            bb = indicators.calculate_bollinger_bands(self.price_history, self.period, self.std_dev)
            lower, upper = bb['lower'][-1], bb['upper'][-1]
            if lower is None or upper is None:
                return None
            if ${doLong} and candle.close <= lower:
                sl_p = candle.close * ${(1 - sl).toFixed(4)}
                qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
                return {"action": "BUY", "quantity": qty, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "BB_LOWER_BOUNCE"}
            if ${doShort} and candle.close >= upper:
                sl_p = candle.close * ${(1 + sl).toFixed(4)}
                qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
                return {"action": "SELL", "quantity": qty, "order_type": "MARKET", "position_side": "SHORT", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "BB_UPPER_BOUNCE"}
        return None`;
}

export function generateATRTrailing(params: Record<string, unknown>, strategyName: string): string {
    const atrPeriod = getNum(params, "atr_period", 14);
    const mult = getNum(params, "atr_multiplier", 2);
    const tp = getNum(params, "take_profit_pct", 10) / 100;
    return `"""${strategyName} - ATR Trailing Stop | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class ATRTrailingStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.atr_period = ${atrPeriod}
        self.atr_mult = ${mult}
        self.highs, self.lows, self.closes = [], [], []
        self.position = None
        self.highest_since_entry = 0.0
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.highs.append(candle.high)
        self.lows.append(candle.low)
        self.closes.append(candle.close)
        if len(self.closes) > 200:
            self.highs.pop(0); self.lows.pop(0); self.closes.pop(0)
        if len(self.closes) < self.atr_period + 1:
            return None
        atr_vals = indicators.calculate_atr(self.highs, self.lows, self.closes, self.atr_period)
        atr = atr_vals[-1]
        if atr is None or atr <= 0:
            return None
        trail_dist = atr * self.atr_mult
        if self.position is None:
            sma20 = sum(self.closes[-20:]) / min(20, len(self.closes)) if self.closes else 0
            if candle.close > sma20:
                self.position = "LONG"
                self.highest_since_entry = candle.high
                stop_price = candle.close - trail_dist
                qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=stop_price)
                return {"action": "BUY", "quantity": qty, "order_type": "MARKET", "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "ATR_ENTRY"}
        else:
            self.highest_since_entry = max(self.highest_since_entry, candle.high)
            stop_price = self.highest_since_entry - trail_dist
            if candle.low <= stop_price:
                self.position = None
                return {"action": "CLOSE_ALL", "exit_reason": "ATR_TRAILING_STOP"}
        return None`;
}

export function generateSupertrend(params: Record<string, unknown>, strategyName: string): string {
    const period = getNum(params, "period", 7);
    const mult = getNum(params, "multiplier", 3);
    const sl = getNum(params, "stop_loss_pct", 2) / 100;
    const tp = getNum(params, "take_profit_pct", 5) / 100;
    return `"""${strategyName} - Supertrend | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class SupertrendStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.period = ${period}
        self.multiplier = ${mult}
        self.highs, self.lows, self.closes = [], [], []
        self.position = None
        self.prev_direction = None
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.highs.append(candle.high)
        self.lows.append(candle.low)
        self.closes.append(candle.close)
        if len(self.closes) > 200:
            self.highs.pop(0); self.lows.pop(0); self.closes.pop(0)
        if len(self.closes) < self.period + 5:
            return None
        st = indicators.calculate_supertrend(self.highs, self.lows, self.closes, self.period, self.multiplier)
        st_val = st[-1] if len(st) > 0 else None
        if st_val is None:
            return None
        direction = "up" if candle.close > st_val else "down"
        if self.position is None and direction == "up" and self.prev_direction == "down":
            self.position = "LONG"
            sl_p = candle.close * ${(1 - sl).toFixed(4)}
            qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
            self.prev_direction = direction
            return {"action": "BUY", "quantity": qty, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "SUPERTREND_UP"}
        if self.position == "LONG" and direction == "down":
            self.position = None
            self.prev_direction = direction
            return {"action": "CLOSE_ALL", "exit_reason": "SUPERTREND_DOWN"}
        self.prev_direction = direction
        return None`;
}

export function generateRSIWithMACD(params: Record<string, unknown>, strategyName: string): string {
    const rsiPeriod = getNum(params, "rsi_period", 14);
    const rsiFilter = getNum(params, "rsi_filter", 50);
    const mFast = getNum(params, "macd_fast", 12);
    const mSlow = getNum(params, "macd_slow", 26);
    const mSig = getNum(params, "macd_signal", 9);
    const sl = getNum(params, "stop_loss_pct", 3) / 100;
    const tp = getNum(params, "take_profit_pct", 6) / 100;
    return `"""${strategyName} - RSI + MACD Combo | Generated"""
from strategies.base import BaseStrategy
from core.candle import Candle
from typing import Optional, Dict
from strategies import indicators

class RSIMACDComboStrategy(BaseStrategy):
    def __init__(self, broker, config=None):
        super().__init__(broker, config)
        self.rsi_period = ${rsiPeriod}
        self.rsi_filter = ${rsiFilter}
        self.macd_fast = ${mFast}
        self.macd_slow = ${mSlow}
        self.macd_signal = ${mSig}
        self.price_history = []
        self.position = None
    def initialize(self):
        self.initialized = True
    def on_candle(self, candle: Candle) -> Optional[Dict]:
        if not self.initialized:
            self.initialize()
        self.price_history.append(candle.close)
        if len(self.price_history) > 200:
            self.price_history.pop(0)
        if len(self.price_history) < max(self.rsi_period, self.macd_slow) + 2:
            return None
        rsi_vals = indicators.calculate_rsi(self.price_history, self.rsi_period)
        rsi = rsi_vals[-1]
        md = indicators.calculate_macd(self.price_history, self.macd_fast, self.macd_slow, self.macd_signal)
        macd_line, sig_line = md['macd'], md['signal']
        if rsi is None or len(macd_line) < 2 or macd_line[-1] is None or sig_line[-1] is None:
            return None
        curr_m, curr_s = macd_line[-1], sig_line[-1]
        prev_m, prev_s = macd_line[-2], sig_line[-2]
        bull_cross = prev_m <= prev_s and curr_m > curr_s
        if self.position is None and rsi > self.rsi_filter and bull_cross:
            self.position = "LONG"
            sl_p = candle.close * ${(1 - sl).toFixed(4)}
            qty = self.calculate_position_size(entry_price=candle.close, stop_loss_price=sl_p)
            return {"action": "BUY", "quantity": qty, "order_type": "MARKET", "stop_loss_pct": ${sl.toFixed(4)}, "take_profit_pct": ${tp.toFixed(4)}, "exit_reason": "RSI_MACD_ENTRY"}
        if self.position == "LONG" and prev_m >= prev_s and curr_m < curr_s:
            self.position = None
            return {"action": "CLOSE_ALL", "exit_reason": "RSI_MACD_EXIT"}
        return None`;
}
