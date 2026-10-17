// Pack connected components into shelves; source order breaks ties deterministically.
// Placement communicates proximity, never chronology or learning order.
export function layoutCompactGraph(ids, edges, { nodeWidth = 120, nodeHeight = 32, maxWidth = 960 } = {}) {
  const padding = 16, gapY = 32, componentGap = 32;
  const targetWidth = Math.max(nodeWidth + padding * 2, maxWidth);
  // Give desktop routes more room without losing a viable two-column narrow layout.
  const gapX = Math.min(40, Math.max(24, targetWidth - padding * 2 - nodeWidth * 2));
  const neighbors = new Map([...new Set(ids)].map(id => [id, new Set()]));
  for (const edge of edges) {
    if (!neighbors.has(edge.from) || !neighbors.has(edge.to)) continue;
    neighbors.get(edge.from).add(edge.to); neighbors.get(edge.to).add(edge.from);
  }
  const remaining = new Set(neighbors.keys()), components = [];
  for (const first of neighbors.keys()) {
    if (!remaining.delete(first)) continue;
    const component = [first];
    for (let i = 0; i < component.length; i++) {
      for (const next of neighbors.get(component[i])) if (remaining.delete(next)) component.push(next);
    }
    components.push(component);
  }
  components.sort((a, b) => b.length - a.length);
  const maxColumns = Math.max(1, Math.floor((targetWidth - padding * 2 + gapX) / (nodeWidth + gapX)));
  const positions = new Map();
  let x = padding, y = padding, shelfHeight = 0, right = padding;
  for (const component of components) {
    const columns = Math.min(maxColumns, Math.ceil(Math.sqrt(component.length)));
    const width = columns * (nodeWidth + gapX) - gapX;
    const height = Math.ceil(component.length / columns) * (nodeHeight + gapY) - gapY;
    if (x > padding && x + width + padding > targetWidth) {
      x = padding; y += shelfHeight + componentGap; shelfHeight = 0;
    }
    component.forEach((id, index) => positions.set(id, {
      x: x + index % columns * (nodeWidth + gapX),
      y: y + Math.floor(index / columns) * (nodeHeight + gapY),
    }));
    right = Math.max(right, x + width);
    shelfHeight = Math.max(shelfHeight, height);
    x += width + Math.min(componentGap, gapX);
  }
  return { positions, nodeWidth, nodeHeight, width: right + padding, height: Math.max(80, y + shelfHeight + padding) };
}

export function layoutCategory(ids, edges, maxWidth = 960) {
  return layoutCompactGraph(ids, edges, { maxWidth });
}
