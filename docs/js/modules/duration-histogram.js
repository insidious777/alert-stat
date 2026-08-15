import { chartTheme, baseOptions, freshCanvas, registerChart } from '../lib/chartjs-theme.js';

export default {
  id: 'duration-histogram',
  title: 'Розподіл тривалості',
  description: 'Скільки тривог тривало стільки-то часу (хвилини)',
  render(container, data) {
    const theme = chartTheme();
    const canvas = freshCanvas(container);
    const h = data.duration_histogram;

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: h.bins.map((b) => `${b} хв`),
        datasets: [{ data: h.counts, backgroundColor: theme.series1, borderRadius: 4, maxBarThickness: 40 }],
      },
      options: baseOptions(theme, {
        plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y} тривог` } } },
      }),
    });
    registerChart(container, chart);

    const shortPct = data.summary.total_alerts
      ? Math.round((data.summary.short_alerts_under_2min / data.summary.completed_alerts) * 100)
      : 0;
    if (data.summary.short_alerts_under_2min > 0) {
      const note = document.createElement('p');
      note.className = 'foot-note';
      note.textContent = `${shortPct}% тривог (${data.summary.short_alerts_under_2min} з ${data.summary.completed_alerts}) тривали менше 2 хв — ймовірно уточнення/швидкий відбій.`;
      container.appendChild(note);
    }
  },
};
