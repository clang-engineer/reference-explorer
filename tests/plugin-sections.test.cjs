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

test('purpose hierarchy retains merged memberships while restored cards retain source sections', async () => {
  const {buildModel} = await import('../src/core/catalog.js');
  const {classifyExplorerModel} = await import('../src/core/classification.js');
  const {navigationGroups} = await import('../src/core/navigation.js');
  const {overviewHtml} = await import('../src/graph/overview.js');
  const {purposeHierarchy} = await import('../src/core/extensions.js');
  const cat=(name,names)=>({name,commands:names.map(name=>({name})),relations:[]});
  const model=classifyExplorerModel(buildModel({categories:[cat('File Operations',['bat']),cat('Text Search',['bat','grep']),cat('Editors',['neovim']),cat('Neovim Plugins · 編集',['mini.comment'])]}));
  const groups=navigationGroups(model);
  const html=overviewHtml(groups,new Set(),1,2,model);
  assert.equal([...html.matchAll(/data-tool="bat"/g)].length,2);
  assert.ok(!html.includes('data-tool="mini.comment"'));
  const open=overviewHtml(groups,new Set(['role:editor']),1,2,model,'',new Set(['neovim']));
  assert.ok(open.includes('data-tool="mini.comment"'));
  const group=groups.find(g=>g.id==='domain:editor');
  assert.equal(purposeHierarchy(model,group,new Set()).hierarchy.hiddenCount,1);
  assert.equal(purposeHierarchy(model,group,new Set(['neovim'])).hierarchy.hiddenCount,0);
});
