import { filterModel, readHash } from './catalog.js';

// Navigation groups reference existing categories; they never replace their data.
// Mixed/new categories go to References instead of silently disappearing.
const GROUPS = [
  ['cli', 'CLI', ['File Operations', 'Text Search', 'Text Processing', 'Log Monitoring', 'Navigation', 'System Monitoring', 'Network', 'HTTP', 'Compression']],
  ['terminal', 'Terminal', ['Terminal Multiplexer', 'Terminal Applications']],
  ['editor', 'Editor', ['Terminal Editors']],
  ['shell', 'Shell', ['Shell', '셸']],
  ['vcs', 'VCS', ['Git', '버전 관리']],
  ['window', 'Window Manager', ['Window Managers', 'macOS']],
  ['development', 'Development', ['Development', 'Programming Languages', '개발 도구']],
  ['reference', 'References', []],
];
export function navigationGroups(model) {
  const groups = GROUPS.map(([id, name]) => ({ id: 'domain:' + id, name, categories: [], tools: new Set() }));
  for (const category of model.categories) {
    const index = GROUPS.findIndex(([, , names]) => names.includes(category.name));
    const group = groups[index < 0 ? groups.length - 1 : index];
    const tools = [...model.tools.values()].filter(tool => tool.categories.includes(category.id));
    group.categories.push({ ...category, count: tools.length });
    for (const tool of tools) group.tools.add(tool.id);
  }
  return groups.filter(group => group.categories.length);
}
export function explorerFilter(model, groups, scope = 'all', query = '') {
  // Search is deliberately global, even while a category is selected.
  if (query.trim() || scope === 'all') return filterModel(model, 'all', query);
  const group = groups.find(group => group.id === scope);
  if (!group) return filterModel(model, scope);
  const ids = new Set(group.categories.map(category => category.id));
  const visible = new Set(group.tools);
  return { visible, matches: new Set(visible), edges: model.edges.filter(edge => ids.has(edge.category)) };
}
export function readExplorerHash(hash, model, groups, defaultView = 'map') {
  const legacy = readHash(hash, model, defaultView);
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const requested = params.get('scope');
  const group = groups.find(group => group.id === requested);
  // Category names make new links stable when upstream categories are reordered.
  const category = model.categories.find(category => category.name === requested || category.id === requested);
  let scope = group?.id || category?.id || legacy.category;
  if (requested === 'all') scope = 'all';
  else if (!requested && scope === 'all' && legacy.tool) scope = model.tools.get(legacy.tool).categories[0] || 'all';
  const validTabs = ['about', 'usage', 'resources'];
  const tab = validTabs.includes(params.get('tab')) ? params.get('tab') : legacy.view === 'sheet' ? 'usage' : 'about';
  const expanded = new Set((params.get('open') || '').split(',').filter(id => groups.some(group => group.id === id)));
  const parent = groups.find(group => group.categories.some(category => category.id === scope));
  if (parent) expanded.add(parent.id);
  return { tool: legacy.tool, category: scope, query: legacy.query, tab, expanded };
}
