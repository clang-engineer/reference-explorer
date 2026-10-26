const { test } = require('node:test');
const assert = require('node:assert/strict');

test('card widths are bounded before layout; available space determines column count', async () => {
  const { cardGrid } = await import('../src/graph/card-grid.js');
  for (const available of [288, 360, 650, 900, 1440, 2400]) {
    const grid = cardGrid(available, 5);
    assert.ok(grid.width <= 480);
    assert.ok(grid.columns * grid.width + (grid.columns - 1) * 16 <= available);
    assert.equal(grid.graphWidth, grid.width - 2);
  }
  assert.equal(cardGrid(650, 5).columns, 1);
  assert.equal(cardGrid(900, 5).columns, 2);
  assert.equal(cardGrid(2400, 1).columns, 1);
  assert.equal(cardGrid(1111, 8).columns, 2);
  assert.equal(cardGrid(1112, 8).columns, 3);
  assert.equal(cardGrid(3840, 8).columns, 3);
});

test('long relation graphs flow down inside card width without shrinking nodes', async () => {
  const { layoutToolHierarchy } = await import('../src/graph/tool-hierarchy.js');
  const { routeConnections } = await import('../src/graph/routing.js');
  const ids = Array.from({ length: 16 }, (_, i) => `tool-${i}`);
  const edges = ids.slice(1).map((id, i) => ({ from: ids[i], to: id }));
  const hierarchy = { ids, groups: new Map(), owners: new Map() };
  const wide = layoutToolHierarchy(hierarchy, edges, 478);
  const narrow = layoutToolHierarchy(hierarchy, edges, 286);
  assert.ok(wide.width <= 478);
  assert.ok(narrow.width <= 286);
  assert.ok(narrow.height > wide.height);
  assert.equal(narrow.nodeWidth, wide.nodeWidth);
  assert.equal(narrow.nodeHeight, wide.nodeHeight);
  for (const layout of [wide, narrow]) {
    assert.equal(routeConnections(layout, edges).length, edges.length);
    for (const p of layout.positions.values()) assert.ok(p.x + layout.nodeWidth <= layout.width);
  }
});

test('expanded host extensions also wrap vertically within the card', async () => {
  const { layoutToolHierarchy } = await import('../src/graph/tool-hierarchy.js');
  const children = Array.from({ length: 8 }, (_, i) => `plugin-${i}`);
  const hierarchy = { ids: ['host', ...children], groups: new Map([['host', children]]), owners: new Map(children.map(id => [id, 'host'])) };
  for (const width of [168, 286, 478]) {
    const layout = layoutToolHierarchy(hierarchy, [], width);
    assert.ok(layout.width <= width);
    assert.equal(layout.nodeWidth, 120);
    for (const p of layout.positions.values()) assert.ok(p.x + layout.nodeWidth <= layout.width);
  }
});
