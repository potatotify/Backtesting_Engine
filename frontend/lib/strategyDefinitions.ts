/**
 * Extensible Strategy Definitions - Schema-driven registry.
 *
 * HOW TO ADD A NEW STRATEGY:
 * 1. Create a generator function in strategyCodeGenerator.ts:
 *    export function generateMyStrategy(params, strategyName) { ... return pythonCode; }
 * 2. Add a StrategyDefinition below with: id, name, description, className, category, parameters, generateCode
 * 3. The UI will auto-render the parameter form and generate code on demand.
 *
 * Param types: "number" | "select" | "boolean"
 * Categories: trend | mean_reversion | momentum | volatility | breakout | multi_indicator
 */

export type ParamType = "number" | "select" | "boolean";

export interface ParamOption {
    value: string;
    label: string;
}

export interface ParamDef {
    id: string;
    label: string;
    type: ParamType;
    default: number | string | boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: ParamOption[];
    description?: string;
    group?: "indicator" | "entry" | "exit" | "risk" | "general";
}

export type StrategyCategory =
    | "trend"
    | "mean_reversion"
    | "momentum"
    | "volatility"
    | "breakout"
    | "multi_indicator";

export interface StrategyDefinition {
    id: string;
    name: string;
    description: string;
    className: string;
    category: StrategyCategory;
    parameters: ParamDef[];
    generateCode: (params: Record<string, unknown>, strategyName: string) => string;
}

// Common parameter groups reused across strategies
const RISK_PARAMS: ParamDef[] = [
    { id: "stop_loss_pct", label: "Stop Loss (%)", type: "number", default: 2, min: 0.5, max: 20, step: 0.5, group: "risk" },
    { id: "take_profit_pct", label: "Take Profit (%)", type: "number", default: 5, min: 1, max: 50, step: 0.5, group: "risk" },
];

const DIRECTION_PARAM: ParamDef[] = [
    {
        id: "direction",
        label: "Direction",
        type: "select",
        default: "long",
        options: [
            { value: "long", label: "Long Only" },
            { value: "short", label: "Short Only" },
            { value: "both", label: "Long & Short" },
        ],
        group: "entry",
    },
];

// Import generator implementations
import { generateMACrossover } from "./strategyCodeGenerator";
import { generateRSI } from "./strategyCodeGenerator";
import { generateMACD } from "./strategyCodeGenerator";
import { generateEMACrossover } from "./strategyCodeGenerator";
import { generateBollingerBands } from "./strategyCodeGenerator";
import { generateATRTrailing } from "./strategyCodeGenerator";
import { generateSupertrend } from "./strategyCodeGenerator";
import { generateStochastic } from "./strategyCodeGenerator";
import { generatePriceVsMA } from "./strategyCodeGenerator";
import { generateTripleMA } from "./strategyCodeGenerator";
import { generateRSIWithMACD } from "./strategyCodeGenerator";

export const STRATEGY_DEFINITIONS: StrategyDefinition[] = [
    {
        id: "ma_crossover",
        name: "Moving Average Crossover",
        description: "Trend-following: Enter when fast MA crosses above slow MA",
        className: "MACrossoverStrategy",
        category: "trend",
        parameters: [
            { id: "fast_period", label: "Fast MA Period", type: "number", default: 10, min: 2, max: 50, group: "indicator" },
            { id: "slow_period", label: "Slow MA Period", type: "number", default: 20, min: 5, max: 200, group: "indicator" },
            ...RISK_PARAMS,
        ],
        generateCode: generateMACrossover,
    },
    {
        id: "ema_crossover",
        name: "EMA Crossover",
        description: "Exponential MA crossover - faster response to price changes",
        className: "EMACrossoverStrategy",
        category: "trend",
        parameters: [
            { id: "fast_period", label: "Fast EMA Period", type: "number", default: 9, min: 2, max: 50, group: "indicator" },
            { id: "slow_period", label: "Slow EMA Period", type: "number", default: 21, min: 5, max: 100, group: "indicator" },
            ...RISK_PARAMS,
        ],
        generateCode: generateEMACrossover,
    },
    {
        id: "triple_ma",
        name: "Triple Moving Average",
        description: "Three MAs: fast, medium, slow - stronger trend confirmation",
        className: "TripleMAStrategy",
        category: "trend",
        parameters: [
            { id: "fast_period", label: "Fast MA Period", type: "number", default: 5, min: 2, max: 20, group: "indicator" },
            { id: "medium_period", label: "Medium MA Period", type: "number", default: 13, min: 5, max: 50, group: "indicator" },
            { id: "slow_period", label: "Slow MA Period", type: "number", default: 34, min: 10, max: 100, group: "indicator" },
            ...RISK_PARAMS,
        ],
        generateCode: generateTripleMA,
    },
    {
        id: "price_vs_ma",
        name: "Price vs Moving Average",
        description: "Long when price above MA, short when below (trend filter)",
        className: "PriceVsMAStrategy",
        category: "trend",
        parameters: [
            { id: "ma_period", label: "MA Period", type: "number", default: 20, min: 5, max: 100, group: "indicator" },
            {
                id: "ma_type",
                label: "MA Type",
                type: "select",
                default: "sma",
                options: [
                    { value: "sma", label: "Simple (SMA)" },
                    { value: "ema", label: "Exponential (EMA)" },
                ],
                group: "indicator",
            },
            {
                id: "direction",
                label: "Direction",
                type: "select",
                default: "long",
                options: [
                    { value: "long", label: "Long Only" },
                    { value: "short", label: "Short Only" },
                ],
                group: "entry",
            },
            ...RISK_PARAMS,
        ],
        generateCode: generatePriceVsMA,
    },
    {
        id: "rsi_mean_reversion",
        name: "RSI Mean Reversion",
        description: "Enter long when oversold, short when overbought",
        className: "RSIMeanReversionStrategy",
        category: "mean_reversion",
        parameters: [
            { id: "rsi_period", label: "RSI Period", type: "number", default: 14, min: 5, max: 30, group: "indicator" },
            { id: "rsi_oversold", label: "Oversold Level", type: "number", default: 30, min: 10, max: 40, group: "entry" },
            { id: "rsi_overbought", label: "Overbought Level", type: "number", default: 70, min: 60, max: 90, group: "entry" },
            { id: "rsi_exit_min", label: "Exit Neutral Min", type: "number", default: 40, min: 30, max: 50, group: "exit" },
            { id: "rsi_exit_max", label: "Exit Neutral Max", type: "number", default: 60, min: 50, max: 70, group: "exit" },
            ...RISK_PARAMS,
        ],
        generateCode: generateRSI,
    },
    {
        id: "stochastic",
        name: "Stochastic Oscillator",
        description: "Overbought/oversold using %K and %D crossover",
        className: "StochasticStrategy",
        category: "mean_reversion",
        parameters: [
            { id: "period_k", label: "%K Period", type: "number", default: 14, min: 5, max: 30, group: "indicator" },
            { id: "period_d", label: "%D Period", type: "number", default: 3, min: 2, max: 10, group: "indicator" },
            { id: "oversold", label: "Oversold Level", type: "number", default: 20, min: 5, max: 30, group: "entry" },
            { id: "overbought", label: "Overbought Level", type: "number", default: 80, min: 70, max: 95, group: "entry" },
            ...DIRECTION_PARAM,
            ...RISK_PARAMS,
        ],
        generateCode: generateStochastic,
    },
    {
        id: "macd_momentum",
        name: "MACD Momentum",
        description: "MACD crossover with optional trailing stop",
        className: "MACDMomentumStrategy",
        category: "momentum",
        parameters: [
            { id: "fast_period", label: "Fast Period", type: "number", default: 12, min: 5, max: 25, group: "indicator" },
            { id: "slow_period", label: "Slow Period", type: "number", default: 26, min: 15, max: 50, group: "indicator" },
            { id: "signal_period", label: "Signal Period", type: "number", default: 9, min: 5, max: 20, group: "indicator" },
            { id: "trailing_stop", label: "Trailing Stop (%)", type: "number", default: 3, min: 1, max: 15, step: 0.5, group: "exit" },
            ...RISK_PARAMS,
        ],
        generateCode: generateMACD,
    },
    {
        id: "bollinger_bands",
        name: "Bollinger Bands Bounce",
        description: "Buy at lower band, sell at upper band (mean reversion)",
        className: "BollingerBandsStrategy",
        category: "volatility",
        parameters: [
            { id: "period", label: "BB Period", type: "number", default: 20, min: 10, max: 50, group: "indicator" },
            { id: "std_dev", label: "Std Dev Multiplier", type: "number", default: 2, min: 1, max: 3, step: 0.5, group: "indicator" },
            ...DIRECTION_PARAM,
            ...RISK_PARAMS,
        ],
        generateCode: generateBollingerBands,
    },
    {
        id: "atr_trailing",
        name: "ATR Trailing Stop",
        description: "Trend-following with ATR-based dynamic stop loss",
        className: "ATRTrailingStrategy",
        category: "volatility",
        parameters: [
            { id: "atr_period", label: "ATR Period", type: "number", default: 14, min: 5, max: 30, group: "indicator" },
            { id: "atr_multiplier", label: "ATR Multiplier", type: "number", default: 2, min: 1, max: 4, step: 0.5, group: "exit" },
            { id: "take_profit_pct", label: "Take Profit (%)", type: "number", default: 10, min: 2, max: 50, step: 0.5, group: "risk" },
        ],
        generateCode: generateATRTrailing,
    },
    {
        id: "supertrend",
        name: "Supertrend",
        description: "Supertrend indicator - trend direction and dynamic stops",
        className: "SupertrendStrategy",
        category: "volatility",
        parameters: [
            { id: "period", label: "ATR Period", type: "number", default: 7, min: 5, max: 20, group: "indicator" },
            { id: "multiplier", label: "ATR Multiplier", type: "number", default: 3, min: 1, max: 5, step: 0.5, group: "indicator" },
            ...RISK_PARAMS,
        ],
        generateCode: generateSupertrend,
    },
    {
        id: "rsi_macd_combo",
        name: "RSI + MACD Combo",
        description: "Combine RSI filter with MACD signal - higher conviction entries",
        className: "RSIMACDComboStrategy",
        category: "multi_indicator",
        parameters: [
            { id: "rsi_period", label: "RSI Period", type: "number", default: 14, min: 5, max: 30, group: "indicator" },
            { id: "rsi_filter", label: "RSI Filter (min for long)", type: "number", default: 50, min: 40, max: 60, group: "entry" },
            { id: "macd_fast", label: "MACD Fast", type: "number", default: 12, min: 5, max: 25, group: "indicator" },
            { id: "macd_slow", label: "MACD Slow", type: "number", default: 26, min: 15, max: 50, group: "indicator" },
            { id: "macd_signal", label: "MACD Signal", type: "number", default: 9, min: 5, max: 20, group: "indicator" },
            ...RISK_PARAMS,
        ],
        generateCode: generateRSIWithMACD,
    },
];

export function getStrategyDefinition(id: string): StrategyDefinition | undefined {
    return STRATEGY_DEFINITIONS.find((s) => s.id === id);
}

export function getStrategiesByCategory(): Record<StrategyCategory, StrategyDefinition[]> {
    const result = {} as Record<StrategyCategory, StrategyDefinition[]>;
    const categories: StrategyCategory[] = ["trend", "mean_reversion", "momentum", "volatility", "breakout", "multi_indicator"];
    categories.forEach((cat) => {
        result[cat] = STRATEGY_DEFINITIONS.filter((s) => s.category === cat);
    });
    return result;
}

export const CATEGORY_LABELS: Record<StrategyCategory, string> = {
    trend: "Trend Following",
    mean_reversion: "Mean Reversion",
    momentum: "Momentum",
    volatility: "Volatility",
    breakout: "Breakout",
    multi_indicator: "Multi-Indicator",
};
