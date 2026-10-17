// Shared membership is not a tool relation, workflow, or learning order.
export function buildCategoryOverview(model) {
  const nodes = model.categories.map(category => ({ ...category, toolCount: 0, relationCount: 0 }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const pairs = new Map();
  for (const tool of model.tools.values()) {
    const categories = [...new Set(tool.categories)].filter(id => byId.has(id)).sort();
    for (const id of categories) byId.get(id).toolCount++;
    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const from = categories[i], to = categories[j];
        const key = JSON.stringify([from, to]);
        if (!pairs.has(key)) pairs.set(key, { from, to, tools: [] });
        pairs.get(key).tools.push({ id: tool.id, name: tool.name });
      }
    }
  }
  for (const edge of model.edges) {
    const node = byId.get(edge.category);
    if (node) node.relationCount++;
  }
  return { nodes, links: [...pairs.values()], toolCount: model.tools.size, relationCount: model.edges.length };
}
