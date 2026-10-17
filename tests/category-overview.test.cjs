const { test } = require('node:test');
const assert = require('node:assert/strict');

async function fixture() {
  const { buildModel } = await import('../src/core/catalog.js');
  return buildModel({ categories: [
    { name: 'Text Search', commands: [{ name: 'rg' }, { name: 'grep' }], relations: [{ from: 'grep', to: 'rg', relation: 'alternative' }] },
    { name: 'Navigation', commands: [{ name: 'ripgrep' }, { name: 'fzf' }], relations: [] },
    { name: 'Command History', commands: [{ name: 'fzf' }, { name: 'ripgrep' }], relations: [] },
    { name: 'Editors', commands: [{ name: 'vim' }], relations: [] },
  ] });
}

test('macro links count unique shared tools, never infer tool relations between categories', async () => {
  const { buildCategoryOverview } = await import('../src/core/category-overview.js');
  const model = await fixture();
  const before = JSON.stringify([...model.tools.values()]);
  const graph = buildCategoryOverview(model);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.toolCount, 4);
  assert.equal(graph.relationCount, 1);
  assert.equal(graph.links.length, 3);
  const link = graph.links.find(link => link.from === 'map-1' && link.to === 'map-2');
  assert.deepEqual(new Set(link.tools.map(tool => tool.id)), new Set(['ripgrep', 'fzf']));
  assert.equal(graph.nodes[0].relationCount, 1);
  assert.equal(graph.nodes[1].relationCount, 0);
  assert.equal(graph.nodes[0].toolCount, 2);
  assert.ok(!graph.links.some(link => link.from === 'map-3' || link.to === 'map-3'));
  assert.ok(!graph.links.some(link => link.from === link.to || 'relation' in link));
  assert.equal(JSON.stringify([...model.tools.values()]), before);
});

test('membership duplicates and stale category IDs do not inflate macro counts', async () => {
  const { buildCategoryOverview } = await import('../src/core/category-overview.js');
  const model = await fixture();
  model.tools.get('ripgrep').categories.push('map-0', 'missing');
  const graph = buildCategoryOverview(model);
  assert.equal(graph.nodes[0].toolCount, 2);
  assert.equal(graph.links.find(link => link.from === 'map-0' && link.to === 'map-1').tools.length, 1);
  assert.ok(!graph.links.some(link => link.from === 'missing' || link.to === 'missing'));
});

test('internal tool relations alone do not produce macro links', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { buildCategoryOverview } = await import('../src/core/category-overview.js');
  const model = buildModel({ categories: [{ name: 'Search', commands: [], relations: [{ from: 'grep', to: 'rg', relation: 'alternative' }] }] });
  const graph = buildCategoryOverview(model);
  assert.equal(graph.nodes[0].toolCount, 2);
  assert.equal(graph.nodes[0].relationCount, 1);
  assert.deepEqual(graph.links, []);
});

test('macro renderer exposes every category once, distinguishes shared membership, and supports compact layout', async () => {
  const { buildCategoryOverview } = await import('../src/core/category-overview.js');
  const { categoryOverviewHtml } = await import('../src/graph/category-overview.js');
  const graph = buildCategoryOverview(await fixture());
  for (const compact of [false, true]) {
    const html = categoryOverviewHtml(graph, { compact });
    for (const node of graph.nodes) {
      assert.equal(html.split(`data-open-map="${node.id}"`).length - 1, 1);
    }
    assert.ok(html.includes('공통 도구 2개:'));
    assert.ok(html.includes('공통 도구 없는 분류 · 1개'));
    assert.ok(html.includes('내부 관계 1'));
    assert.ok(!html.includes('marker-end'));
    assert.equal((html.match(/<svg /g) || []).length, 1);
    assert.ok(html.includes(`<rect width="${compact ? 112 : 176}" height="48"`));
    assert.ok(!html.includes('dk-macro-cluster'));
  }
});

test('macro renderer escapes upstream names and handles an empty catalog', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { buildCategoryOverview } = await import('../src/core/category-overview.js');
  const { categoryOverviewHtml } = await import('../src/graph/category-overview.js');
  const model = buildModel({ categories: [
    { name: '<script>unsafe</script>', commands: [{ name: '<tool>' }], relations: [] },
    { name: 'Other', commands: [{ name: '<tool>' }], relations: [] },
  ] });
  const html = categoryOverviewHtml(buildCategoryOverview(model));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<tool>'));
  assert.ok(html.includes('&lt;tool&gt;'));
  assert.ok(categoryOverviewHtml(buildCategoryOverview(buildModel({ categories: [] }))).includes('0개 분류'));
});

test('macro hash is additive, preserves scope and expanded state, and rejects unknown modes', async () => {
  const { navigationGroups, readExplorerHash } = await import('../src/core/navigation.js');
  const model = await fixture();
  const groups = navigationGroups(model);
  const hash = '#' + new URLSearchParams({ scope: 'all', overview: 'macro', open: `${groups[0].id},map-0` });
  const state = readExplorerHash(hash, model, groups);
  assert.equal(state.overviewMode, 'macro');
  assert.equal(state.category, 'all');
  assert.ok(state.expanded.has('map-0'));
  assert.equal(readExplorerHash('#overview=unknown', model, groups).overviewMode, 'explore');
  assert.equal(readExplorerHash('', model, groups).overviewMode, 'explore');
});
