// View model only: both catalogs remain owned by devkit, never copied into the blog.
export const RELATIONS = {
  alternative: '대안', replacement: '대체', complement: '보완',
  wrapper: '래퍼', specialized: '특화',
};
const aliases = { nvim: 'neovim', rg: 'ripgrep', 'git-delta': 'delta', jujutsu: 'jj' };
export function toolId(value = '') {
  const key = String(value).trim().toLowerCase().replace(/\s+/g, '-');
  return Object.hasOwn(aliases, key) ? aliases[key] : key;
}
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
export function splitReference(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid reference catalog');
  return {
    catalog: data.tool_map || data,
    cheats: data.cheatsheets || data,
  };
}
export function validateCatalog(data, key) {
  if (!data || !Array.isArray(data[key])) throw new Error('Invalid ' + key + ' catalog');
  if (key === 'groups' && data.guides !== undefined && !Array.isArray(data.guides)) throw new Error('Invalid guides');
  const slugs = new Set(), categoryIds = new Set();
  const domainIds = new Set();
  if (key === 'categories' && data.domains !== undefined) {
    if (!Array.isArray(data.domains)) throw new Error('Invalid domains');
    for (const domain of data.domains) {
      if (!domain?.id || typeof domain.name !== 'string' || domainIds.has(domain.id)) throw new Error('Invalid or duplicate domain');
      domainIds.add(domain.id);
    }
  }
  const strings = value => value === undefined || Array.isArray(value) && value.every(item => typeof item === 'string');
  for (const group of [...data[key], ...(key === 'groups' && data.guides?.length ? [{ items: data.guides }] : [])]) {
    if (!group || typeof group !== 'object') throw new Error('Invalid group');
    if (key === 'categories' && (!Array.isArray(group.commands) || !Array.isArray(group.relations))) throw new Error('Invalid category');
    if (key === 'categories') {
      if (group.id !== undefined && (typeof group.id !== 'string' || !group.id || categoryIds.has(group.id))) throw new Error('Invalid or duplicate category id');
      if (group.id) categoryIds.add(group.id);
      if (group.domain !== undefined && !domainIds.has(group.domain)) throw new Error('Unknown category domain');
      if (!strings(group.aliases) || group.tags !== undefined && !Array.isArray(group.tags)) throw new Error('Invalid category metadata');
      const tags = new Set();
      for (const tag of group.tags || []) {
        if (!tag?.id || typeof tag.name !== 'string' || tags.has(tag.id) || !strings(tag.aliases)) throw new Error('Invalid or duplicate category tag');
        tags.add(tag.id);
      }
      for (const command of group.commands) {
        if (!command || typeof command.name !== 'string' || !strings(command.hosts) || !strings(command.tags) || !strings(command.platforms) || !strings(command.aliases)) throw new Error('Invalid command metadata');
        if (command.tags?.some(tag => !tags.has(tag))) throw new Error('Unknown command tag');
      }
      if (group.relations.some(edge => edge.tag !== undefined && !tags.has(edge.tag))) throw new Error('Unknown relation tag');
    }
    if (key === 'groups') {
      if (!Array.isArray(group.items)) throw new Error('Invalid cheatsheet group');
      for (const item of group.items) {
        if (!item || !/^[a-z0-9_-]+$/.test(item.slug || '') || typeof item.name !== 'string' || slugs.has(item.slug)) throw new Error('Invalid or duplicate cheatsheet tool');
        if (!strings(item.related_tools)) throw new Error('Invalid guide targets');
        slugs.add(item.slug);
      }
    }
  }
  return data;
}
export function buildModel(catalog = { categories: [] }, cheats = { groups: [] }) {
  if (arguments.length === 1 && catalog?.tool_map) ({ catalog, cheats } = splitReference(catalog));
  validateCatalog(catalog, 'categories'); validateCatalog(cheats, 'groups');
  const tools = new Map(), categories = [], edges = [];
  const domains = (catalog.domains || []).map(domain => ({ ...domain, aliases: [...(domain.aliases || [])] }));
  function ensure(name, explicitId) {
    const id = toolId(explicitId || name);
    if (!id) return null;
    if (!tools.has(id)) tools.set(id, {
      id, name: String(name || id), kind: 'tool', description: '', categories: [], aliases: new Set([id, ...Object.keys(aliases).filter(alias => aliases[alias] === id)]),
      tldr: '', examples: [], official: [], custom: [], links: [],
      categoryTags: {}, hostsByCategory: {}, sectionsByCategory: {}, relatedTools: [], role: '', platforms: [],
    });
    const tool = tools.get(id);
    tool.aliases.add(String(name || id).toLowerCase());
    return tool;
  }
  function addLinks(target, links) {
    for (const link of [].concat(links || [])) {
      const url = safeUrl(link?.url);
      if (url && !target.some(item => item.url === url)) target.push({ url, label: String(link.label || '문서') });
    }
  }
  function member(tool, category) {
    if (tool && !tool.categories.includes(category.id)) tool.categories.push(category.id);
  }
  for (const [index, source] of catalog.categories.entries()) {
    const category = { id: source.id || 'map-' + index, name: String(source.name || '기타'), why: source.why || '',
      domain: source.domain, aliases: [...(source.aliases || [])],
      tags: (source.tags || []).map(tag => ({ ...tag, aliases: [...(tag.aliases || [])] })) };
    categories.push(category);
    const names = new Map();
    for (const command of source.commands) {
      const tool = ensure(command.name, command.tool_id || command.id);
      if (!tool) continue;
      names.set(command.name, tool.id);
      member(tool, category);
      tool.description ||= String(command.description || '');
      if (command.kind) tool.kind = command.kind;
      tool.role ||= command.role || '';
      tool.platforms = [...new Set([...tool.platforms, ...(command.platforms || [])])];
      if (command.tags) tool.categoryTags[category.id] = [...new Set([...(tool.categoryTags[category.id] || []), ...command.tags])];
      if (command.hosts) tool.hostsByCategory[category.id] = [...new Set([...(tool.hostsByCategory[category.id] || []), ...command.hosts.map(toolId)])];
      if (command.section) tool.sectionsByCategory[category.id] = command.section;
      for (const alias of command.aliases || []) tool.aliases.add(String(alias).toLowerCase());
      tool.tldr ||= command.tldr || '';
      tool.usage ||= command.usage || '';
      tool.examples = [...new Set([...tool.examples, ...(command.examples || [])])];
      addLinks(tool.official, command.url ? { label: '공식 문서', url: command.url } : command.official);
      addLinks(tool.links, command.links);
    }
    for (const relation of source.relations) {
      if (typeof relation.from !== 'string' || typeof relation.to !== 'string') continue;
      const from = ensure(relation.from, names.get(relation.from)), to = ensure(relation.to, names.get(relation.to));
      member(from, category); member(to, category);
      to.tldr ||= relation.tldr || '';
      to.install ||= relation.install || '';
      addLinks(to.official, { label: '공식 문서', url: relation.url });
      edges.push({ ...relation, id: 'edge-' + edges.length, from: from.id, to: to.id, category: category.id });
    }
  }
  const sheetGroups = [...cheats.groups, ...(cheats.guides?.length ? [{ title: '주제별 자료', items: cheats.guides }] : [])];
  for (const [index, group] of sheetGroups.entries()) {
    const extra = { id: 'sheet-' + index, name: String(group.title || '참고 문서'), why: '' };
    for (const item of group.items) {
      const tool = ensure(item.name, item.tool_id || item.slug);
      if (!tool) continue;
      tool.name = String(item.name || tool.name);
      if (item.kind) tool.kind = item.kind;
      tool.relatedTools = [...new Set([...tool.relatedTools, ...(item.related_tools || []).map(toolId)])];
      tool.aliases.add(String(item.slug || '').toLowerCase());
      tool.description ||= String(item.desc || '');
      tool.tldr = item.tldr || tool.tldr;
      if (!tool.categories.length) {
        if (!categories.some(category => category.id === extra.id)) categories.push(extra);
        member(tool, extra);
      }
      addLinks(tool.official, item.official);
      addLinks(tool.custom, item.custom);
      addLinks(tool.links, item.links);
    }
  }
  for (const tool of tools.values()) {
    tool.search = [tool.id, tool.name, ...tool.aliases, tool.description,
      ...tool.categories.map(id => categories.find(category => category.id === id)?.name || '')].join(' ').toLowerCase();
  }
  return { tools, categories, edges, domains };
}
export function filterModel(model, category = 'all', query = '') {
  const text = query.trim().toLowerCase();
  const eligible = new Set([...model.tools.values()].filter(tool => category === 'all' || tool.categories.includes(category)).map(tool => tool.id));
  const matches = new Set([...eligible].filter(id => !text || model.tools.get(id).search.includes(text)));
  const edges = model.edges.filter(edge => category === 'all' || edge.category === category);
  if (text) for (const edge of edges) {
    const searchable = [edge.why, edge.problem, edge.solution, edge.boundary, RELATIONS[edge.relation]].filter(Boolean).join(' ').toLowerCase();
    if (searchable.includes(text)) { matches.add(edge.from); matches.add(edge.to); }
  }
  const visible = new Set(matches);
  if (text) for (const edge of edges) {
    if (matches.has(edge.from) || matches.has(edge.to)) { visible.add(edge.from); visible.add(edge.to); }
  }
  return { matches, visible, edges: edges.filter(edge => visible.has(edge.from) && visible.has(edge.to)) };
}
export function readHash(hash, model, defaultView = 'map') {
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.includes('=') ? raw : '');
  let requested = params.get('tool') || raw;
  try { requested = decodeURIComponent(requested); } catch { requested = ''; }
  let tool = model.tools.has(toolId(requested)) ? toolId(requested)
    : [...model.tools.values()].find(tool => tool.aliases.has(String(requested).toLowerCase()))?.id || '';
  if (!tool) {
    const legacy = model.edges.find(edge => `${edge.from}-${edge.to}` === toolId(requested));
    tool = legacy?.to || '';
  }
  const category = params.get('category') || 'all';
  return { tool, view: ['map', 'sheet'].includes(params.get('view')) ? params.get('view') : defaultView,
    category: model.categories.some(item => item.id === category) ? category : 'all', query: params.get('q') || '' };
}
