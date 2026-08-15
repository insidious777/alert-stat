import { chartTheme, baseOptions, freshCanvas, registerChart } from '../lib/chartjs-theme.js';

const WINDOW_DAYS = 90;

export default {
  id: 'daily-trend',
  title: 'Інтенсивність по днях',
  description: `Кількість тривог на день, останні ${WINDOW_DAYS} днів`,
  render(container, data) {
    const theme = chartTheme();
    const canvas = freshCanvas(container);

    const series = data.daily_series.slice(-WINDOW_DAYS);
    const byDate = new Map(series.map((d) => [d.date, d.count]));
    const last = data.date_range.last;
    const dates = [];
    const cursor = new Date(last);
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const d = new Date(cursor);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const values = dates.map((d) => byDate.get(d) || 0);
    const labels = dates.map((d) => d.slice(5).replace('-', '.'));

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: theme.series1,
            backgroundColor: theme.series1Wash,
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: theme.series1,
            pointHoverBorderColor: theme.surface,
            pointHoverBorderWidth: 2,
            tension: 0.15,
          },
        ],
      },
      options: baseOptions(theme, {
        scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 10 } } },
        plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y} тривог` } } },
      }),
    });
    registerChart(container, chart);
  },
};
