function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function colorForCount(count, max, seriesRgb) {
  if (count === 0) return 'var(--grid)';
  const t = Math.min(1, Math.log(count + 1) / Math.log(max + 1)); // log scale, one big day shouldn't wash out the rest
  const alpha = 0.18 + t * 0.82;
  return `rgba(${seriesRgb.join(',')},${alpha.toFixed(2)})`;
}

export default {
  id: 'calendar-heatmap',
  title: 'Календар тривог',
  description: 'Інтенсивність по днях за весь час спостережень (як GitHub contributions)',
  render(container, data) {
    const byDate = new Map(data.daily_series.map((d) => [d.date, d.count]));
    const first = new Date(data.date_range.first);
    const last = new Date(data.date_range.last);
    const seriesRgb = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--series-1').trim());
    const maxCount = Math.max(1, ...data.daily_series.map((d) => d.count));

    // почати з понеділка тижня, що містить `first`
    const start = new Date(first);
    const dow = (start.getDay() + 6) % 7; // 0=Mon
    start.setDate(start.getDate() - dow);

    const weeks = [];
    let cursor = new Date(start);
    while (cursor <= last) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const iso = cursor.toISOString().slice(0, 10);
        const inRange = cursor >= first && cursor <= last;
        week.push({ date: iso, count: inRange ? byDate.get(iso) || 0 : null });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }

    const html = weeks
      .map(
        (week) => `<div class="cal-week">${week
          .map((d) =>
            d.count === null
              ? `<div class="cal-day" style="visibility:hidden"></div>`
              : `<div class="cal-day" style="background:${colorForCount(d.count, maxCount, seriesRgb)}" title="${d.date}: ${d.count} тривог"></div>`
          )
          .join('')}</div>`
      )
      .join('');

    container.innerHTML = `
      <div class="cal-heatmap">${html}</div>
      <div class="cal-legend">
        <span>менше</span>
        ${[0, 0.25, 0.5, 0.75, 1]
          .map((t) => `<div class="cal-day" style="background:${t === 0 ? 'var(--grid)' : `rgba(${seriesRgb.join(',')},${(0.18 + t * 0.82).toFixed(2)})`}"></div>`)
          .join('')}
        <span>більше</span>
      </div>`;
  },
};
