const { test } = require('node:test');
const assert = require('node:assert/strict');

async function fixture() {
  const { buildModel } = await import('../src/core/catalog.js');
  const category = (name, names, relations = []) => ({ name, commands: names.map(name => ({ name })), relations });
  return buildModel({ categories: [
    category('Shell', ['Zsh', 'bash']),
    category('셸', ['PowerShell']),
    category('Shell Frameworks', ['Zsh', 'oh-my-zsh'], [{ from: 'Zsh', to: 'oh-my-zsh', relation: 'wrapper', solution: 'Framework setup' }]),
    category('Shell Prompt', ['Zsh', 'starship'], [{ from: 'Zsh', to: 'starship', relation: 'complement' }]),
    category('Shell Plugins', ['zsh-autosuggestions']),
    category('Editors', ['neovim', 'emacs']),
    category('Editor Configurations', ['neovim', 'LazyVim'], [{ from: 'neovim', to: 'LazyVim', relation: 'wrapper' }]),
    category('Neovim Plugins · 편집', ['mini.comment']),
    category('Database', ['psql', 'vim-dadbod']),
    category('Neovim Plugins · DB', ['vim-dadbod', 'vim-dadbod-completion'], [{ from: 'vim-dadbod', to: 'vim-dadbod-completion', relation: 'complement' }]),
    category('Git', ['git']),
  ] });
}

test('explorer projection merges roles, deduplicates memberships, and preserves the original catalog model', async () => {
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const source = await fixture();
  const before = structuredClone(source);
  const model = classifyExplorerModel(source);
  assert.equal(source.categories.length, 11);
  assert.equal(model.categories.length, 4);
  assert.equal(model.tools.size, source.tools.size);
  assert.equal(model.edges.length, source.edges.length);
  assert.deepEqual(model.tools.get('zsh').categories, ['role:shell']);
  assert.deepEqual(model.tools.get('zsh').categoryTags['role:shell'], ['base', 'frameworks', 'prompt']);
  assert.deepEqual(model.tools.get('powershell').categories, ['role:shell']);
  assert.deepEqual(model.tools.get('vim-dadbod').categories, ['role:database']);
  assert.deepEqual(model.tools.get('vim-dadbod-completion').categories, ['role:database']);
  assert.ok(!model.tools.get('vim-dadbod').categories.includes('role:editor'));
  assert.ok(model.categories.find(category => category.id === 'role:editor').tags.some(tag => tag.id === 'neovim:편집'));
  assert.equal(model.edges[0].solution, 'Framework setup');
  assert.equal(model.edges[0].category, 'role:shell');
  assert.equal(model.edges[0].sourceCategory, 'map-2');
  assert.deepEqual(source, before);
});

test('tag filtering narrows both tools and original registered relations, while search remains global', async () => {
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const { navigationGroups, explorerFilter } = await import('../src/core/navigation.js');
  const model = classifyExplorerModel(await fixture());
  const groups = navigationGroups(model);
  const frameworks = explorerFilter(model, groups, 'role:shell', '', 'frameworks');
  assert.deepEqual(frameworks.visible, new Set(['zsh', 'oh-my-zsh']));
  assert.equal(frameworks.edges.length, 1);
  assert.equal(frameworks.edges[0].tag, 'frameworks');
  const shell = explorerFilter(model, groups, 'role:shell');
  assert.equal(shell.visible.size, 6);
  assert.equal(shell.edges.length, 2);
  assert.deepEqual(explorerFilter(model, groups, 'role:shell', '', 'invalid'), shell);
  const search = explorerFilter(model, groups, 'role:shell', 'psql', 'frameworks');
  assert.ok(search.matches.has('psql'));
  const db = explorerFilter(model, groups, 'role:database', '', 'neovim');
  assert.deepEqual(db.visible, new Set(['vim-dadbod', 'vim-dadbod-completion']));
  assert.equal(db.edges.length, 1);
});

test('legacy category names, IDs and expanded IDs restore merged roles and matching tags', async () => {
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const { navigationGroups, readExplorerHash } = await import('../src/core/navigation.js');
  const model = classifyExplorerModel(await fixture());
  const groups = navigationGroups(model);
  for (const requested of ['Shell Frameworks', 'map-2']) {
    const hash = '#' + new URLSearchParams({ scope: requested, open: 'map-2', overview: 'macro' });
    const state = readExplorerHash(hash, model, groups);
    assert.equal(state.category, 'role:shell');
    assert.equal(state.tag, 'frameworks');
    assert.ok(state.expanded.has('role:shell'));
    assert.ok(state.expanded.has('domain:terminal'));
    assert.equal(state.overviewMode, 'explore');
  }
  const legacy = readExplorerHash('#category=map-9', model, groups);
  assert.equal(legacy.category, 'role:database');
  assert.equal(legacy.tag, 'neovim');
  assert.equal(readExplorerHash('#scope=Shell', model, groups).tag, '');
  assert.equal(readExplorerHash('#scope=Shell&tag=prompt', model, groups).tag, 'prompt');
  assert.equal(readExplorerHash('#scope=Shell&tag=invalid', model, groups).tag, '');
});

test('all role views omit redundant source-category selectors', async () => {
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const { renderTagFilters } = await import('../src/ui/views.js');
  const model = classifyExplorerModel(await fixture());
  for (const scope of ['role:editor', 'role:shell', 'role:database', 'all']) {
    const target = { innerHTML: 'old controls', hidden: false };
    renderTagFilters(target, model, scope);
    assert.equal(target.hidden, true);
    assert.equal(target.innerHTML, '');
  }
});

test('standalone configuration tools retain their records and appear in purpose navigation without fake relations', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const { navigationGroups } = await import('../src/core/navigation.js');
  const source = buildModel({ categories: [{ name: 'Git & 버전 관리', commands: [{ name: 'git' }, { name: 'chezmoi', description: 'Manage dotfiles' }], relations: [] }] });
  const model = classifyExplorerModel(source);
  assert.deepEqual(model.tools.get('chezmoi').categories, ['purpose:configuration']);
  assert.equal(model.tools.get('chezmoi').description, 'Manage dotfiles');
  assert.equal(model.edges.length, 0);
  assert.equal(source.tools.get('chezmoi').categories[0], 'map-0');
  assert.ok(navigationGroups(model).find(group => group.id === 'domain:environment').tools.has('chezmoi'));
  for (const tool of model.tools.values()) assert.ok(navigationGroups(model).some(group => group.tools.has(tool.id)));
});

test('guide documents become linked resources without inflating explorer counts or changing source records', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const { navigationGroups } = await import('../src/core/navigation.js');
  const source = buildModel({ tool_map: { categories: [{ name: 'Database', commands: [{ name: 'harlequin' }], relations: [] }] }, cheatsheets: { groups: [], guides: [{ slug: 'database-tui', name: 'Database TUI', kind: 'guide', custom: { label: 'DB guide', url: 'https://example.com/database-tui' } }] } });
  const model = classifyExplorerModel(source);
  assert.equal(model.tools.size, 1);
  assert.ok(!model.tools.has('database-tui'));
  assert.ok(!navigationGroups(model).some(group => group.id === 'domain:reference'));
  assert.ok(model.tools.get('harlequin').links.some(link => link.url === 'https://example.com/database-tui'));
  assert.equal(source.tools.size, 2);
  assert.equal(source.tools.get('harlequin').links.length, 0);
  assert.equal(model.guides.length, 1);
});
