// Session-only node coordinates, scoped to a category (never written to storage).
export const positionKey = (category, id) => JSON.stringify([category, id]);

export function applyManualPositions(layout, category, positions) {
  if (!positions?.size) return layout;
  const boxes = [...(layout.frames || []), ...(layout.sections || [])].map(box => ({
    box,
    members: [...layout.positions].filter(([, p]) => p.x >= box.x && p.y >= box.y &&
      p.x + layout.nodeWidth <= box.x + box.width && p.y + layout.nodeHeight <= box.y + box.height).map(([id]) => id),
  }));
  for (const [id] of layout.positions) {
    const saved = positions.get(positionKey(category, id));
    const point = saved && { x: Math.min(saved.x, (layout.cardWidth ?? Infinity) - layout.nodeWidth - 16), y: saved.y };
    // Expanding a host or changing width can put a newly laid-out node here.
    // Keep the saved coordinate, but do not apply it while that space is occupied.
    if (point && canMoveNode(layout, id, point)) layout.positions.set(id, { ...point });
  }
  for (const { box, members } of boxes) {
    if (!members.length) continue;
    const points = members.map(id => layout.positions.get(id));
    const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
    const right = Math.max(...points.map(p => p.x + layout.nodeWidth));
    const bottom = Math.max(...points.map(p => p.y + layout.nodeHeight));
    box.x = Math.max(0, left - 12); box.y = Math.max(0, top - 28);
    box.width = right + 12 - box.x; box.height = bottom + 12 - box.y;
  }
  layout.width = Math.min(layout.cardWidth ?? Infinity, Math.max(layout.width, ...[...layout.positions.values()].map(p => p.x + layout.nodeWidth + 24)));
  layout.height = Math.max(layout.height, ...[...layout.positions.values()].map(p => p.y + layout.nodeHeight + 24));
  return layout;
}

export function canMoveNode(layout, id, point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 16 && point.y >= 32 &&
    point.x + layout.nodeWidth + 16 <= (layout.cardWidth ?? Infinity) &&
    [...layout.positions].every(([other, p]) => other === id ||
      point.x + layout.nodeWidth + 12 <= p.x || p.x + layout.nodeWidth + 12 <= point.x ||
      point.y + layout.nodeHeight + 12 <= p.y || p.y + layout.nodeHeight + 12 <= point.y);
}
