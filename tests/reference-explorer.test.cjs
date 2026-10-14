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
