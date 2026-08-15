function fmtHours(h) {
  if (h == null) return '—';
  return h >= 100 ? Math.round(h) : h.toFixed(1);
}

export default {
  id: 'summary-tiles',
  title: 'Огляд',
  description: 'Ключові цифри за весь наявний період даних',
  render(container, data) {
    const s = data.summary;
    const tiles = [
      ['Всього тривог', s.total_alerts, ''],
      ['В середньому на день', s.avg_per_day, ''],
      ['Під тривогою сумарно', fmtHours(s.total_hours_under_alert), 'год'],
      ['Медіанна тривалість', s.median_duration_min ?? '—', 'хв'],
      ['Найдовша тривога', s.max_duration_min != null ? (s.max_duration_min / 60).toFixed(1) : '—', 'год'],
      ['Медіанний проміжок', s.median_gap_min != null ? (s.median_gap_min / 60).toFixed(1) : '—', 'год'],
    ];
    container.innerHTML = `<div class="tiles">${tiles
      .map(
        ([label, value, unit]) => `
      <div class="tile">
        <div class="label">${label}</div>
        <div class="value">${value}${unit ? `<span class="unit">${unit}</span>` : ''}</div>
      </div>`
      )
      .join('')}</div>
      <p class="foot-note">${data.date_range.first} — ${data.date_range.last}
        (${data.date_range.n_days_with_alerts} з ${data.date_range.n_days_total} днів з тривогами)</p>`;
  },
};
