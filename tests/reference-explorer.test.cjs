const { test } = require('node:test');
const assert = require('node:assert/strict');

const catalog = {
  version: 1,
  tool_map: {
    categories: [{
      name: 'Search',
      commands: [{ name: 'grep' }],
      relations: [{ from: 'grep', to: 'rg', relation: 'alternative', solution: 'fast search' }],
    }],
  },
  cheatsheets: {
    groups: [{
      title: 'Shell',
      items: [{ slug: 'rg', name: 'ripgrep', custom: { label: 'Guide', url: 'https://example.com/rg' } }],
    }],
  },
};

test('devkit adapter builds an explorer model from catalog data', async () => {
  const { fromDevkitCatalog } = await import('../src/adapters/devkit.js');
  const model = fromDevkitCatalog(catalog);
  assert.ok(model.tools.has('grep'));
  assert.ok(model.tools.has('ripgrep'));
  assert.equal(model.edges.length, 1);
  assert.equal(model.edges[0].from, 'grep');
  assert.equal(model.edges[0].to, 'ripgrep');
  assert.ok(model.tools.get('ripgrep').custom.some(link => link.url === 'https://example.com/rg'));
});

test('overview expands domains and categories independently without a separate expand button', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { navigationGroups } = await import('../src/core/navigation.js');
  const { overviewHtml } = await import('../src/graph/overview.js');
  const model = buildModel({ categories: [
    { name: 'Text Search', commands: [{ name: 'grep' }], relations: [] },
    { name: 'File Operations', commands: [{ name: 'cp' }], relations: [] },
    { name: 'Editors', commands: [{ name: 'vim' }], relations: [] },
  ] });
  const groups = navigationGroups(model);
  const cli = groups.find(group => group.name === 'CLI');
  const search = cli.categories.find(category => category.name === 'Text Search');
  const expanded = new Set();
  const render = () => overviewHtml(groups, expanded, 1, 2, model);
  assert.ok(!render().includes(`data-expand="${search.id}"`));
  expanded.add(cli.id);
  assert.ok(render().includes(`data-expand="${search.id}" role="button" tabindex="0" aria-expanded="false"`));
  assert.ok(!render().includes('data-tool='));
  expanded.add(search.id);
  const html = render();
  assert.ok(html.includes(`data-expand="${search.id}" role="button" tabindex="0" aria-expanded="true"`));
  assert.ok(html.includes('data-tool="grep"'));
  assert.ok(!html.includes('data-tool="cp"'));
  assert.ok(!html.includes('data-tool="vim"'));
  assert.ok(!html.includes('dk-overview-jump'));
  assert.ok(html.includes(`data-open-map="${search.id}" role="button" tabindex="0" aria-label="Text Search 관계도 보기"`));
  assert.ok(html.includes('<title>Text Search 관계도 보기</title>'));
  assert.ok(html.includes('text-anchor="middle">↗</text>'));
  assert.ok(!html.includes('관계도 →'));
  expanded.delete(search.id);
  assert.ok(!render().includes('data-tool='));
  expanded.add(search.id);
  expanded.delete(cli.id);
  assert.ok(!render().includes('data-tool='));
});

test('overview category expansion survives hash restoration', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { navigationGroups, readExplorerHash } = await import('../src/core/navigation.js');
  const model = buildModel({ categories: [{ name: 'Text Search', commands: [{ name: 'grep' }], relations: [] }] });
  const groups = navigationGroups(model);
  const ids = [groups[0].id, groups[0].categories[0].id];
  const hash = '#' + new URLSearchParams({ scope: 'all', open: [...ids, 'invalid'].join(',') });
  assert.deepEqual([...readExplorerHash(hash, model, groups).expanded], ids);
});

test('category maps isolate modal SVG markers from the background map', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { renderMap } = await import('../src/ui/views.js');
  const { explorerFilter, navigationGroups } = await import('../src/core/navigation.js');
  const model = buildModel({ categories: [{ name: 'Text Search', commands: [{ name: 'grep' }, { name: 'ripgrep' }], relations: [{ from: 'grep', to: 'ripgrep', relation: 'alternative' }] }] });
  const groups = navigationGroups(model);
  const category = model.categories[0].id;
  const state = { model, groups, category, query: '', zoom: 1 };
  const stage = {
    children: [],
    ownerDocument: { createElement: () => ({ innerHTML: '', className: '' }) },
    append(board) { this.children.push(board); },
  };
  const filtered = explorerFilter(model, groups, category);
  renderMap(stage, state, filtered);
  const background = stage.children.pop().innerHTML;
  renderMap(stage, { ...state, markerPrefix: 'modal-1-' }, filtered);
  const modal = stage.children.pop().innerHTML;
  assert.ok(background.includes(`id="arrow-${category}"`));
  assert.ok(modal.includes(`id="arrow-modal-1-${category}"`));
  assert.ok(modal.includes(`marker-end="url(#arrow-modal-1-${category})"`));
  assert.ok(modal.includes('markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6"'));
  assert.ok(!modal.includes(`id="arrow-${category}"`));
  assert.ok(modal.includes('data-tool="grep"'));
  assert.ok(modal.includes('data-tool="ripgrep"'));
  assert.ok(modal.includes('<rect width="120" height="32"/>'));
  assert.ok(!modal.includes('dk-node-hint'));
});

test('public module exports mount', async () => {
  const api = await import('../src/index.js');
  assert.equal(typeof api.mount, 'function');
});

test('custom element module defines reference-explorer', async () => {
  const registry = new Map();
  globalThis.HTMLElement = class {};
  globalThis.customElements = {
    get: name => registry.get(name),
    define: (name, value) => registry.set(name, value),
  };
  await import('../src/element.js');
  assert.equal(typeof registry.get('reference-explorer'), 'function');
  delete globalThis.HTMLElement;
  delete globalThis.customElements;
});

test('plugin, history and database categories have explicit navigation domains', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { navigationGroups } = await import('../src/core/navigation.js');
  const source = { categories: ['Command History', 'Neovim Plugins · DB', 'tmux Plugins', 'Database', 'Editors'].map((name, index) => ({ name, commands: [{ name: 'item-' + index, description: 'Introduction' }], relations: [] })) };
  const groups = navigationGroups(buildModel(source));
  assert.equal(groups.find(group => group.name === 'CLI').categories[0].name, 'Command History');
  assert.equal(groups.find(group => group.name === 'Plugins').categories.length, 2);
  assert.ok(groups.find(group => group.name === 'Database'));
  assert.ok(groups.find(group => group.name === 'Editor'));
  assert.ok(!groups.find(group => group.name === 'References'));
});
test('category references reuse introduction and guides remain distinct records', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const model = buildModel({ version: 1, tool_map: { categories: [
    { name: 'DB', commands: [{ name: 'vim-dadbod-ui' }], relations: [] },
    { name: 'Plugins', commands: [{ name: 'vim-dadbod-ui', description: 'Database plugin introduction', links: [{label:'My settings',url:'https://github.com/clang-engineer/dotfiles'}] }], relations: [] }
  ] }, cheatsheets: { groups: [], guides: [{slug:'database-tui',name:'Database UI guide',kind:'guide',desc:'Comparison guide',custom:{url:'https://example.com/guide'}}] } });
  assert.equal(model.tools.get('vim-dadbod-ui').description, 'Database plugin introduction');
  assert.equal(model.tools.get('vim-dadbod-ui').categories.length, 2);
  assert.equal(model.tools.get('database-tui').kind, 'guide');
  assert.equal(model.tools.get('database-tui').tldr, '');
  assert.ok(model.categories.some(category => category.name === '주제별 자료'));
});
test('duplicate guide and tool identifiers are rejected', async () => {
  const { validateCatalog } = await import('../src/core/catalog.js');
  assert.throws(() => validateCatalog({groups:[{items:[{slug:'same',name:'Tool'}]}],guides:[{slug:'same',name:'Guide'}]}, 'groups'), /duplicate/);
});

test('tool introduction precedes comparisons and guides do not request tldr', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { createDetailPanel } = await import('../src/ui/details.js');
  const model = buildModel({categories:[{name:'Tools',commands:[{name:'eza',description:'Lists files and directories'}],relations:[]}]},{groups:[],guides:[{slug:'guide',name:'Guide',kind:'guide',custom:{url:'https://example.com/guide'}}]});
  const body={innerHTML:''};
  const panel={innerHTML:'',ownerDocument:{defaultView:{AbortController}},querySelector:()=>body};
  let requests=0;
  const detail=createDetailPanel(panel,{fetchImpl:async()=>{requests++;return {ok:false}}});
  detail.show(model,'eza','about');
  assert.ok(panel.innerHTML.includes('Lists files and directories'));
  assert.ok(panel.innerHTML.includes('도구 소개'));
  assert.ok(body.innerHTML.includes('비교·연동 관계'));
  detail.show(model,'guide','usage');
  assert.ok(panel.innerHTML.includes('문서 소개'));
  assert.ok(body.innerHTML.includes('https://example.com/guide'));
  assert.equal(requests,0);
});
