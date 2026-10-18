const {test} = require('node:test');
const assert = require('node:assert/strict');
test('expanded Neovim sections preserve every plugin and fit labeled nodes inside section frames', async () => {
  const {buildModel} = await import('../src/core/catalog.js');
  const {classifyExplorerModel} = await import('../src/core/classification.js');
  const {toolHierarchy} = await import('../src/core/extensions.js');
  const {layoutToolHierarchy} = await import('../src/graph/tool-hierarchy.js');
  const {overviewHtml} = await import('../src/graph/overview.js');
  const {navigationGroups} = await import('../src/core/navigation.js');
  const category = (name, ids) => ({name, commands:ids.map(name=>({name})), relations:[]});
  const model = classifyExplorerModel(buildModel({categories:[category('Editors',['neovim']),category('Neovim Plugins · 탐색',['flash.nvim','outline.nvim']),category('Neovim Plugins · 편집',['mini.comment'])]}));
  const hierarchy = toolHierarchy(model,'role:editor',new Set(model.tools.keys()),new Set(['neovim']));
  assert.deepEqual(hierarchy.sections.get('neovim').map(s=>s.name),['탐색','편집']);
  assert.equal(new Set(hierarchy.ids).size,4);
  for (const width of [200,390,960]) {
    const layout = layoutToolHierarchy(hierarchy,[],width);
    assert.equal(layout.sections.length,2);
    for (const section of layout.sections) {
      const ids = hierarchy.sections.get('neovim').find(s=>s.name===section.name).ids;
      for (const id of ids) {
        const pos=layout.positions.get(id);
        assert.ok(pos.y >= section.y+26);
        assert.ok(pos.y+layout.nodeHeight <= section.y+section.height);
        assert.ok(pos.x+layout.nodeWidth <= section.x+section.width);
      }
    }
  }
  const html=overviewHtml(navigationGroups(model),new Set(['role:editor']),1,2,model,'',new Set(['neovim']));
  assert.ok(html.includes('dk-purpose-plugin-heading"> 탐색'.replace('> ', '>')));
  assert.ok(html.includes('주석 토글'));
});
