export function tldrPaths(value) {
  const name = String(value || '').replace(/\.md$/, '');
  if (!/^(?:(?:common|linux|osx|windows|freebsd|openbsd|netbsd|android|sunos)\/)?[a-zA-Z0-9_.+-]+$/.test(name)) return [];
  return name.includes('/') ? [name] : ['common/', 'linux/', 'osx/', 'windows/'].map(platform => platform + name);
}
export function parseTldr(text) {
  const examples = []; let description = '';
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('- ')) description = line.slice(2).trim();
    const match = /^\s*`([^`]+)`\s*$/.exec(line);
    if (match) { examples.push({ description, command: match[1] }); description = ''; }
    if (examples.length === 6) break;
  }
  return examples;
}

// Cache is scoped to one mounted explorer, never shared with another page.
// Aborted/error requests are not cached; 404 is a valid empty result.
export function createTldrClient(fetchImpl = globalThis.fetch) {
  const cache = new Map();
  return {
    async load(value, { signal } = {}) {
      signal?.throwIfAborted();
      if (cache.has(value)) return cache.get(value);
      for (const path of tldrPaths(value)) {
        const timeout = AbortSignal.timeout(10000);
        const response = await fetchImpl(
          `https://raw.githubusercontent.com/tldr-pages/tldr/main/pages/${path}.md`,
          { cache: 'no-cache', signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
        );
        signal?.throwIfAborted();
        if (response.status === 404) continue;
        if (!response.ok) throw new Error('tldr request failed');
        const examples = parseTldr(await response.text());
        signal?.throwIfAborted();
        const result = { examples, path };
        cache.set(value, result);
        return result;
      }
      cache.set(value, null);
      return null;
    },
    clear() { cache.clear(); },
  };
}
