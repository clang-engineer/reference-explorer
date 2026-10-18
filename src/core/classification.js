import { sourceExtensionHosts } from './extensions.js';

// Explorer-only projection. The catalog and public buildModel/adapter output stay unchanged.
function classification(name) {
  if (name === 'Terminal Multiplexer') return ['terminal-multiplexer', 'Terminal Multiplexer', 'base', '멀티플렉서'];
  if (name === 'tmux Plugins') return ['terminal-multiplexer', 'Terminal Multiplexer', 'plugins', 'tmux 플러그인'];
  if (name === 'Database') return ['database', 'Database', 'base', 'DB 도구'];
  if (name === 'Neovim Plugins · DB') return ['database', 'Database', 'neovim', 'Neovim 플러그인'];
  if (['Shell', '셸'].includes(name)) return ['shell', 'Shell', 'base', '셸'];
  if (name === 'Shell Frameworks') return ['shell', 'Shell', 'frameworks', '프레임워크'];
  if (name === 'Shell Prompt') return ['shell', 'Shell', 'prompt', '프롬프트'];
  if (name === 'Shell Plugins') return ['shell', 'Shell', 'plugins', '플러그인'];
  if (['Editors', 'Terminal Editors'].includes(name)) return ['editor', 'Editors', 'base', '에디터'];
  if (name === 'Editor Configurations') return ['editor', 'Editors', 'config', '설정·배포판'];
  if (name.startsWith('Neovim Plugins · ')) {
    const label = name.slice('Neovim Plugins · '.length);
    return ['editor', 'Editors', `neovim:${label}`, `Neovim · ${label}`];
  }
  return null;
}

export function classifyExplorerModel(model) {
  const categories = [], merged = new Map(), sources = new Map();
  for (const source of model.categories) {
    const rule = source.tags ? null : classification(source.name);
    if (!rule) { categories.push(source); continue; }
    const [role, name, tagId, tagName] = rule;
    const id = `role:${role}`;
    if (!merged.has(id)) {
      const category = { id, name, why: '', aliases: [], tags: [] };
      merged.set(id, category); categories.push(category);
    }
    const category = merged.get(id);
    category.aliases.push(source.id, source.name);
    let tag = category.tags.find(tag => tag.id === tagId);
    if (!tag) { tag = { id: tagId, name: tagName, aliases: [] }; category.tags.push(tag); }
    tag.aliases.push(source.id, source.name);
    sources.set(source.id, { category: id, tag: tagId });
  }
  const tools = new Map([...model.tools].map(([id, source]) => {
    const categoryTags = Object.fromEntries(Object.entries(source.categoryTags || {}).map(([id, tags]) => [id, [...tags]]));
    const hostsByCategory = Object.fromEntries(Object.entries(source.hostsByCategory || {}).map(([id, hosts]) => [id, [...hosts]]));
    const memberships = new Set();
    for (const categoryId of source.categories) {
      const mapped = sources.get(categoryId);
      const target = mapped?.category || categoryId;
      memberships.add(target);
      const sourceName = model.categories.find(category => category.id === categoryId)?.name || '';
      for (const host of sourceExtensionHosts(source.id, sourceName)) {
        if (host === id || !model.tools.has(host)) continue;
        const hosts = hostsByCategory[target] ||= [];
        if (!hosts.includes(host)) hosts.push(host);
      }
      if (mapped) {
        const tags = categoryTags[mapped.category] ||= [];
        if (!tags.includes(mapped.tag)) tags.push(mapped.tag);
      }
    }
    const tool = { ...source, categories: [...memberships], categoryTags, hostsByCategory };
    tool.search = [source.search || '', ...tool.categories.map(id => categories.find(category => category.id === id)?.name || '')].join(' ').toLowerCase();
    return [id, tool];
  }));
  // Standalone tools belong to their task, not to the catalog's document shelf.
  const purposeOverrides = [
    ['purpose:configuration', 'Configuration Management', ['chezmoi']],
    ['purpose:runtime', 'Runtime Management', ['mise']],
    ['purpose:secrets', 'Secret Management', ['sops']],
    ['purpose:productivity', 'Task Management', ['taskwarrior']],
  ];
  for (const [id, name, ids] of purposeOverrides) {
    const members = ids.filter(id => tools.has(id));
    if (!members.length) continue;
    categories.push({ id, name, why: '', aliases: [] });
    for (const toolId of members) {
      const tool = tools.get(toolId);
      const connected = new Set(model.edges.filter(edge => edge.from === toolId || edge.to === toolId).map(edge => sources.get(edge.category)?.category || edge.category));
      tool.categories = [...tool.categories.filter(category => connected.has(category)), id];
      tool.search += ' ' + name.toLowerCase();
    }
  }
  for (const id of ['c', 'rust', 'zig']) if (tools.has(id)) tools.get(id).kind = 'language';
  for (const id of ['git-log', 'git-diff']) {
    const tool = tools.get(id);
    if (!tool || !tools.has('git')) continue;
    for (const category of tool.categories) tool.hostsByCategory[category] = ['git'];
  }
  const edges = model.edges.map(edge => {
    const mapped = sources.get(edge.category);
    return mapped ? { ...edge, category: mapped.category, sourceCategory: edge.category, tag: mapped.tag } : edge;
  });
  // Guides remain source records in the public model, but are resources in the UI.
  const guideTargets = {
    'terminal-tui': ['lazygit', 'lazydocker', 'yazi', 'harlequin', 'rainfrog'],
    shell: ['bash', 'zsh', 'fish', 'nushell', 'powershell'],
    'database-tui': ['harlequin', 'rainfrog', 'vim-dadbod-ui'],
    'python-pypi-publishing': ['python', 'uv'],
    'tools-dictionary': ['curl', 'docker', 'nginx', 'systemctl', 'systemd'],
  };
  const guides = [...tools.values()].filter(tool => tool.kind === 'guide');
  for (const guide of guides) {
    for (const id of guideTargets[guide.id] || []) {
      const tool = tools.get(id);
      if (!tool || tool.kind === 'guide') continue;
      tool.links = [...tool.links];
      for (const link of guide.custom) {
        if (!tool.links.some(item => item.url === link.url)) tool.links.push({ ...link });
      }
    }
    tools.delete(guide.id);
  }
  const visibleCategories = categories.filter(category => [...tools.values()].some(tool => tool.categories.includes(category.id)));
  return { ...model, categories: visibleCategories, tools, edges: edges.filter(edge => tools.has(edge.from) && tools.has(edge.to)), guides };
}

export function categoryTag(model, categoryId, requested) {
  return model.categories.find(category => category.id === categoryId)?.tags?.find(tag => tag.id === requested)?.id || '';
}
