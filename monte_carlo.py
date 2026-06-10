"""
Monte Carlo Simulation Engine for Stock Price Prediction
Uses Geometric Brownian Motion (GBM) to simulate future price paths.
"""

import numpy as np
import pandas as pd


class MonteCarloSimulator:
    """
    Simulates future stock prices using Geometric Brownian Motion.

    The model assumes:
        S(t+1) = S(t) * exp((μ - σ²/2)*Δt + σ*√Δt*Z)
    where:
        μ = drift (mean of log returns)
        σ = volatility (std of log returns)
        Z ~ N(0, 1)
        Δt = 1 (one time step)
    """

    def __init__(self, close_prices: pd.Series):
        """
        Initialize with historical close prices.

        Args:
            close_prices: pandas Series of historical closing prices,
                          ordered chronologically (oldest first).
        """
        if close_prices is None or len(close_prices) < 2:
            raise ValueError("Need at least 2 close prices to compute returns.")

        self.close_prices = close_prices.values.astype(float)
        self.log_returns = np.diff(np.log(self.close_prices))
        self.mu = np.mean(self.log_returns)
        self.sigma = np.std(self.log_returns, ddof=1)
        self.last_price = self.close_prices[-1]

    def run(
        self,
        num_simulations: int = 1000,
        time_horizon: int = 30,
        confidence_levels: list = None,
    ) -> dict:
        """
        Run Monte Carlo simulation.

        Args:
            num_simulations: Number of simulated price paths.
            time_horizon: Number of future periods (bars) to predict.
            confidence_levels: Percentiles for confidence bands (default: [5, 25, 50, 75, 95]).

        Returns:
            Dictionary with keys:
                - paths: ndarray of shape (num_simulations, time_horizon + 1)
                - percentiles: dict mapping percentile -> price array
                - statistics: dict with summary stats
                - model_params: dict with mu, sigma, last_price
        """
        if confidence_levels is None:
            confidence_levels = [5, 25, 50, 75, 95]

        # ---- Generate simulated price paths ----
        dt = 1  # one time step
        drift = (self.mu - 0.5 * self.sigma ** 2) * dt
        diffusion = self.sigma * np.sqrt(dt)

        # Random shocks: shape (num_simulations, time_horizon)
        Z = np.random.standard_normal((num_simulations, time_horizon))

        # Log returns for each path
        log_returns_sim = drift + diffusion * Z

        # Cumulative sum of log returns, then exponentiate
        cumulative_log_returns = np.cumsum(log_returns_sim, axis=1)

        # Price paths: prepend the last known price
        paths = np.zeros((num_simulations, time_horizon + 1))
        paths[:, 0] = self.last_price
        paths[:, 1:] = self.last_price * np.exp(cumulative_log_returns)

        # ---- Percentile bands ----
        percentiles = {}
        for p in confidence_levels:
            percentiles[p] = np.percentile(paths, p, axis=0).tolist()

        # ---- Final prices (at the end of the horizon) ----
        final_prices = paths[:, -1]

        # ---- Statistics ----
        expected_price = float(np.mean(final_prices))
        median_price = float(np.median(final_prices))
        std_price = float(np.std(final_prices))
        prob_gain = float(np.mean(final_prices > self.last_price) * 100)
        prob_loss = float(np.mean(final_prices < self.last_price) * 100)
        var_5 = float(np.percentile(final_prices, 5))
        var_1 = float(np.percentile(final_prices, 1))
        max_price = float(np.max(final_prices))
        min_price = float(np.min(final_prices))

        # Annualized volatility (approximate)
        annualized_vol = float(self.sigma * np.sqrt(252) * 100)

        # Expected return over horizon
        expected_return = float((expected_price / self.last_price - 1) * 100)

        statistics = {
            "current_price": float(self.last_price),
            "expected_price": round(expected_price, 2),
            "median_price": round(median_price, 2),
            "std_price": round(std_price, 2),
            "prob_gain": round(prob_gain, 2),
            "prob_loss": round(prob_loss, 2),
            "var_5_pct": round(var_5, 2),
            "var_1_pct": round(var_1, 2),
            "max_price": round(max_price, 2),
            "min_price": round(min_price, 2),
            "annualized_volatility": round(annualized_vol, 2),
            "expected_return_pct": round(expected_return, 2),
        }

        model_params = {
            "mu_daily": round(float(self.mu), 6),
            "sigma_daily": round(float(self.sigma), 6),
            "num_observations": len(self.log_returns),
            "num_simulations": num_simulations,
            "time_horizon": time_horizon,
        }

        # Subsample paths for frontend rendering (max 200 paths for performance)
        display_count = min(num_simulations, 200)
        indices = np.random.choice(num_simulations, display_count, replace=False)
        display_paths = paths[indices].tolist()

        # Histogram data for final price distribution
        hist_counts, hist_edges = np.histogram(final_prices, bins=50)
        histogram = {
            "counts": hist_counts.tolist(),
            "edges": hist_edges.tolist(),
            "bin_centers": ((hist_edges[:-1] + hist_edges[1:]) / 2).tolist(),
        }

        return {
            "display_paths": display_paths,
            "percentiles": percentiles,
            "statistics": statistics,
            "model_params": model_params,
            "histogram": histogram,
            "time_steps": list(range(time_horizon + 1)),
        }
