// Deterministic component layout: no chronology or learning order is inferred.
// Cycles and shared destinations are drawn once per category, not recursively expanded.
export function layoutCategory(ids, edges) {
  const neighbors = new Map(ids.map(id => [id, new Set()]));
  for (const edge of edges) {
    neighbors.get(edge.from)?.add(edge.to); neighbors.get(edge.to)?.add(edge.from);
  }
  const remaining = new Set(ids), positions = new Map();
  let top = 24, width = 380;
  while (remaining.size) {
    const first = remaining.values().next().value, component = [], queue = [first];
    remaining.delete(first);
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]; component.push(id);
      for (const next of neighbors.get(id) || []) if (remaining.delete(next)) queue.push(next);
    }
    const inside = edges.filter(edge => component.includes(edge.from) && component.includes(edge.to));
    const roots = component.filter(id => !inside.some(edge => edge.to === id));
    const rank = new Map((roots.length ? roots : [first]).map(id => [id, 0]));
    const pending = [...rank.keys()];
    for (let i = 0; i < pending.length; i++) {
      const id = pending[i];
      for (const edge of inside.filter(edge => edge.from === id)) if (!rank.has(edge.to)) {
        rank.set(edge.to, rank.get(id) + 1); pending.push(edge.to);
      }
    }
    for (const id of component) if (!rank.has(id)) rank.set(id, 0);
    const rows = new Map();
    for (const id of component) {
      const column = rank.get(id), row = rows.get(column) || 0;
      positions.set(id, { x: 24 + column * 232, y: top + row * 94 });
      rows.set(column, row + 1);
      width = Math.max(width, 48 + column * 232 + 168);
    }
    top += Math.max(...rows.values()) * 94 + 28;
  }
  return { positions, width, height: Math.max(120, top) };
}
