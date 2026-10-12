export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function fetchCatalog(url, { fetchImpl = globalThis.fetch, signal } = {}) {
  const response = await fetchImpl(url, {
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Catalog request failed');
  return response.json();
}
