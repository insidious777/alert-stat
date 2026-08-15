const cache = new Map();

export async function loadJson(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const data = await res.json();
  cache.set(url, data);
  return data;
}
