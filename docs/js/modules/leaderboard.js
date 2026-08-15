export default {
  id: 'leaderboard',
  title: 'Найгарячіші всередині',
  description: 'Райони/громади цієї локації, відсортовані за кількістю тривог',
  isApplicable(data) {
    return Array.isArray(data.sub_location_ranking) && data.sub_location_ranking.length > 0;
  },
  render(container, data) {
    const ranking = data.sub_location_ranking.slice(0, 15);
    const max = Math.max(...ranking.map((r) => r.total_alerts), 1);

    container.innerHTML = `<ul class="rank-list">${ranking
      .map(
        (r, i) => `
      <li>
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name">${r.name}</span>
        <span class="rank-bar-wrap"><span class="rank-bar" style="width:${(r.total_alerts / max) * 100}%"></span></span>
        <span class="rank-val">${r.total_alerts}</span>
      </li>`
      )
      .join('')}</ul>`;
  },
};
