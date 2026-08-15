const TYPE_PREFIX = { oblast: 'o', special_city: 'o', raion: 'r', hromada: 'h' };

function fileKey(type, uid) {
  return `${TYPE_PREFIX[type]}-${uid}`;
}

/**
 * Builds the grouped <select>: one <optgroup> per oblast/special-city,
 * containing the oblast itself, its raions, then its hromadas (indented).
 * Locations without data (absent from the manifest) are shown disabled.
 */
export function populateLocationSelect(selectEl, locationsData, manifestData) {
  const locations = locationsData.locations;
  const withData = new Set(manifestData.locations.map((m) => fileKey(m.type, m.uid)));
  const countByKey = new Map(manifestData.locations.map((m) => [fileKey(m.type, m.uid), m.alert_count]));

  const topLevel = locations
    .filter((l) => l.type === 'oblast' || l.type === 'special_city')
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  selectEl.innerHTML = '';

  for (const top of topLevel) {
    const group = document.createElement('optgroup');
    group.label = top.name;

    const topOpt = makeOption(top, '', withData, countByKey);
    group.appendChild(topOpt);

    if (top.type === 'oblast') {
      const raions = locations
        .filter((l) => l.type === 'raion' && l.parent_oblast_uid === top.uid)
        .sort((a, b) => a.name.localeCompare(b.name, 'uk'));

      for (const raion of raions) {
        group.appendChild(makeOption(raion, '  ', withData, countByKey));

        const hromadas = locations
          .filter((l) => l.type === 'hromada' && l.parent_raion_uid === raion.uid)
          .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
        for (const h of hromadas) {
          group.appendChild(makeOption(h, '    ', withData, countByKey));
        }
      }
    }

    selectEl.appendChild(group);
  }
}

function makeOption(loc, indent, withData, countByKey) {
  const key = fileKey(loc.type, loc.uid);
  const opt = document.createElement('option');
  opt.value = key;
  const has = withData.has(key);
  const count = countByKey.get(key);
  opt.textContent = `${indent}${loc.name}${has ? ` (${count})` : ' — немає даних'}`;
  opt.disabled = !has;
  return opt;
}

export function getSelectionFromHash(fallback) {
  const h = window.location.hash.replace('#', '');
  return h || fallback;
}

export function setHash(value) {
  history.replaceState(null, '', `#${value}`);
}
