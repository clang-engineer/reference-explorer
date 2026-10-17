const { test } = require('node:test');
const assert = require('node:assert/strict');

async function fixture() {
  const { buildModel } = await import('../src/core/catalog.js');
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const category = (name, names, relations = []) => ({ name, commands: names.map(name => ({ name })), relations });
  return classifyExplorerModel(buildModel({ categories: [
    category('Shell', ['Zsh', 'bash']),
    category('Shell Frameworks', ['oh-my-zsh']),
    category('Shell Prompt', ['starship']),
    category('Shell Plugins', ['zsh-autosuggestions', 'unknown-shell-plugin']),
    category('Editors', ['neovim', 'emacs']),
    category('Editor Configurations', ['LazyVim', 'doom-emacs']),
    category('Neovim Plugins · AI', ['copilot.lua', 'CopilotChat.nvim'], [{ from: 'copilot.lua', to: 'CopilotChat.nvim', relation: 'complement' }]),
    category('Neovim Plugins · 탐색', ['vim-tmux-navigator']),
    category('Database', ['psql', 'vim-dadbod']),
    category('Neovim Plugins · DB', ['vim-dadbod']),
    category('Terminal Multiplexer', ['tmux', 'zellij']),
    category('tmux Plugins', ['vim-tmux-navigator', 'tmux-resurrect']),
  ] }));
}

function members(model, category) {
  return new Set([...model.tools.values()].filter(tool => tool.categories.includes(category)).map(tool => tool.id));
}

test('extension hosts are explicit and scoped; cross-shell tools and unknown plugins are not guessed', async () => {
  const model = await fixture();
  assert.deepEqual(model.tools.get('vim-tmux-navigator').hostsByCategory['role:editor'], ['neovim']);
  assert.deepEqual(model.tools.get('vim-tmux-navigator').hostsByCategory['role:terminal-multiplexer'], ['tmux']);
  assert.deepEqual(model.tools.get('vim-dadbod').hostsByCategory['role:database'], ['neovim']);
  assert.deepEqual(model.tools.get('oh-my-zsh').hostsByCategory['role:shell'], ['zsh']);
  assert.deepEqual(model.tools.get('starship').hostsByCategory, {});
  assert.deepEqual(model.tools.get('unknown-shell-plugin').hostsByCategory, {});
  assert.deepEqual(model.tools.get('neovim').hostsByCategory, {});
  assert.equal(model.categories.some(category => category.name === 'tmux Plugins'), false);
});

test('plugins and configurations fold beneath their hosts and expand without duplicates or lost tools', async () => {
  const { toolHierarchy } = await import('../src/core/extensions.js');
  const model = await fixture(), visible = members(model, 'role:editor');
  const closed = toolHierarchy(model, 'role:editor', visible);
  assert.deepEqual(new Set(closed.ids), new Set(['neovim', 'emacs']));
  assert.equal(closed.hiddenCount, 5);
  const partial = toolHierarchy(model, 'role:editor', visible, new Set(['neovim']));
  assert.ok(partial.ids.includes('lazyvim'));
  assert.ok(partial.ids.includes('copilot.lua'));
  assert.ok(!partial.ids.includes('doom-emacs'));
  const open = toolHierarchy(model, 'role:editor', visible, new Set(closed.groups.keys()));
  assert.deepEqual(new Set(open.ids), visible);
  assert.equal(open.ids.length, visible.size);
  assert.equal(open.hiddenCount, 0);
  assert.equal(open.ids.indexOf('lazyvim'), open.ids.indexOf('neovim') + 1);
});

test('context hosts do not acquire fake memberships or relationship edges, and missing hosts never hide tools', async () => {
  const { toolHierarchy } = await import('../src/core/extensions.js');
  const { classifyExplorerModel } = await import('../src/core/classification.js');
  const { buildModel } = await import('../src/core/catalog.js');
  const model = await fixture(), before = structuredClone(model);
  const db = toolHierarchy(model, 'role:database', members(model, 'role:database'));
  assert.deepEqual(db.ids, ['psql', 'neovim']);
  assert.ok(!model.tools.get('neovim').categories.includes('role:database'));
  assert.deepEqual(model, before);
  const orphan = classifyExplorerModel(buildModel({ categories: [{ name: 'Neovim Plugins · AI', commands: [{ name: 'plugin-only' }], relations: [] }] }));
  const tree = toolHierarchy(orphan, 'role:editor', members(orphan, 'role:editor'));
  assert.deepEqual(tree.ids, ['plugin-only']);
  assert.equal(tree.hiddenCount, 0);
});

test('expanded host boxes stay within the canvas and their children sit below the host at all widths', async () => {
  const { toolHierarchy } = await import('../src/core/extensions.js');
  const { layoutToolHierarchy } = await import('../src/graph/tool-hierarchy.js');
  const { routeConnections } = await import('../src/graph/routing.js');
  const model = await fixture(), visible = members(model, 'role:editor');
  const tree = toolHierarchy(model, 'role:editor', visible, new Set(['neovim', 'emacs']));
  const edges = model.edges.filter(edge => edge.category === 'role:editor');
  for (const width of [168, 300, 960]) {
    const layout = layoutToolHierarchy(tree, edges, width);
    assert.equal(layout.positions.size, tree.ids.length);
    assert.ok(layout.width <= width);
    for (const frame of layout.frames) {
      const host = layout.positions.get(frame.host);
      assert.ok(frame.x + frame.width <= layout.width);
      assert.ok(frame.y + frame.height <= layout.height);
      for (const id of tree.groups.get(frame.host)) {
        const child = layout.positions.get(id);
        assert.ok(child.y >= host.y + layout.nodeHeight);
        assert.ok(child.x >= frame.x && child.x + layout.nodeWidth <= frame.x + frame.width);
      }
    }
    const points = [...layout.positions.values()];
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j];
      assert.ok(a.x + layout.nodeWidth <= b.x || b.x + layout.nodeWidth <= a.x || a.y + layout.nodeHeight <= b.y || b.y + layout.nodeHeight <= a.y);
    }
    assert.equal(routeConnections(layout, edges).length, edges.length);
  }
});

test('legacy plugin links and tag filters expand their host; explicit closed state survives restoration', async () => {
  const { readExplorerHash, navigationGroups } = await import('../src/core/navigation.js');
  const model = await fixture(), groups = navigationGroups(model);
  const linked = readExplorerHash('#scope=Editors&tool=copilot.lua', model, groups);
  assert.ok(linked.expandedHosts.has('neovim'));
  const tagged = readExplorerHash('#scope=Editors&tag=neovim:AI', model, groups);
  assert.ok(tagged.expandedHosts.has('neovim'));
  const closed = readExplorerHash('#scope=Editors&tag=neovim:AI&hosts=', model, groups);
  assert.equal(closed.expandedHosts.size, 0);
  const validated = readExplorerHash('#scope=Editors&hosts=neovim,invalid', model, groups);
  assert.deepEqual([...validated.expandedHosts], ['neovim']);
});

test('overview and category maps show host controls, while explicit search still shows extensions directly', async () => {
  const { navigationGroups, explorerFilter } = await import('../src/core/navigation.js');
  const { overviewHtml } = await import('../src/graph/overview.js');
  const { renderMap } = await import('../src/ui/views.js');
  const model = await fixture(), groups = navigationGroups(model);
  const expanded = new Set([...groups.map(group => group.id), ...model.categories.map(category => category.id)]);
  const closed = overviewHtml(groups, expanded, 1, 2, model);
  assert.ok(closed.includes('data-toggle-host="neovim"'));
  assert.ok(!closed.includes('data-tool="copilot.lua"'));
  const open = overviewHtml(groups, expanded, 1, 2, model, '', new Set(['neovim']));
  assert.ok(open.includes('data-tool="copilot.lua"'));
  assert.ok(open.includes('dk-extension-child'));
  const stage = { children: [], ownerDocument: { createElement: () => ({ innerHTML: '' }) }, append(board) { this.children.push(board); } };
  renderMap(stage, { model, groups, category: 'role:editor', query: '', zoom: 1, expandedHosts: new Set() }, explorerFilter(model, groups, 'role:editor'));
  assert.ok(stage.children[0].innerHTML.includes('data-toggle-host="neovim"'));
  assert.ok(!stage.children[0].innerHTML.includes('data-tool="copilot.lua"'));
  stage.children = [];
  renderMap(stage, { model, groups, category: 'role:editor', query: 'copilot', zoom: 1 }, explorerFilter(model, groups, 'role:editor', 'copilot'));
  assert.ok(stage.children[0].innerHTML.includes('data-tool="copilot.lua"'));
  assert.ok(!stage.children[0].innerHTML.includes('data-toggle-host'));
});
