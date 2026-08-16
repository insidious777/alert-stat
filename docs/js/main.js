import { loadJson } from './lib/data-loader.js';
import { initLocationSearch, getSelectionFromHash, setHash } from './lib/location-select.js';
import modules from './module-registry.js';

const searchInputEl = document.getElementById('location-search');
const listboxEl = document.getElementById('location-listbox');
const contentEl = document.getElementById('module-content');
const subtitleEl = document.getElementById('header-sub');
const themeToggleEl = document.getElementById('theme-toggle');

let locationsData, manifestData;
let currentData = null;

function keyFor(type, uid) {
  const prefix = type === 'oblast' || type === 'special_city' ? 'o' : type === 'raion' ? 'r' : 'h';
  return `${prefix}-${uid}`;
}

function applyStoredTheme() {
  const stored = localStorage.getItem('theme-override');
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.setAttribute('data-theme', stored);
  }
  themeToggleEl.textContent = stored === 'dark' ? '🌙' : stored === 'light' ? '☀️' : '🖥️';
}

function toggleTheme() {
  const current = localStorage.getItem('theme-override');
  const next = current === 'light' ? 'dark' : current === 'dark' ? null : 'light';
  if (next) {
    localStorage.setItem('theme-override', next);
    document.documentElement.setAttribute('data-theme', next);
  } else {
    localStorage.removeItem('theme-override');
    document.documentElement.removeAttribute('data-theme');
  }
  themeToggleEl.textContent = next === 'dark' ? '🌙' : next === 'light' ? '☀️' : '🖥️';
  if (currentData) renderAll(currentData);
}

function renderEmptyState(message) {
  contentEl.innerHTML = `<div class="empty-state"><h2>Немає даних</h2><p>${message}</p></div>`;
}

function renderAll(data) {
  currentData = data;
  contentEl.innerHTML = '';
  for (const mod of modules) {
    if (mod.isApplicable && !mod.isApplicable(data)) continue;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = `module-${mod.id}`;
    card.innerHTML = `<h2>${mod.title}</h2>${mod.description ? `<p class="desc">${mod.description}</p>` : ''}<div class="module-body"></div>`;
    contentEl.appendChild(card);

    const body = card.querySelector('.module-body');
    try {
      mod.render(body, data, { locationsIndex: locationsData._byUid });
    } catch (err) {
      console.error(`Module "${mod.id}" failed to render:`, err);
      body.innerHTML = `<p class="card error">Не вдалося відобразити цей модуль.</p>`;
    }
  }
}

async function loadLocation(key) {
  const entry = manifestData.locations.find((m) => keyFor(m.type, m.uid) === key);
  if (!entry) {
    renderEmptyState('Оберіть локацію зі списку — для цієї немає зібраних даних.');
    return;
  }
  subtitleEl.textContent = `${entry.name} · ${entry.first_alert} — ${entry.last_alert}`;
  try {
    const data = await loadJson(`data/${entry.file}`);
    renderAll(data);
  } catch (err) {
    console.error(err);
    renderEmptyState('Не вдалося завантажити дані для цієї локації.');
  }
}

async function bootstrap() {
  applyStoredTheme();
  themeToggleEl.addEventListener('click', toggleTheme);

  [locationsData, manifestData] = await Promise.all([
    loadJson('data/locations.json'),
    loadJson('data/manifest.json'),
  ]);
  locationsData._byUid = new Map(locationsData.locations.map((l) => [l.uid, l]));

  const locationSearch = initLocationSearch({
    inputEl: searchInputEl,
    listboxEl,
    locationsData,
    manifestData,
    onSelect: (key) => {
      setHash(key);
      loadLocation(key);
    },
  });

  searchInputEl.disabled = false;
  searchInputEl.placeholder = 'Пошук області, району, громади…';

  const defaultEntry = manifestData.locations.slice().sort((a, b) => b.alert_count - a.alert_count)[0];
  const defaultVal = defaultEntry ? keyFor(defaultEntry.type, defaultEntry.uid) : '';
  const initial = getSelectionFromHash(defaultVal);

  if (locationSearch.hasLocation(initial)) {
    locationSearch.setValue(initial, { silent: true });
    loadLocation(initial);
  } else {
    renderEmptyState('Дані ще не зібрано.');
  }
}

bootstrap().catch((err) => {
  console.error(err);
  renderEmptyState('Помилка завантаження даних сайту.');
});
