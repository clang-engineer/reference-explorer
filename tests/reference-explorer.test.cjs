const { test } = require('node:test');
const assert = require('node:assert/strict');

const catalog = {
  version: 1,
  tool_map: {
    categories: [{
      name: 'Search',
      commands: [{ name: 'grep' }],
      relations: [{ from: 'grep', to: 'rg', relation: 'alternative', solution: 'fast search' }],
    }],
  },
  cheatsheets: {
    groups: [{
      title: 'Shell',
      items: [{ slug: 'rg', name: 'ripgrep', custom: { label: 'Guide', url: 'https://example.com/rg' } }],
    }],
  },
};

test('devkit adapter builds an explorer model from catalog data', async () => {
  const { fromDevkitCatalog } = await import('../src/adapters/devkit.js');
  const model = fromDevkitCatalog(catalog);
  assert.ok(model.tools.has('grep'));
  assert.ok(model.tools.has('ripgrep'));
  assert.equal(model.edges.length, 1);
  assert.equal(model.edges[0].from, 'grep');
  assert.equal(model.edges[0].to, 'ripgrep');
  assert.ok(model.tools.get('ripgrep').custom.some(link => link.url === 'https://example.com/rg'));
});

test('public module exports mount', async () => {
  const api = await import('../src/index.js');
  assert.equal(typeof api.mount, 'function');
});

test('custom element module defines reference-explorer', async () => {
  const registry = new Map();
  globalThis.HTMLElement = class {};
  globalThis.customElements = {
    get: name => registry.get(name),
    define: (name, value) => registry.set(name, value),
  };
  await import('../src/element.js');
  assert.equal(typeof registry.get('reference-explorer'), 'function');
  delete globalThis.HTMLElement;
  delete globalThis.customElements;
});
