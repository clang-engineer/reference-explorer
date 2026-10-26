import { filterModel, readHash } from './catalog.js';
import { categoryTag } from './classification.js';
import { tagHostExpansion } from './extensions.js';

// The catalog owns domain membership and ordering. Unclassified generic input
// remains visible in one fallback group; names never imply a purpose or host.
export function navigationGroups(model) {
  const groups = (model.domains || []).map(domain => ({ ...domain, categories: [], tools: new Set() }));
  const fallback = { id: 'domain:reference', name: '기타 도구', categories: [], tools: new Set() };
  if (!groups.some(group => group.id === fallback.id)) groups.push(fallback);
  for (const category of model.categories) {
    const group = groups.find(group => group.id === category.domain) || groups.find(group => group.id === fallback.id);
    const tools = [...model.tools.values()].filter(tool => tool.categories.includes(category.id));
    if (!tools.length) continue;
    group.categories.push({ ...category, count: tools.length });
    for (const tool of tools) group.tools.add(tool.id);
  }
  return groups.filter(group => group.categories.length);
}
export function explorerFilter(model, groups, scope = 'all', query = '', tag = '') {
  // Search remains global; category tags apply only to an unsearched category view.
  if (query.trim() || scope === 'all') return filterModel(model, 'all', query);
  const group = groups.find(group => group.id === scope);
  if (group) {
    const ids = new Set(group.categories.map(category => category.id));
    const visible = new Set(group.tools);
    return { visible, matches: new Set(visible), edges: model.edges.filter(edge => ids.has(edge.category)) };
  }
  const filtered = filterModel(model, scope);
  if (!categoryTag(model, scope, tag)) return filtered;
  const visible = new Set([...filtered.visible].filter(id => model.tools.get(id).categoryTags?.[scope]?.includes(tag)));
  return { visible, matches: new Set(visible), edges: filtered.edges.filter(edge => edge.tag === tag && visible.has(edge.from) && visible.has(edge.to)) };
}
export function readExplorerHash(hash, model, groups, defaultView = 'map') {
  const legacy = readHash(hash, model, defaultView);
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const requested = params.get('scope') || params.get('category');
  const group = groups.find(group => group.id === requested || group.aliases?.includes(requested));
  // Category names make new links stable when upstream categories are reordered.
  const category = model.categories.find(category => category.name === requested || category.id === requested || category.aliases?.includes(requested));
  let scope = group?.id || category?.id || legacy.category;
  if (requested === 'all') scope = 'all';
  else if (!requested && scope === 'all' && legacy.tool) scope = model.tools.get(legacy.tool).categories[0] || 'all';
  const validTabs = ['about', 'usage', 'resources'];
  const tab = validTabs.includes(params.get('tab')) ? params.get('tab') : legacy.view === 'sheet' ? 'usage' : 'about';
  const expanded = new Set((params.get('open') || '').split(',')
    .map(id => model.categories.find(category => category.aliases?.includes(id))?.id || id)
    .filter(id => groups.some(group => group.id === id || group.categories.some(category => category.id === id))));
  const parent = groups.find(group => group.categories.some(category => category.id === scope));
  if (parent) expanded.add(parent.id);
  if (scope === 'all' && legacy.tool) {
    const toolCategory = model.tools.get(legacy.tool).categories[0];
    const toolGroup = groups.find(group => group.categories.some(category => category.id === toolCategory));
    if (toolGroup) { expanded.add(toolGroup.id); expanded.add(toolCategory); }
  }
  const overviewMode = 'explore'; // Legacy macro links resolve to tool exploration.
  const legacyTag = category && requested !== category.name && requested !== category.id
    ? category.tags?.find(tag => tag.aliases?.includes(requested))?.id : '';
  const tag = categoryTag(model, scope, params.has('tag') ? params.get('tag') : legacyTag);
  const knownHosts = new Set([...model.tools.values()].flatMap(tool => Object.values(tool.hostsByCategory || {}).flat()));
  const expandedHosts = params.has('hosts') ? new Set((params.get('hosts') || '').split(',').filter(id => knownHosts.has(id))) : tagHostExpansion(model, scope, tag);
  if (!params.has('hosts') && legacy.tool) {
    const hosts = model.tools.get(legacy.tool).hostsByCategory || {};
    for (const id of hosts[scope] || Object.values(hosts).flat()) if (knownHosts.has(id)) expandedHosts.add(id);
  }
  return { tool: legacy.tool, category: scope, query: legacy.query, tab, expanded, overviewMode, tag, expandedHosts };
}
