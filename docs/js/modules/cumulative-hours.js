import { chartTheme, baseOptions, freshCanvas, registerChart } from '../lib/chartjs-theme.js';

export default {
  id: 'cumulative-hours',
  title: 'Накопичені години під тривогою',
  description: 'Загальний час під тривогою наростаючим підсумком за весь період',
  render(container, data) {
    const theme = chartTheme();
    const canvas = freshCanvas(container);
    const series = data.daily_series;

    let running = 0;
    const points = series.map((d) => {
      running += d.total_duration_min / 60;
      return { date: d.date, hours: running };
    });

    // проріджуємо мітки осі, якщо точок багато
    const step = Math.max(1, Math.floor(points.length / 12));

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map((p) => p.date),
        datasets: [
          {
            data: points.map((p) => Math.round(p.hours)),
            borderColor: theme.series1,
            backgroundColor: theme.series1Wash,
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
          },
        ],
      },
      options: baseOptions(theme, {
        scales: {
          x: { ticks: { autoSkip: true, maxTicksLimit: 8, callback: (_, i) => (i % step === 0 ? points[i]?.date : '') } },
        },
        plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y.toLocaleString('uk-UA')} год` } } },
      }),
    });
    registerChart(container, chart);
  },
};
