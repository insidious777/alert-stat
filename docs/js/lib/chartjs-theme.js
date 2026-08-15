// Reads the live CSS custom properties and returns Chart.js theme tokens +
// a helper to build common options, so every module looks visually consistent.

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function chartTheme() {
  return {
    grid: cssVar('--grid'),
    baseline: cssVar('--baseline'),
    textMuted: cssVar('--text-muted'),
    textPrimary: cssVar('--text-primary'),
    textSecondary: cssVar('--text-secondary'),
    series1: cssVar('--series-1'),
    series1Wash: cssVar('--series-1-wash'),
    series2: cssVar('--series-2'),
    surface: cssVar('--surface-1'),
    border: cssVar('--border'),
  };
}

export function baseOptions(theme, overrides = {}) {
  return Chart.helpers.merge({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.surface,
        titleColor: theme.textPrimary,
        bodyColor: theme.textPrimary,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { size: 12, weight: '600' },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: theme.baseline },
        ticks: { color: theme.textMuted, font: { size: 10.5 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: theme.grid },
        border: { display: false },
        ticks: { color: theme.textMuted, font: { size: 10.5 }, precision: 0 },
      },
    },
  }, overrides);
}

// Destroys any previous Chart.js instance attached to this canvas' container
// before creating a new one, so re-render / theme-toggle doesn't leak charts.
export function freshCanvas(container) {
  if (container._chartInstance) {
    container._chartInstance.destroy();
    container._chartInstance = null;
  }
  container.innerHTML = '<div class="chart-box"><canvas></canvas></div>';
  return container.querySelector('canvas');
}

export function registerChart(container, chart) {
  container._chartInstance = chart;
}
