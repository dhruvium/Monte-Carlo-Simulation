# Monte Carlo Stock Predictor

A small Flask + Plotly web app that runs Geometric Brownian Motion Monte Carlo simulations on historical stock data (via TradingView/DWM) and displays interactive charts and summary statistics.

**Status:** Working prototype — client-side cancellation added for long-running requests.

**Contents**
- `app.py` — Flask server and API endpoints
- `monte_carlo.py` — Monte Carlo simulator (core algorithm)
- `DWM.py` — TradingView datafeed helper (optional, external deps)
- `static/` — CSS and JavaScript (frontend)
- `templates/index.html` — Main UI

**Features**
- Fetch historical price data via TradingView (when `DWM` dependencies available)
- Run Monte Carlo simulations with configurable parameters
- Interactive Plotly fan chart and histogram of final prices
- Client-side cancel button to abort long-running simulations

**Quickstart (local)**

Prerequisites:
- Python 3.10+ (3.14 tested in this workspace)
- Git (optional)

1. Create and activate a virtual environment (recommended):

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Windows cmd
.\.venv\Scripts\activate.bat
# macOS / Linux
source .venv/bin/activate
```

2. Install dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

3. Run the server:

```bash
python app.py
```

Open http://127.0.0.1:5000 in your browser.

**API**

POST /api/simulate
- Content-Type: application/json
- Body example:

```json
{
  "symbol": "BAJFINANCE",
  "exchange": "NSE",
  "interval": "1D",
  "n_bars": 500,
  "num_simulations": 1000,
  "time_horizon": 30
}
```

Response: JSON containing `historical`, `percentiles`, `histogram`, `statistics`, and `model_params` used by the frontend.

**Client-side cancellation**
- The UI shows a loading overlay while a simulation is running. A `Cancel` button is available in the overlay to abort the in-flight request immediately.
- Note: cancelling the client request prevents the browser from waiting for the server response, but the server may still be performing work — there is currently no server-side cancellation endpoint.

**Troubleshooting**
- "No module named flask": make sure you installed packages into the same Python interpreter you use to run `app.py`.
  - Use `python -m pip install -r requirements.txt` with the same `python` executable.
  - In VS Code, select the correct Python interpreter (bottom right) matching your virtualenv.
- If `DWM.py` (TradingView) fails to import, the app will report the data feed as unavailable and the `/api/simulate` endpoint will return an error. Install any optional dependencies or mock the data feed for development.

**Development notes**
- Frontend code is in `static/js/app.js`. The run/cancel flow uses `AbortController` to abort fetch requests.
- To style the Cancel button, edit `static/css/style.css` (there is a `.btn-cancel` class placeholder in the markup).

**Contributing**
- Feel free to open issues or PRs. Keep changes focused and add tests for algorithmic changes in `monte_carlo.py`.

**License**
- MIT License — use and modify freely.

---
