// Categories, domains, tool kinds and hosts are catalog data, not UI policy.
// This projection only presents guide documents as linked resources.
export function classifyExplorerModel(model) {
  const tools = new Map([...model.tools].map(([id, tool]) => [id, { ...tool, links: [...tool.links] }]));
  const guides = [...tools.values()].filter(tool => tool.kind === 'guide');
  for (const guide of guides) {
    for (const id of guide.relatedTools || []) {
      const tool = tools.get(id);
      if (!tool || tool.kind === 'guide') continue;
      for (const link of guide.custom) {
        if (!tool.links.some(item => item.url === link.url)) tool.links.push({ ...link });
      }
    }
    tools.delete(guide.id);
  }
  const categories = model.categories.filter(category => [...tools.values()].some(tool => tool.categories.includes(category.id)));
  return { ...model, categories, tools, edges: model.edges.filter(edge => tools.has(edge.from) && tools.has(edge.to)), guides };
}

export function categoryTag(model, categoryId, requested) {
  return model.categories.find(category => category.id === categoryId)?.tags?.find(tag => tag.id === requested)?.id || '';
}
