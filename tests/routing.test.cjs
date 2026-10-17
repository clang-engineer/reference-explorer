const { test } = require('node:test');
const assert = require('node:assert/strict');

function assertClear(layout, routes) {
  for (const route of routes) {
    assert.ok(route && !/NaN|undefined|Infinity/.test(route.path));
    for (const point of route.points) {
      assert.ok(point.x >= 0 && point.x <= layout.width);
      assert.ok(point.y >= 0 && point.y <= layout.height);
    }
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      assert.ok(a.x === b.x || a.y === b.y, 'segments must be orthogonal');
      for (const node of layout.positions.values()) {
        const epsilon = 1e-6;
        const crosses = a.y === b.y
          ? a.y > node.y + epsilon && a.y < node.y + layout.nodeHeight - epsilon && Math.max(a.x, b.x) > node.x + epsilon && Math.min(a.x, b.x) < node.x + layout.nodeWidth - epsilon
          : a.x > node.x + epsilon && a.x < node.x + layout.nodeWidth - epsilon && Math.max(a.y, b.y) > node.y + epsilon && Math.min(a.y, b.y) < node.y + layout.nodeHeight - epsilon;
        assert.ok(!crosses, 'connections must not cross a node interior');
      }
    }
  }
}

function assertArrivesAtTarget(layout, edge, route) {
  const node = layout.positions.get(edge.to), end = route.points.at(-1), previous = route.points.at(-2);
  assert.ok((end.x === node.x && previous.x < end.x) || (end.x === node.x + layout.nodeWidth && previous.x > end.x)
    || (end.y === node.y && previous.y < end.y) || (end.y === node.y + layout.nodeHeight && previous.y > end.y));
}

test('long connections detour around intermediate nodes instead of passing through them', async () => {
  const { routeConnections } = await import('../src/graph/routing.js');
  const layout = { positions: new Map([['a', { x: 16, y: 16 }], ['b', { x: 160, y: 16 }], ['c', { x: 304, y: 16 }]]), nodeWidth: 120, nodeHeight: 32, width: 440, height: 80 };
  const edges = [{ from: 'a', to: 'c' }, { from: 'c', to: 'a' }];
  const routes = routeConnections(layout, edges);
  assertClear(layout, routes);
  routes.forEach((route, index) => assertArrivesAtTarget(layout, edges[index], route));
  assert.notEqual(routes[0].path, routes[1].path);
});

test('parallel and reverse relations receive distinct ports and readable arrowhead spacing', async () => {
  const { layoutCategory } = await import('../src/graph/layout.js');
  const { routeConnections } = await import('../src/graph/routing.js');
  const edges = Array.from({ length: 8 }, (_, index) => ({ from: index % 2 ? 'b' : 'a', to: index % 2 ? 'a' : 'b' }));
  const layout = layoutCategory(['a', 'b'], edges, 400);
  const routes = routeConnections(layout, edges);
  assertClear(layout, routes);
  assert.equal(new Set(routes.map(route => route.path)).size, edges.length);
  routes.forEach((route, index) => {
    assertArrivesAtTarget(layout, edges[index], route);
    for (let other = index + 1; other < routes.length; other++) {
      if (edges[index].to !== edges[other].to) continue;
      const a = route.points.at(-1), b = routes[other].points.at(-1);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 6, 'arrowheads need separate attachment points');
    }
  });
});

test('shared destinations, cycles and self-relations are deterministic and avoid all node interiors', async () => {
  const { layoutCategory } = await import('../src/graph/layout.js');
  const { routeConnections } = await import('../src/graph/routing.js');
  const ids = Array.from({ length: 12 }, (_, index) => 'tool-' + index);
  const edges = ids.slice(1).map(id => ({ from: id, to: ids[0] }));
  edges.push({ from: ids[0], to: ids[1] }, { from: ids[0], to: ids[0] });
  for (const maxWidth of [300, 960]) {
    const layout = layoutCategory(ids, edges, maxWidth), before = structuredClone(layout);
    const routes = routeConnections(layout, edges);
    assertClear(layout, routes);
    routes.forEach((route, index) => assertArrivesAtTarget(layout, edges[index], route));
    assert.deepEqual(routeConnections(layout, edges), routes);
    assert.deepEqual(layout, before);
  }
});

test('empty and stale edges are handled without drawing an invalid path', async () => {
  const { layoutCategory } = await import('../src/graph/layout.js');
  const { routeConnections } = await import('../src/graph/routing.js');
  const layout = layoutCategory(['a'], []);
  assert.deepEqual(routeConnections(layout, []), []);
  assert.deepEqual(routeConnections(layout, [{ from: 'a', to: 'missing' }]), [null]);
});
