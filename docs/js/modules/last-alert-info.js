function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default {
  id: 'last-alert-info',
  title: 'Остання тривога',
  description: '',
  render(container, data) {
    const a = data.last_alert;
    const isActive = a.is_active;

    container.innerHTML = `
      <div class="info-card-row">
        <div class="item">
          <div class="k">Статус</div>
          <div class="v">${isActive ? '<span class="badge live">Триває зараз</span>' : '<span class="badge">Завершена</span>'}</div>
        </div>
        <div class="item">
          <div class="k">Початок</div>
          <div class="v">${fmtDateTime(a.started_at)}</div>
        </div>
        <div class="item">
          <div class="k">${isActive ? 'Триває вже' : 'Кінець'}</div>
          <div class="v">${isActive ? '—' : fmtDateTime(a.finished_at)}</div>
        </div>
        <div class="item">
          <div class="k">Тривалість</div>
          <div class="v">${a.duration_min != null ? `${a.duration_min} хв` : '—'}</div>
        </div>
      </div>
      ${data.longest_calm_period ? `<p class="foot-note">Найдовший спокійний період: ${data.longest_calm_period.hours} год (${fmtDateTime(data.longest_calm_period.from)} → ${fmtDateTime(data.longest_calm_period.to)})</p>` : ''}
    `;
  },
};
