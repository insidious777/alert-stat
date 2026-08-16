const TYPE_PREFIX = { oblast: 'o', special_city: 'o', raion: 'r', hromada: 'h' };
const TYPE_LABEL = { oblast: 'область', special_city: 'місто', raion: 'район', hromada: 'громада' };
const MAX_RESULTS = 50;
const MAX_SUGGESTIONS = 30;

function fileKey(type, uid) {
  return `${TYPE_PREFIX[type]}-${uid}`;
}

function buildIndex(locationsData, manifestData) {
  const byUid = new Map(locationsData.locations.map((l) => [l.uid, l]));
  const dataByKey = new Map(manifestData.locations.map((m) => [fileKey(m.type, m.uid), m]));

  return locationsData.locations.map((loc) => {
    const key = fileKey(loc.type, loc.uid);
    const manifestEntry = dataByKey.get(key);
    const parentOblast = loc.parent_oblast_uid != null ? byUid.get(loc.parent_oblast_uid) : null;
    const parentRaion = loc.parent_raion_uid != null ? byUid.get(loc.parent_raion_uid) : null;
    const context = [parentRaion?.name, parentOblast?.name].filter(Boolean).join(', ');
    return {
      key,
      name: loc.name,
      type: loc.type,
      context,
      hasData: !!manifestEntry,
      count: manifestEntry ? manifestEntry.alert_count : 0,
      searchText: loc.name.toLowerCase(),
    };
  });
}

function matchScore(item, query) {
  const idx = item.searchText.indexOf(query);
  if (idx === -1) return -1;
  return idx === 0 ? 2 : 1; // префікс важливіший за збіг усередині слова
}

function renderResults(listboxEl, items, activeIndex) {
  if (items.length === 0) {
    listboxEl.innerHTML = `<li class="loc-empty">Нічого не знайдено</li>`;
    return;
  }
  listboxEl.innerHTML = items
    .map(
      (item, i) => `
      <li role="option" data-key="${item.key}" data-index="${i}"
          aria-disabled="${!item.hasData}" aria-selected="${i === activeIndex}"
          class="${i === activeIndex ? 'active' : ''} ${!item.hasData ? 'disabled' : ''}">
        <span class="loc-name">${item.name}</span>
        <span class="loc-meta">
          ${item.context ? `<span class="loc-context">${item.context}</span>` : ''}
          ${item.hasData ? `<span class="loc-count">${item.count}</span>` : `<span class="loc-nodata">немає даних</span>`}
        </span>
      </li>`
    )
    .join('');
}

export function initLocationSearch({ inputEl, listboxEl, locationsData, manifestData, onSelect }) {
  const index = buildIndex(locationsData, manifestData);
  const byKey = new Map(index.map((item) => [item.key, item]));
  const suggestions = index
    .filter((item) => item.hasData)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SUGGESTIONS);

  let currentResults = [];
  let activeIndex = -1;
  let selectedKey = null;

  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions;
    return index
      .map((item) => ({ item, score: matchScore(item, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (b.item.hasData - a.item.hasData) || b.item.count - a.item.count)
      .slice(0, MAX_RESULTS)
      .map((r) => r.item);
  }

  function open(query) {
    currentResults = search(query);
    activeIndex = currentResults.findIndex((r) => r.hasData);
    renderResults(listboxEl, currentResults, activeIndex);
    listboxEl.hidden = false;
    inputEl.setAttribute('aria-expanded', 'true');
  }

  function close() {
    listboxEl.hidden = true;
    inputEl.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  }

  function commit(key, { silent } = {}) {
    const item = byKey.get(key);
    if (!item || !item.hasData) return;
    selectedKey = key;
    inputEl.value = item.name;
    close();
    if (!silent) onSelect(key);
  }

  function moveActive(delta) {
    if (!currentResults.length) return;
    let i = activeIndex;
    for (let step = 0; step < currentResults.length; step++) {
      i = (i + delta + currentResults.length) % currentResults.length;
      if (currentResults[i].hasData) break;
    }
    activeIndex = i;
    renderResults(listboxEl, currentResults, activeIndex);
    listboxEl.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  inputEl.addEventListener('focus', () => {
    inputEl.select();
    open(inputEl.value === (byKey.get(selectedKey)?.name) ? '' : inputEl.value);
  });

  inputEl.addEventListener('input', () => open(inputEl.value));

  inputEl.addEventListener('keydown', (e) => {
    if (listboxEl.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      open(inputEl.value === (byKey.get(selectedKey)?.name) ? '' : inputEl.value);
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && currentResults[activeIndex]) commit(currentResults[activeIndex].key);
    } else if (e.key === 'Escape') {
      close();
      inputEl.value = byKey.get(selectedKey)?.name || '';
    }
  });

  listboxEl.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-key]');
    if (!li || li.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    commit(li.dataset.key);
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listboxEl.contains(e.target)) {
      close();
      inputEl.value = byKey.get(selectedKey)?.name || '';
    }
  });

  return {
    setValue(key, { silent } = {}) {
      commit(key, { silent });
    },
    hasLocation(key) {
      return byKey.has(key) && byKey.get(key).hasData;
    },
  };
}

export function getSelectionFromHash(fallback) {
  const h = window.location.hash.replace('#', '');
  return h || fallback;
}

export function setHash(value) {
  history.replaceState(null, '', `#${value}`);
}
