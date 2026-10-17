// Route through free gutters, with distinct ports and a cost for reusing a lane.
// Crossings can remain in dense graphs; paths must never cut through a node.
class MinHeap {
  items = [];
  push(entry) {
    const items = this.items;
    let index = items.length;
    items.push(entry);
    while (index && items[(index - 1) >> 1][0] > entry[0]) {
      items[index] = items[(index - 1) >> 1]; index = (index - 1) >> 1;
    }
    items[index] = entry;
  }
  pop() {
    const items = this.items, first = items[0], last = items.pop();
    if (!items.length) return first;
    let index = 0;
    while (index * 2 + 1 < items.length) {
      let child = index * 2 + 1;
      if (child + 1 < items.length && items[child + 1][0] < items[child][0]) child++;
      if (items[child][0] >= last[0]) break;
      items[index] = items[child]; index = child;
    }
    items[index] = last;
    return first;
  }
}

function portsFor(layout, edges) {
  const { positions, nodeWidth: width, nodeHeight: height } = layout;
  const sides = new Map([...positions.keys()].map(id => [id, { top: [], right: [], bottom: [], left: [] }]));
  function assign(id, other, selfSide) {
    const from = positions.get(id), to = positions.get(other);
    const dx = to.x - from.x, dy = to.y - from.y;
    const primary = id === other ? selfSide : Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
    const vertical = primary === 'top' || primary === 'bottom';
    const order = vertical ? [primary, dx >= 0 ? 'right' : 'left', dx >= 0 ? 'left' : 'right', primary === 'top' ? 'bottom' : 'top']
      : [primary, dy >= 0 ? 'bottom' : 'top', dy >= 0 ? 'top' : 'bottom', primary === 'right' ? 'left' : 'right'];
    const groups = sides.get(id);
    const capacity = side => Math.max(1, Math.floor(((side === 'top' || side === 'bottom' ? width : height) - 12) / 8));
    const score = side => Math.floor(groups[side].length / capacity(side)) * 4 + order.indexOf(side);
    const side = order.reduce((best, side) => score(side) < score(best) ? side : best, primary);
    const port = { side, node: from };
    groups[side].push(port);
    return port;
  }
  const ports = edges.map(edge => positions.has(edge.from) && positions.has(edge.to)
    ? [assign(edge.from, edge.to, 'top'), assign(edge.to, edge.from, 'right')] : null);
  for (const groups of sides.values()) for (const [side, ports] of Object.entries(groups)) {
    ports.forEach((port, index) => {
      const { x, y } = port.node;
      const fraction = (index + 1) / (ports.length + 1);
      const horizontal = side === 'top' || side === 'bottom';
      port.pin = horizontal ? { x: x + width * fraction, y: y + (side === 'bottom' ? height : 0) }
        : { x: x + (side === 'right' ? width : 0), y: y + height * fraction };
      port.outside = { x: port.pin.x + (side === 'right' ? 8 : side === 'left' ? -8 : 0), y: port.pin.y + (side === 'bottom' ? 8 : side === 'top' ? -8 : 0) };
    });
  }
  return ports;
}

function simplify(points) {
  const result = [];
  for (const point of points) {
    const last = result.at(-1), before = result.at(-2);
    if (last?.x === point.x && last?.y === point.y) continue;
    if (before && ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y))) result.pop();
    result.push(point);
  }
  return result;
}

export function routeConnections(layout, edges) {
  if (!edges.length) return [];
  const ports = portsFor(layout, edges);
  const xs = new Set([4, layout.width - 4]), ys = new Set([4, layout.height - 4]);
  const boxes = [...layout.positions.values()].map(point => {
    for (const offset of [8, 12]) {
      xs.add(point.x - offset); xs.add(point.x + layout.nodeWidth + offset);
      ys.add(point.y - offset); ys.add(point.y + layout.nodeHeight + offset);
    }
    return { left: point.x - 3, right: point.x + layout.nodeWidth + 3, top: point.y - 3, bottom: point.y + layout.nodeHeight + 3 };
  });
  for (const pair of ports) for (const port of pair || []) { xs.add(port.outside.x); ys.add(port.outside.y); }
  const x = [...xs].sort((a, b) => a - b), y = [...ys].sort((a, b) => a - b);
  const columns = x.length, size = columns * y.length;
  const xIndex = new Map(x.map((value, index) => [value, index]));
  const yIndex = new Map(y.map((value, index) => [value, index]));
  const point = index => ({ x: x[index % columns], y: y[Math.floor(index / columns)] });
  const indexOf = point => yIndex.get(point.y) * columns + xIndex.get(point.x);
  const segmentKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const occupied = new Map(), visited = new Set(), adjacency = new Map();
  function neighbors(index) {
    if (adjacency.has(index)) return adjacency.get(index);
    const from = point(index), col = index % columns, row = Math.floor(index / columns);
    const result = [];
    for (const [nextCol, nextRow, direction] of [[col - 1, row, 1], [col + 1, row, 1], [col, row - 1, 2], [col, row + 1, 2]]) {
      if (nextCol < 0 || nextCol >= columns || nextRow < 0 || nextRow >= y.length) continue;
      const next = nextRow * columns + nextCol, to = point(next);
      const blocked = boxes.some(box => direction === 1
        ? from.y > box.top && from.y < box.bottom && Math.max(from.x, to.x) > box.left && Math.min(from.x, to.x) < box.right
        : from.x > box.left && from.x < box.right && Math.max(from.y, to.y) > box.top && Math.min(from.y, to.y) < box.bottom);
      if (!blocked) result.push({ next, direction, distance: Math.abs(from.x - to.x) + Math.abs(from.y - to.y) });
    }
    adjacency.set(index, result);
    return result;
  }
  return ports.map(pair => {
    if (!pair) return null;
    const [source, target] = pair, start = indexOf(source.outside), end = indexOf(target.outside);
    const heuristic = index => { const p = point(index); return Math.abs(p.x - target.outside.x) + Math.abs(p.y - target.outside.y); };
    const costs = new Float64Array(size * 3).fill(Infinity);
    const previous = new Int32Array(size * 3).fill(-1);
    const queue = new MinHeap();
    costs[start * 3] = 0; queue.push([heuristic(start), start * 3]);
    let finish = -1;
    while (queue.items.length) {
      const [priority, state] = queue.pop(), index = Math.floor(state / 3), direction = state % 3;
      if (priority > costs[state] + heuristic(index) + 1e-6) continue;
      if (index === end) { finish = state; break; }
      for (const step of neighbors(index)) {
        const key = segmentKey(index, step.next), nextState = step.next * 3 + step.direction;
        const cost = costs[state] + step.distance * (1 + (occupied.get(key) || 0) * 12)
          + (direction && direction !== step.direction ? 6 : 0) + (visited.has(step.next) ? 10 : 0);
        if (cost >= costs[nextState]) continue;
        costs[nextState] = cost; previous[nextState] = state;
        queue.push([cost + heuristic(step.next), nextState]);
      }
    }
    if (finish < 0) throw new Error('No free connection route');
    const route = [];
    for (let state = finish; state >= 0; state = previous[state]) route.push(Math.floor(state / 3));
    route.reverse();
    for (let i = 1; i < route.length; i++) {
      const key = segmentKey(route[i - 1], route[i]);
      occupied.set(key, (occupied.get(key) || 0) + 1); visited.add(route[i]);
    }
    const points = simplify([source.pin, ...route.map(point), target.pin]);
    const path = points.map((point, index) => `${index ? 'L' : 'M'}${Number(point.x.toFixed(3))},${Number(point.y.toFixed(3))}`).join(' ');
    return { path, points };
  });
}
