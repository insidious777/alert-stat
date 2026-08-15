import { chartTheme, baseOptions, freshCanvas, registerChart } from '../lib/chartjs-theme.js';

export default {
  id: 'hourly-histogram',
  title: 'Коли зазвичай лунають тривоги',
  description: 'Кількість тривог за годиною початку, київський час',
  render(container, data) {
    const theme = chartTheme();
    const canvas = freshCanvas(container);
    const labels = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: data.hourly_histogram,
            backgroundColor: theme.series1,
            borderRadius: 4,
            maxBarThickness: 24,
          },
        ],
      },
      options: baseOptions(theme, {
        scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 12 } } },
        plugins: { tooltip: { callbacks: { title: (items) => items[0].label, label: (item) => `${item.parsed.y} тривог` } } },
      }),
    });
    registerChart(container, chart);
  },
};
