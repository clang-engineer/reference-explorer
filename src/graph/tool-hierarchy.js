import { layoutCategory } from './layout.js';

// Expanded extensions form a box below their host; containment is not a tool-relation edge.
export function layoutToolHierarchy(hierarchy, edges, maxWidth) {
  const visible = new Set(hierarchy.ids);
  const expanded = new Map([...hierarchy.groups]
    .map(([host, ids]) => [host, ids.filter(id => visible.has(id))])
    .filter(([, ids]) => ids.length));
  if (!expanded.size) return { ...layoutCategory(hierarchy.ids, edges, maxWidth), frames: [] };
  const padding = 16, nodeWidth = 120, nodeHeight = 32;
  const targetWidth = Math.max(nodeWidth + padding * 2, maxWidth);
  const gapX = Math.min(40, Math.max(24, targetWidth - padding * 2 - nodeWidth * 2));
  const base = hierarchy.ids.filter(id => !hierarchy.owners.has(id));
  const unitEdges = edges.map(edge => ({ from: hierarchy.owners.get(edge.from) || edge.from, to: hierarchy.owners.get(edge.to) || edge.to })).filter(edge => edge.from !== edge.to);
  const order = [...layoutCategory(base, unitEdges, targetWidth).positions]
    .sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x).map(([id]) => id);
  const positions = new Map(), frames = [];
  let x = padding, y = padding, shelfHeight = 0, right = padding;
  for (const host of order) {
    const children = expanded.get(host) || [];
    const columns = children.length ? Math.min(3, children.length, Math.max(1, Math.floor((targetWidth - padding * 2 - 4) / 132))) : 1;
    const width = children.length ? columns * 132 + 4 : nodeWidth;
    const height = children.length ? 48 + Math.ceil(children.length / columns) * 44 : nodeHeight;
    if (x > padding && x + width + padding > targetWidth) {
      x = padding; y += shelfHeight + 32; shelfHeight = 0;
    }
    positions.set(host, { x: x + (children.length ? 8 : 0), y: y + (children.length ? 8 : 0) });
    children.forEach((id, index) => positions.set(id, { x: x + 8 + index % columns * 132, y: y + 52 + Math.floor(index / columns) * 44 }));
    if (children.length) frames.push({ host, x, y, width, height });
    right = Math.max(right, x + width); shelfHeight = Math.max(shelfHeight, height);
    x += width + Math.min(32, gapX);
  }
  return { positions, frames, nodeWidth, nodeHeight, width: right + padding, height: y + shelfHeight + padding };
}
