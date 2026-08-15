import { chartTheme, baseOptions, freshCanvas, registerChart } from '../lib/chartjs-theme.js';

export default {
  id: 'monthly-trend',
  title: 'Динаміка за весь час',
  description: 'Кількість тривог на місяць за всю історію спостережень',
  render(container, data) {
    const theme = chartTheme();
    const canvas = freshCanvas(container);
    const series = data.monthly_series;

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.map((m) => m.month),
        datasets: [
          {
            data: series.map((m) => m.count),
            borderColor: theme.series1,
            backgroundColor: theme.series1Wash,
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: theme.series1,
            pointHoverBorderColor: theme.surface,
            pointHoverBorderWidth: 2,
            tension: 0.2,
          },
        ],
      },
      options: baseOptions(theme, {
        scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 12 } } },
        plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y} тривог` } } },
      }),
    });
    registerChart(container, chart);
  },
};
