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

test('purpose cards restore subcategory headings and per-category expansion', async () => {
  const { buildModel } = await import('../src/core/catalog.js');
  const { navigationGroups } = await import('../src/core/navigation.js');
  const { overviewHtml } = await import('../src/graph/overview.js');
  const model = buildModel({ categories: [
    { name: 'Text Search', commands: ['grep', 'rg', 'ag', 'ack', 'fzf', 'skim'].map(name => ({name})), relations: [] },
    { name: 'Configuration Management', commands: [{name: 'chezmoi'}], relations: [] },
  ] });
  const groups = navigationGroups(model);
  const category = groups[0].categories[0].id;
  const closed = overviewHtml(groups, new Set(), 1, 2, model);
  assert.ok(closed.includes('data-tool="chezmoi"'));
  assert.ok(closed.includes('data-tool="grep"'));
  assert.ok(!closed.includes('data-tool="skim"'));
  assert.ok(closed.includes('Text Search'));
  assert.ok(closed.includes('data-expand='));
  const open = overviewHtml(groups, new Set([category]), 1, 2, model);
  assert.ok(open.includes('data-tool="skim"'));
  assert.ok(open.includes(`data-open-map="${category}"`));
  assert.ok(!open.includes('<svg'));
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
  const memberships = ['files', 'database', 'terminal', 'database', 'editor'];
  const source = {
    domains: [...new Set(memberships)].map(id => ({id: 'domain:' + id, name: id})),
    categories: ['Command History', 'DB Extensions', 'Multiplexer Extensions', 'Database', 'Editors'].map((name, index) => ({ name, domain: 'domain:' + memberships[index], commands: [{ name: 'item-' + index, description: 'Introduction' }], relations: [] })),
  };
  const groups = navigationGroups(buildModel(source));
  assert.equal(groups.find(group => group.id === 'domain:files').categories[0].name, 'Command History');
  assert.equal(groups.find(group => group.id === 'domain:editor').categories.length, 1);
  assert.equal(groups.find(group => group.id === 'domain:database').categories.length, 2);
  assert.ok(groups.find(group => group.id === 'domain:database'));
  assert.ok(groups.find(group => group.id === 'domain:terminal'));
  assert.ok(!groups.find(group => group.id === 'domain:reference'));
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
