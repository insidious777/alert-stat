import { chartTheme, baseOptions, freshCanvas, registerChart } from '../lib/chartjs-theme.js';

export default {
  id: 'gap-distribution',
  title: 'Проміжки між тривогами',
  description: 'Скільки часу минає між кінцем однієї тривоги і початком наступної (хвилини)',
  render(container, data) {
    const theme = chartTheme();
    const canvas = freshCanvas(container);
    const g = data.gap_histogram;

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: g.bins.map((b) => `${b} хв`),
        datasets: [{ data: g.counts, backgroundColor: theme.series2, borderRadius: 4, maxBarThickness: 40 }],
      },
      options: baseOptions(theme, {
        plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y} проміжків` } } },
      }),
    });
    registerChart(container, chart);

    const s = data.summary;
    if (s.median_gap_min != null) {
      const note = document.createElement('p');
      note.className = 'foot-note';
      note.textContent = `Медіана — ${(s.median_gap_min / 60).toFixed(1)} год, найдовший спокійний період — ${s.max_gap_hours} год.`;
      container.appendChild(note);
    }
  },
};
