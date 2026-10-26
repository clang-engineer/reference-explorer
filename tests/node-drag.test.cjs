const { test } = require('node:test');
const assert = require('node:assert/strict');

function layout() {
  return { width: 400, height: 240, nodeWidth: 120, nodeHeight: 32,
    positions: new Map([['a', { x: 24, y: 40 }], ['b', { x: 240, y: 40 }]]), frames: [], sections: [] };
}

test('manual coordinates are category-scoped, preserve node size, expand the canvas and reroute edges', async () => {
  const { applyManualPositions, positionKey, canMoveNode } = await import('../src/graph/manual-layout.js');
  const { routeConnections } = await import('../src/graph/routing.js');
  const positions = new Map([[positionKey('one', 'a'), { x: 500, y: 300 }]]);
  const original = layout();
  const before = routeConnections(original, [{ from: 'a', to: 'b' }])[0].path;
  const moved = applyManualPositions(layout(), 'one', positions);
  assert.equal(moved.nodeWidth, 120);
  assert.equal(moved.nodeHeight, 32);
  assert.ok(moved.width >= 644 && moved.height >= 356);
  assert.notEqual(routeConnections(moved, [{ from: 'a', to: 'b' }])[0].path, before);
  assert.deepEqual(applyManualPositions(layout(), 'two', positions).positions.get('a'), { x: 24, y: 40 });
  assert.deepEqual(applyManualPositions(layout(), 'one', new Map()).positions.get('a'), { x: 24, y: 40 });
  assert.equal(canMoveNode(original, 'a', { x: 250, y: 40 }), false);
  assert.equal(canMoveNode(original, 'a', { x: 24, y: 150 }), true);
});

test('extension frames follow their members without changing tool dimensions', async () => {
  const { applyManualPositions, positionKey } = await import('../src/graph/manual-layout.js');
  const value = layout();
  value.frames = [{ x: 12, y: 12, width: 144, height: 72 }];
  applyManualPositions(value, 'one', new Map([[positionKey('one', 'a'), { x: 500, y: 300 }]]));
  const frame = value.frames[0];
  assert.ok(frame.x <= 500 && frame.x + frame.width >= 620);
  assert.ok(frame.y <= 300 && frame.y + frame.height >= 332);
});

async function harness() {
  const { enableNodeDragging, registerDraggableBoard } = await import('../src/ui/node-drag.js');
  const handlers = new Map();
  let captured = false, redraws = 0;
  const stage = {
    ownerDocument: { defaultView: {
      requestAnimationFrame: () => 1, cancelAnimationFrame() {},
      DOMPoint: class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform(m) { return { x: this.x * m.scale, y: this.y * m.scale }; } },
    } },
    classList: { add() {}, remove() {} },
    addEventListener(type, callback) { handlers.set(type, callback); },
    setPointerCapture() { captured = true; }, hasPointerCapture() { return captured; }, releasePointerCapture() { captured = false; },
  };
  const board = {}, positions = new Map();
  registerDraggableBoard(board, { layout: layout(), category: 'one', positions, redraw() { redraws++; } });
  const node = { dataset: { tool: 'a' }, closest: () => board, ownerSVGElement: { getScreenCTM: () => ({ inverse: () => ({ scale: .5 }) }) } };
  enableNodeDragging(stage);
  function event(type, x = 0, y = 0) {
    const event = { type, pointerId: 1, button: 0, clientX: x, clientY: y, target: { closest: () => node },
      preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() { this.stopped = true; } };
    handlers.get(type)?.(event); return event;
  }
  return { event, positions, redraws: () => redraws, captured: () => captured };
}

test('ordinary clicks remain clicks; dragging accounts for zoom and suppresses the trailing click', async () => {
  const h = await harness();
  h.event('pointerdown'); h.event('pointermove', 2, 2); h.event('pointerup', 2, 2);
  assert.equal(h.positions.size, 0);
  assert.equal(h.event('click').stopped, undefined);
  h.event('pointerdown'); h.event('pointermove', 0, 160);
  assert.equal(h.captured(), true);
  h.event('pointerup', 0, 160);
  assert.deepEqual([...h.positions.values()][0], { x: 24, y: 120 });
  assert.equal(h.redraws(), 1);
  assert.equal(h.captured(), false);
  assert.equal(h.event('click').stopped, true);
  assert.equal(h.event('click').stopped, undefined);
});

test('pointer cancellation discards the pending move', async () => {
  const h = await harness();
  h.event('pointerdown'); h.event('pointermove', 0, 160); h.event('pointercancel');
  assert.equal(h.positions.size, 0);
  assert.equal(h.captured(), false);
});
