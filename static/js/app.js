/**
 * Monte Carlo Stock Predictor — Frontend Logic
 * Handles UI interactions, API calls, and Plotly chart rendering.
 */

// ============================================================
// Slider value display binding
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    bindSlider('input-nbars', 'value-nbars', (v) => Number(v).toLocaleString());
    bindSlider('input-simulations', 'value-simulations', (v) => Number(v).toLocaleString());
    bindSlider('input-horizon', 'value-horizon', (v) => `${v} periods`);
});

function bindSlider(sliderId, displayId, formatter) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (!slider || !display) return;

    const update = () => { display.textContent = formatter(slider.value); };
    slider.addEventListener('input', update);
    update();
}

// ============================================================
// Plotly chart theme (matches our dark UI)
// ============================================================
const PLOTLY_LAYOUT_BASE = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
        family: "'Inter', sans-serif",
        color: '#8892a8',
        size: 12,
    },
    margin: { t: 20, r: 30, b: 50, l: 70 },
    xaxis: {
        gridcolor: 'rgba(100,120,180,0.08)',
        zerolinecolor: 'rgba(100,120,180,0.1)',
        linecolor: 'rgba(100,120,180,0.1)',
        tickfont: { size: 11 },
    },
    yaxis: {
        gridcolor: 'rgba(100,120,180,0.08)',
        zerolinecolor: 'rgba(100,120,180,0.1)',
        linecolor: 'rgba(100,120,180,0.1)',
        tickfont: { size: 11 },
        tickformat: ',.2f',
    },
    hoverlabel: {
        bgcolor: '#0c1020',
        bordercolor: 'rgba(100,120,180,0.2)',
        font: { family: "'Inter', sans-serif", color: '#e8ecf4', size: 13 },
    },
    legend: {
        bgcolor: 'rgba(0,0,0,0)',
        bordercolor: 'rgba(0,0,0,0)',
        font: { color: '#8892a8', size: 11 },
    },
    modebar: {
        bgcolor: 'rgba(0,0,0,0)',
        color: '#4a5568',
        activecolor: '#00d4ff',
    },
};

const PLOTLY_CONFIG = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
};

// ============================================================
// Toast notifications
// ============================================================
function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ============================================================
// Loading overlay
// ============================================================
function showLoading(detail = 'Fetching market data...') {
    const overlay = document.getElementById('loading-overlay');
    const detailEl = document.getElementById('loader-detail');
    overlay.classList.remove('hidden');
    if (detailEl) detailEl.textContent = detail;
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// ============================================================
// Run Simulation
// ============================================================
let currentSimulationController = null;
let cancelTimer = null;

async function runSimulation() {
    const btn = document.getElementById('btn-simulate');
    btn.disabled = true;

    const params = {
        symbol: document.getElementById('input-symbol').value.trim(),
        exchange: document.getElementById('input-exchange').value.trim(),
        interval: document.getElementById('input-interval').value,
        n_bars: parseInt(document.getElementById('input-nbars').value),
        num_simulations: parseInt(document.getElementById('input-simulations').value),
        time_horizon: parseInt(document.getElementById('input-horizon').value),
    };

    if (!params.symbol) {
        showToast('Please enter a ticker symbol.');
        btn.disabled = false;
        return;
    }
    if (!params.exchange) {
        showToast('Please enter an exchange name.');
        btn.disabled = false;
        return;
    }

    showLoading(`Fetching ${params.symbol} data from ${params.exchange}...`);

    // create a controller so we can cancel the fetch
    const controller = new AbortController();
    currentSimulationController = controller;

    // show cancel button immediately so user can stop a mistaken run
    const cb = document.getElementById('btn-cancel');
    if (cb) cb.classList.remove('hidden');

    try {
        const response = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Server error (${response.status})`);
        }

        hideLoading();
        renderResults(result, params);
        showToast('Simulation complete!', 'success');

    } catch (err) {
        if (err && err.name === 'AbortError') {
            showToast('Simulation canceled.', 'error');
        } else {
            hideLoading();
            showToast(err.message || 'An unexpected error occurred.');
        }
    } finally {
        if (cancelTimer) { clearTimeout(cancelTimer); cancelTimer = null; }
        currentSimulationController = null;
        const cb = document.getElementById('btn-cancel');
        if (cb) cb.classList.add('hidden');
        btn.disabled = false;
    }
}

// ============================================================
// Render all results
// ============================================================
function cancelSimulation() {
    const btn = document.getElementById('btn-simulate');
    const cb = document.getElementById('btn-cancel');
    if (cancelTimer) { clearTimeout(cancelTimer); cancelTimer = null; }
    if (currentSimulationController) {
        currentSimulationController.abort();
    }
    hideLoading();
    if (cb) cb.classList.add('hidden');
    if (btn) btn.disabled = false;
}

function renderResults(data, params) {
    // Show hidden sections
    document.getElementById('stats-section').classList.remove('hidden');
    document.getElementById('charts-section').classList.remove('hidden');
    document.getElementById('model-section').classList.remove('hidden');

    renderStats(data.statistics);
    renderFanChart(data, params);
    renderHistogram(data);
    renderModelParams(data);
}

// ============================================================
// Statistics Cards
// ============================================================
function renderStats(stats) {
    const fmt = (v) => {
        if (v === undefined || v === null) return '—';
        return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    document.getElementById('stat-current-value').textContent = `${fmt(stats.current_price)}`;
    document.getElementById('stat-expected-value').textContent = `${fmt(stats.expected_price)}`;

    const returnEl = document.getElementById('stat-return-value');
    const retVal = stats.expected_return_pct;
    returnEl.textContent = `${retVal >= 0 ? '+' : ''}${fmt(retVal)}%`;
    returnEl.style.color = retVal >= 0 ? '#22c55e' : '#ef4444';

    const probEl = document.getElementById('stat-probgain-value');
    probEl.textContent = `${fmt(stats.prob_gain)}%`;
    probEl.style.color = stats.prob_gain >= 50 ? '#22c55e' : '#ef4444';

    document.getElementById('stat-var-value').textContent = `${fmt(stats.var_5_pct)}`;
    document.getElementById('stat-vol-value').textContent = `${fmt(stats.annualized_volatility)}%`;
}

// ============================================================
// Fan Chart (Historical + Simulated Paths + Confidence Bands)
// ============================================================
function renderFanChart(data, params) {
    const traces = [];
    const historical = data.historical;
    const percentiles = data.percentiles;
    const timeSteps = data.time_steps;
    const displayPaths = data.display_paths;

    // --- Historical prices ---
    traces.push({
        x: historical.dates,
        y: historical.prices,
        type: 'scatter',
        mode: 'lines',
        name: 'Historical',
        line: { color: '#e8ecf4', width: 2 },
        hovertemplate: 'Date: %{x}<br>Price: %{y:,.2f}<extra>Historical</extra>',
    });

    // Build future x-axis labels
    const lastDate = historical.dates[historical.dates.length - 1];
    const futureLabels = timeSteps.map((t) => t === 0 ? lastDate : `T+${t}`);

    // --- Confidence bands (filled areas) ---
    const bandConfigs = [
        { lower: '5', upper: '95', color: 'rgba(0, 212, 255, 0.06)', name: '5th–95th Percentile' },
        { lower: '25', upper: '75', color: 'rgba(0, 212, 255, 0.12)', name: '25th–75th Percentile' },
    ];

    for (const band of bandConfigs) {
        const lowerData = percentiles[band.lower];
        const upperData = percentiles[band.upper];

        traces.push({
            x: futureLabels.concat([...futureLabels].reverse()),
            y: upperData.concat([...lowerData].reverse()),
            fill: 'toself',
            fillcolor: band.color,
            line: { color: 'transparent' },
            type: 'scatter',
            name: band.name,
            showlegend: true,
            hoverinfo: 'skip',
        });
    }

    // --- Median line ---
    traces.push({
        x: futureLabels,
        y: percentiles['50'],
        type: 'scatter',
        mode: 'lines',
        name: 'Median (50th)',
        line: { color: '#00d4ff', width: 2.5, dash: 'dot' },
        hovertemplate: 'Step: %{x}<br>Median: %{y:,.2f}<extra></extra>',
    });

    // --- Sample simulated paths (subtle) ---
    const maxPathsToShow = Math.min(displayPaths.length, 80);
    for (let i = 0; i < maxPathsToShow; i++) {
        traces.push({
            x: futureLabels,
            y: displayPaths[i],
            type: 'scatter',
            mode: 'lines',
            line: { color: 'rgba(124, 58, 237, 0.08)', width: 0.7 },
            showlegend: false,
            hoverinfo: 'skip',
        });
    }

    // --- Current price reference line ---
    const currentPrice = data.statistics.current_price;
    traces.push({
        x: futureLabels,
        y: Array(futureLabels.length).fill(currentPrice),
        type: 'scatter',
        mode: 'lines',
        name: 'Current Price',
        line: { color: 'rgba(245, 158, 11, 0.5)', width: 1.5, dash: 'dash' },
        hovertemplate: 'Current: %{y:,.2f}<extra></extra>',
    });

    const layout = {
        ...PLOTLY_LAYOUT_BASE,
        xaxis: {
            ...PLOTLY_LAYOUT_BASE.xaxis,
            title: { text: 'Time', font: { size: 12, color: '#8892a8' } },
            rangeslider: { visible: false },
        },
        yaxis: {
            ...PLOTLY_LAYOUT_BASE.yaxis,
            title: { text: 'Price', font: { size: 12, color: '#8892a8' } },
        },
        showlegend: true,
        legend: {
            ...PLOTLY_LAYOUT_BASE.legend,
            orientation: 'h',
            y: -0.15,
            x: 0.5,
            xanchor: 'center',
        },
    };

    Plotly.newPlot('chart-fan', traces, layout, PLOTLY_CONFIG);

    // Update chart meta text
    const meta = data.meta;
    document.getElementById('chart-meta').textContent =
        `${meta.symbol} on ${meta.exchange} · ${meta.interval} timeframe · ${data.model_params.num_simulations.toLocaleString()} simulations · ${data.model_params.time_horizon} period horizon`;
}

// ============================================================
// Histogram of final prices
// ============================================================
function renderHistogram(data) {
    const histogram = data.histogram;
    const stats = data.statistics;

    const traces = [
        {
            x: histogram.bin_centers,
            y: histogram.counts,
            type: 'bar',
            marker: {
                color: histogram.bin_centers.map((price) =>
                    price >= stats.current_price
                        ? 'rgba(16, 185, 129, 0.6)'
                        : 'rgba(239, 68, 68, 0.5)'
                ),
                line: {
                    color: histogram.bin_centers.map((price) =>
                        price >= stats.current_price
                            ? 'rgba(16, 185, 129, 0.9)'
                            : 'rgba(239, 68, 68, 0.8)'
                    ),
                    width: 1,
                },
            },
            hovertemplate: 'Price: %{x:,.2f}<br>Count: %{y}<extra></extra>',
            name: 'Simulated Prices',
        },
    ];

    // Mean line
    const maxCount = Math.max(...histogram.counts);
    traces.push({
        x: [stats.expected_price, stats.expected_price],
        y: [0, maxCount],
        type: 'scatter',
        mode: 'lines',
        name: `Mean (${stats.expected_price.toLocaleString(undefined, { minimumFractionDigits: 2 })})`,
        line: { color: '#00d4ff', width: 2, dash: 'dash' },
    });

    // Current price line
    traces.push({
        x: [stats.current_price, stats.current_price],
        y: [0, maxCount],
        type: 'scatter',
        mode: 'lines',
        name: `Current (${stats.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })})`,
        line: { color: '#f59e0b', width: 2, dash: 'dash' },
    });

    // VaR line
    traces.push({
        x: [stats.var_5_pct, stats.var_5_pct],
        y: [0, maxCount],
        type: 'scatter',
        mode: 'lines',
        name: `VaR 5% (${stats.var_5_pct.toLocaleString(undefined, { minimumFractionDigits: 2 })})`,
        line: { color: '#ef4444', width: 1.5, dash: 'dot' },
    });

    const layout = {
        ...PLOTLY_LAYOUT_BASE,
        xaxis: {
            ...PLOTLY_LAYOUT_BASE.xaxis,
            title: { text: 'Final Price', font: { size: 12, color: '#8892a8' } },
        },
        yaxis: {
            ...PLOTLY_LAYOUT_BASE.yaxis,
            title: { text: 'Frequency', font: { size: 12, color: '#8892a8' } },
            tickformat: ',d',
        },
        bargap: 0.05,
        showlegend: true,
        legend: {
            ...PLOTLY_LAYOUT_BASE.legend,
            orientation: 'h',
            y: -0.15,
            x: 0.5,
            xanchor: 'center',
        },
    };

    Plotly.newPlot('chart-histogram', traces, layout, PLOTLY_CONFIG);
}

// ============================================================
// Model Parameters display
// ============================================================
function renderModelParams(data) {
    const mp = data.model_params;
    const stats = data.statistics;

    document.getElementById('param-mu').textContent = mp.mu_daily.toFixed(6);
    document.getElementById('param-sigma').textContent = mp.sigma_daily.toFixed(6);
    document.getElementById('param-obs').textContent = mp.num_observations.toLocaleString();
    document.getElementById('param-median').textContent =
        `${stats.median_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('param-std').textContent =
        `${stats.std_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('param-var1').textContent =
        `${stats.var_1_pct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}
