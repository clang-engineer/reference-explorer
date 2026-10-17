// Explicit host metadata only. Do not infer dependencies from alternative/complement edges.
export function sourceExtensionHosts(toolId, categoryName) {
  if (categoryName.startsWith('Neovim Plugins · ')) return ['neovim'];
  if (categoryName === 'tmux Plugins') return ['tmux'];
  if (categoryName === 'Shell Plugins' && toolId.startsWith('zsh-')) return ['zsh'];
  if (categoryName === 'Shell Frameworks' && ['oh-my-zsh', 'zimfw', 'prezto', 'zsh4humans'].includes(toolId)) return ['zsh'];
  if (categoryName === 'Editor Configurations') {
    if (toolId === 'lazyvim') return ['neovim'];
    if (toolId === 'doom-emacs') return ['emacs'];
  }
  return [];
}

export function tagHostExpansion(model, categoryId, tag) {
  if (!tag) return new Set();
  return new Set([...model.tools.values()]
    .filter(tool => tool.categoryTags?.[categoryId]?.includes(tag))
    .flatMap(tool => tool.hostsByCategory?.[categoryId] || [])
    .filter(id => model.tools.has(id)));
}

export function toolHierarchy(model, categoryId, visible, expandedHosts = new Set()) {
  const groups = new Map(), owners = new Map();
  for (const id of visible) {
    const host = model.tools.get(id)?.hostsByCategory?.[categoryId]?.find(host => host !== id && model.tools.has(host));
    if (!host) continue;
    owners.set(id, host);
    if (!groups.has(host)) groups.set(host, []);
    groups.get(host).push(id);
  }
  const base = new Set([...visible].map(id => owners.get(id) || id));
  const ids = [...base].flatMap(id => [id, ...(expandedHosts.has(id) ? groups.get(id) || [] : [])]);
  const hiddenCount = [...groups].reduce((count, [host, tools]) => count + (expandedHosts.has(host) ? 0 : tools.length), 0);
  return { ids, groups, owners, hiddenCount };
}
