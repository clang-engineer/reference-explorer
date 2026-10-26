const { test } = require('node:test');
const assert = require('node:assert/strict');
const { catalog } = require('./fixtures/taxonomy.cjs');
async function fixture() {
  const { buildModel } = await import('../src/core/catalog.js');
  return buildModel(catalog());
}

test('catalog metadata controls categories, tags, domains and hosts without mutating source records', async () => {
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const source = await fixture(), before = structuredClone(source);
  const model = classifyExplorerModel(source);
  assert.deepEqual(model.categories, source.categories);
  assert.deepEqual(model.domains, source.domains);
  assert.equal(model.tools.size, source.tools.size);
  assert.deepEqual(model.tools.get('zsh').categories, ['role:shell']);
  assert.deepEqual(model.tools.get('zsh').categoryTags['role:shell'], ['base', 'frameworks', 'prompt']);
  assert.deepEqual(model.tools.get('vim-dadbod').categories, ['role:database']);
  assert.equal(model.edges[0].solution, 'Framework setup');
  assert.equal(model.edges[0].category, 'role:shell');
  assert.deepEqual(source, before);
});

test('tag filtering narrows registered memberships and edges while search remains global', async () => {
  const { navigationGroups, explorerFilter } = await import('../src/core/navigation.js');
  const model = await fixture(), groups = navigationGroups(model);
  const filtered = explorerFilter(model, groups, 'role:shell', '', 'frameworks');
  assert.deepEqual(filtered.visible, new Set(['zsh', 'oh-my-zsh']));
  assert.equal(filtered.edges.length, 1);
  assert.equal(explorerFilter(model, groups, 'role:shell').visible.size, 7);
  assert.deepEqual(explorerFilter(model, groups, 'role:shell', '', 'invalid'), explorerFilter(model, groups, 'role:shell'));
  assert.ok(explorerFilter(model, groups, 'role:shell', 'psql', 'frameworks').matches.has('psql'));
  assert.deepEqual(explorerFilter(model, groups, 'role:database', '', 'neovim').visible, new Set(['vim-dadbod', 'vim-dadbod-completion']));
});

test('data-owned aliases preserve old category links, expanded state and tag selection', async () => {
  const { navigationGroups, readExplorerHash } = await import('../src/core/navigation.js');
  const model = await fixture(), groups = navigationGroups(model);
  for (const requested of ['Shell Frameworks', 'map-2']) {
    const state = readExplorerHash('#' + new URLSearchParams({ scope: requested, open: 'map-2' }), model, groups);
    assert.equal(state.category, 'role:shell'); assert.equal(state.tag, 'frameworks');
    assert.ok(state.expanded.has('role:shell')); assert.ok(state.expanded.has('domain:terminal'));
  }
  assert.equal(readExplorerHash('#category=map-9', model, groups).category, 'role:database');
  assert.equal(readExplorerHash('#scope=Shell&tag=invalid', model, groups).tag, '');
  assert.equal(readExplorerHash('#scope=Shell&tag=prompt', model, groups).tag, 'prompt');
});

test('role views omit redundant source-category selectors', async () => {
  const { renderTagFilters } = await import('../src/ui/views.js');
  const model = await fixture();
  for (const scope of ['role:editor', 'role:shell', 'role:database', 'all']) {
    const target = { innerHTML: 'old controls', hidden: false };
    renderTagFilters(target, model, scope); assert.equal(target.hidden, true); assert.equal(target.innerHTML, '');
  }
});

test('names never imply categories, language kinds or extension hosts', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const { navigationGroups } = await import('../src/core/navigation.js');
  const source = buildModel({ categories: [{ id: 'custom', name: 'Neovim Plugins · AI', commands: [{ name: 'chezmoi' }, { name: 'rust' }, { name: 'neovim' }, { name: 'copilot.lua' }], relations: [] }] });
  const model = classifyExplorerModel(source);
  for (const tool of model.tools.values()) { assert.deepEqual(tool.categories, ['custom']); assert.deepEqual(tool.hostsByCategory, {}); }
  assert.equal(model.tools.get('rust').kind, 'tool');
  assert.equal(navigationGroups(model)[0].id, 'domain:reference');
  const renamed = catalog(); renamed.categories[0].name = 'Any display name';
  assert.equal(navigationGroups(buildModel(renamed))[0].categories[0].id, 'role:shell');
});

test('guide targets come from catalog data and do not inflate tool counts', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const source = buildModel({ tool_map: { categories: [{ name: 'Database', commands: [{ name: 'harlequin' }], relations: [] }] }, cheatsheets: { groups: [], guides: [{ slug: 'arbitrary-guide', name: 'Guide', kind: 'guide', related_tools: ['harlequin'], custom: { label: 'DB guide', url: 'https://example.com/guide' } }] } });
  const model = classifyExplorerModel(source);
  assert.equal(model.tools.size, 1); assert.equal(model.guides.length, 1);
  assert.ok(model.tools.get('harlequin').links.some(link => link.url === 'https://example.com/guide'));
  assert.equal(source.tools.size, 2); assert.equal(source.tools.get('harlequin').links.length, 0);
});

test('invalid taxonomy metadata is rejected at the model boundary', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  for (const mutate of [
    d => d.domains.push(d.domains[0]),
    d => d.categories.push(d.categories[0]),
    d => d.categories[0].domain = 'missing',
    d => d.categories[0].commands[0].tags = ['missing'],
    d => d.categories[0].commands[0].hosts = 'not-an-array',
  ]) { const data = catalog(); mutate(data); assert.throws(() => buildModel(data)); }
});
