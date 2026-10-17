const { test } = require('node:test');
const assert = require('node:assert/strict');

function assertNoOverlaps(layout, ids) {
  assert.equal(layout.positions.size, ids.length);
  for (const id of ids) {
    const point = layout.positions.get(id);
    assert.ok(point.x >= 0 && point.y >= 0);
    assert.ok(point.x + layout.nodeWidth <= layout.width);
    assert.ok(point.y + layout.nodeHeight <= layout.height);
    for (const other of ids) {
      if (id === other) continue;
      const next = layout.positions.get(other);
      assert.ok(point.x + layout.nodeWidth <= next.x || next.x + layout.nodeWidth <= point.x || point.y + layout.nodeHeight <= next.y || next.y + layout.nodeHeight <= point.y);
    }
  }
}

test('unconnected tools pack across the available width rather than stacking vertically', async () => {
  const { layoutCategory } = await import('../src/graph/layout.js');
  const ids = Array.from({ length: 30 }, (_, index) => 'tool-' + index);
  const wide = layoutCategory(ids, [], 960);
  const narrow = layoutCategory(ids, [], 300);
  assertNoOverlaps(wide, ids);
  assertNoOverlaps(narrow, ids);
  assert.ok(wide.height < 400);
  assert.ok(wide.width <= 960);
  assert.ok(narrow.width <= 300);
  assert.ok(narrow.height > wide.height);
  assert.equal(new Set([...narrow.positions.values()].map(point => point.x)).size, 2);
});

test('spacing increases without enlarging nodes or sacrificing two columns on narrow screens', async () => {
  const { layoutCategory } = await import('../src/graph/layout.js');
  const ids = ['a', 'b', 'c', 'd'];
  const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }];
  const wide = layoutCategory(ids, edges, 960);
  assert.equal(wide.nodeWidth, 120);
  assert.equal(wide.nodeHeight, 32);
  const x = [...new Set([...wide.positions.values()].map(point => point.x))].sort((a, b) => a - b);
  const y = [...new Set([...wide.positions.values()].map(point => point.y))].sort((a, b) => a - b);
  assert.equal(x[1] - x[0] - wide.nodeWidth, 40);
  assert.equal(y[1] - y[0] - wide.nodeHeight, 32);
  const narrow = layoutCategory(ids, edges, 300);
  assert.equal(new Set([...narrow.positions.values()].map(point => point.x)).size, 2);
  assert.ok(narrow.width <= 300);
  assertNoOverlaps(wide, ids);
  assertNoOverlaps(narrow, ids);
});

test('large connected graphs, cycles and isolated components stay compact and deterministic', async () => {
  const { layoutCompactGraph } = await import('../src/graph/layout.js');
  const ids = Array.from({ length: 44 }, (_, index) => 'node-' + index);
  const edges = ids.slice(0, 29).map((id, index) => ({ from: id, to: ids[index + 1] }));
  edges.push({ from: 'node-29', to: 'node-0' }, { from: 'node-3', to: 'node-3' });
  const layout = layoutCompactGraph(ids, edges, { maxWidth: 960 });
  assertNoOverlaps(layout, ids);
  assert.ok(layout.height < 600);
  assert.ok(layout.width <= 960);
  assert.deepEqual(layoutCompactGraph(ids, edges, { maxWidth: 960 }), layout);
});

test('empty and very narrow layouts remain finite', async () => {
  const { layoutCompactGraph } = await import('../src/graph/layout.js');
  const empty = layoutCompactGraph([], []);
  assert.equal(empty.positions.size, 0);
  assert.ok(Number.isFinite(empty.width) && Number.isFinite(empty.height));
  const narrow = layoutCompactGraph(['a', 'b'], [{ from: 'a', to: 'b' }], { maxWidth: 80 });
  assertNoOverlaps(narrow, ['a', 'b']);
  assert.equal(narrow.positions.get('a').x, narrow.positions.get('b').x);
});
