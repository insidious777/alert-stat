import { chartTheme, baseOptions, freshCanvas, registerChart } from '../lib/chartjs-theme.js';

const DOW_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export default {
  id: 'day-of-week',
  title: 'Патерн по днях тижня',
  description: 'Чи є дні, коли тривоги трапляються частіше',
  render(container, data) {
    const theme = chartTheme();
    const canvas = freshCanvas(container);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: DOW_LABELS,
        datasets: [
          { data: data.day_of_week_histogram, backgroundColor: theme.series1, borderRadius: 4, maxBarThickness: 40 },
        ],
      },
      options: baseOptions(theme, {
        plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y} тривог` } } },
      }),
    });
    registerChart(container, chart);
  },
};
