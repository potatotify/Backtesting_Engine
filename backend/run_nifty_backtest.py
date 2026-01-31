"""
Run backtest for Nifty Bullish Put Selling strategy (no API/auth).
Usage: from backend folder: python run_nifty_backtest.py
"""
import sys
from pathlib import Path

# Ensure backend is on path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from engine.backtest import BacktestingEngine


def main():
    strategy_path = backend_dir / "examples" / "strategies" / "nifty_bullish_put_selling.py"
    strategy_code = strategy_path.read_text(encoding="utf-8")
    class_name = "NiftyBullishPutSellingStrategy"

    # Strategy expects up to 10 lots (max_positions)
    engine = BacktestingEngine(initial_capital=10000.0, max_positions=10)
    config = {
        "max_positions": 10,
        "initial_capital": 10000.0,
        "risk_per_trade": 0.02,
        "trigger_drop": 100,
        "scale_step": 40,
        "profit_target": 40,
        "max_lots": 10,
        "lot_quantity": 0.001,
    }

    print("Running Nifty Bullish Put Selling backtest (Binance BTCUSDT 1h, 500 candles)...")
    results = engine.run_backtest(
        strategy_code=strategy_code,
        class_name=class_name,
        broker_name="binance",
        symbol="BTCUSDT",
        interval="1h",
        limit=500,
        config=config,
    )

    print("\n--- Results ---")
    print(f"Initial capital: {results['initial_capital']}")
    print(f"Final capital:   {results['final_capital']}")
    print(f"Total trades:    {results['total_trades']}")
    print(f"Winning / Losing: {results['winning_trades']} / {results['losing_trades']}")
    m = results["metrics"]
    print(f"Total return:    {m['total_return']:.4f} ({m['total_return']*100:.2f}%)")
    print(f"Win rate:        {m['win_rate']:.2%}")
    print(f"Max drawdown:    {m['max_drawdown']:.2%}")
    print(f"Sharpe ratio:    {m['sharpe_ratio']:.2f}")
    print(f"Profit factor:   {m['profit_factor']:.2f}")
    if results["trades"]:
        print("\nLast 5 trades:")
        for t in results["trades"][-5:]:
            print(f"  {t['side']} entry={t['entry_price']:.2f} exit={t['exit_price']:.2f} pnl={t['pnl']:.2f} reason={t['exit_reason']}")
    return results


if __name__ == "__main__":
    main()
