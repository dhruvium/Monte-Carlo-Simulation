"""
Flask Web Server for Monte Carlo Stock Price Prediction.
Serves the dashboard and provides API endpoints for simulation.
"""

import json
import logging
import sys
import os
import traceback

from flask import Flask, render_template, request, jsonify

# Add the project directory to path so we can import DWM
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from monte_carlo import MonteCarloSimulator

# Lazy import of TvDatafeed to avoid issues if dependencies are missing
try:
    from DWM import TvDatafeed, Interval
    TV_AVAILABLE = True
except ImportError as e:
    TV_AVAILABLE = False
    logging.warning(f"TvDatafeed not available: {e}")

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Map string interval names to Interval enum values
INTERVAL_MAP = {
    "3H": Interval.in_3_hour if TV_AVAILABLE else None,
    "1D": Interval.in_daily if TV_AVAILABLE else None,
    "1W": Interval.in_weekly if TV_AVAILABLE else None,
    "1m": Interval.in_1_minute if TV_AVAILABLE else None,
    "3m": Interval.in_3_minute if TV_AVAILABLE else None,
    "5m": Interval.in_5_minute if TV_AVAILABLE else None,
    "15m": Interval.in_15_minute if TV_AVAILABLE else None,
    "30m": Interval.in_30_minute if TV_AVAILABLE else None,
    "45m": Interval.in_45_minute if TV_AVAILABLE else None,
    "1H": Interval.in_1_hour if TV_AVAILABLE else None,
    "2H": Interval.in_2_hour if TV_AVAILABLE else None,
    "4H": Interval.in_4_hour if TV_AVAILABLE else None,
    "6H": Interval.in_6_hour if TV_AVAILABLE else None,
    "8H": Interval.in_8_hour if TV_AVAILABLE else None,
    "12H": Interval.in_12_hour if TV_AVAILABLE else None,
    "1M": Interval.in_monthly if TV_AVAILABLE else None,
}

# Cache TvDatafeed instance to avoid re-authentication on every request
_tv_instance = None


def get_tv_instance():
    """Get or create a cached TvDatafeed instance."""
    global _tv_instance
    if _tv_instance is None:
        _tv_instance = TvDatafeed()
    return _tv_instance


@app.route("/")
def index():
    """Serve the main dashboard."""
    return render_template("index.html")


@app.route("/api/simulate", methods=["POST"])
def simulate():
    """
    Run Monte Carlo simulation on stock data.

    Expects JSON body:
    {
        "symbol": "BAJFINANCE",
        "exchange": "NSE",
        "interval": "1D",
        "n_bars": 500,
        "num_simulations": 1000,
        "time_horizon": 30
    }
    """
    try:
        data = request.get_json()

        symbol = data.get("symbol", "BAJFINANCE").strip().upper()
        exchange = data.get("exchange", "NSE").strip().upper()
        interval_str = data.get("interval", "1D")
        n_bars = int(data.get("n_bars", 500))
        num_simulations = int(data.get("num_simulations", 1000))
        time_horizon = int(data.get("time_horizon", 30))

        # Validate parameters
        if num_simulations < 10 or num_simulations > 10000:
            return jsonify({"error": "num_simulations must be between 10 and 10,000"}), 400
        if time_horizon < 1 or time_horizon > 365:
            return jsonify({"error": "time_horizon must be between 1 and 365"}), 400
        if n_bars < 10 or n_bars > 5000:
            return jsonify({"error": "n_bars must be between 10 and 5,000"}), 400

        # Resolve interval
        interval = INTERVAL_MAP.get(interval_str)
        if interval is None:
            return jsonify({"error": f"Invalid interval: {interval_str}. Use one of: {list(INTERVAL_MAP.keys())}"}), 400

        if not TV_AVAILABLE:
            return jsonify({"error": "TradingView data feed is not available. Check DWM.py dependencies."}), 500

        # Fetch historical data
        logger.info(f"Fetching {n_bars} bars of {symbol} on {exchange} ({interval_str})...")
        tv = get_tv_instance()
        df = tv.get_hist(
            symbol=symbol,
            exchange=exchange,
            interval=interval,
            n_bars=n_bars,
            extended_session=False,
        )

        if df is None or df.empty:
            return jsonify({"error": f"No data returned for {symbol} on {exchange}. Check the symbol and exchange."}), 404

        close_prices = df["close"]
        logger.info(f"Received {len(close_prices)} data points. Running Monte Carlo ({num_simulations} sims, {time_horizon} periods)...")

        # Build historical price data for the chart
        historical_dates = [str(d) for d in df.index.tolist()]
        historical_prices = close_prices.tolist()

        # Run Monte Carlo simulation
        simulator = MonteCarloSimulator(close_prices)
        results = simulator.run(
            num_simulations=num_simulations,
            time_horizon=time_horizon,
        )

        # Add historical data to results
        results["historical"] = {
            "dates": historical_dates,
            "prices": historical_prices,
        }
        results["meta"] = {
            "symbol": symbol,
            "exchange": exchange,
            "interval": interval_str,
            "n_bars": n_bars,
        }

        logger.info("Simulation complete.")
        return jsonify(results)

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Simulation error: {traceback.format_exc()}")
        return jsonify({"error": f"Simulation failed: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
