import { filterModel, readHash } from './catalog.js';
import { categoryTag } from './classification.js';
import { tagHostExpansion } from './extensions.js';

// Navigation groups reference existing categories; they never replace their data.
// Mixed/new categories go to References instead of silently disappearing.
const GROUPS = [
  ['files', '파일·검색·텍스트', ['File Operations', 'Text Search', 'Text Processing', 'Navigation', 'Compression', 'Command History', 'CLI 기록·탐색']],
  ['terminal', '터미널·셸 환경', ['Terminal Multiplexer', 'Terminal Applications', 'tmux Plugins', 'Shell', 'Shell Frameworks', 'Shell Prompt', '셸']],
  ['editor', '코드·문서 편집', ['Terminal Editors', 'Editors', 'Editor Configurations', '에디터 & TUI']],
  ['operations', '시스템·네트워크 운영', ['Log Monitoring', 'System Monitoring', 'Network', 'HTTP', 'Benchmarking', '시스템 & 서버']],
  ['database', '데이터 저장·검색', ['Database', '데이터']],
  ['vcs', '버전 관리', ['Git', '버전 관리', 'Git & 버전 관리']],
  ['environment', '설정·창·작업 관리', ['Window Managers', 'macOS', 'Configuration Management', 'Task Management']],
  ['development', '개발·실행·보안', ['Development', 'Programming Languages', 'Containers', '개발 도구', '보안 & 비밀정보', 'Runtime Management', 'Secret Management']],
  ['reference', '기타 도구', []],
];
export function navigationGroups(model) {
  const groups = GROUPS.map(([id, name]) => ({ id: 'domain:' + id, name, categories: [], tools: new Set() }));
  for (const category of model.categories) {
    const index = GROUPS.findIndex(([id, , names]) => names.includes(category.name) || (id === 'editor' && category.name.startsWith('Neovim Plugins ·')));
    const group = groups[index < 0 ? groups.length - 1 : index];
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
  const group = groups.find(group => group.id === requested);
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
