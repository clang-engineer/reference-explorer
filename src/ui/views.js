// Markup only: no network, history, or application event handlers.
import { escapeHtml as esc } from '../core/reference-data.js';
import { RELATIONS } from '../core/catalog.js';
import { toolHierarchy } from '../core/extensions.js';
import { layoutToolHierarchy } from '../graph/tool-hierarchy.js';
import { routeConnections } from '../graph/routing.js';

function shortLabel(value, limit) {
  let text = '', units = 0;
  for (const char of value) {
    units += char.codePointAt(0) > 255 ? 2 : 1;
    if (units > limit) return text + '…';
    text += char;
  }
  return text;
}

export const shellHtml = `
  <header class="dk-heading">
    <div class="dk-brand"><span class="dk-brand-icon" aria-hidden="true">⌘</span><div><p class="dk-eyebrow">DEVKIT</p><h2>도구 탐색기</h2></div></div>
    <div class="dk-search-wrap">
      <label class="dk-search"><span class="dk-sr">모든 분야에서 도구 검색</span><span aria-hidden="true" class="dk-search-icon">⌕</span><input type="search" data-search placeholder="도구 검색 · fd, tmux, git…" autocomplete="off" aria-controls="devkit-search-results" disabled></label>
      <button type="button" class="dk-search-clear" data-clear-search hidden aria-label="검색 지우기">×</button>
      <section class="dk-search-results" data-results hidden><p class="dk-search-hint">전체 분야 검색 · ↑↓ 이동 · Enter 사용법</p><div id="devkit-search-results" data-list></div></section>
    </div>
    <button type="button" data-fullscreen aria-label="탐색 화면 넓게 보기">넓게 보기 ⛶</button>
  </header>
  <div class="dk-statusbar"><p data-status role="status">Devkit 데이터를 불러오는 중…</p><button type="button" data-retry hidden>다시 시도</button></div>
  <p class="dk-sr" data-announcement role="status"></p>
  <div class="dk-layout">
    <aside class="dk-sidebar" aria-label="도구 분야"><button type="button" class="dk-nav-toggle" data-toggle-nav aria-expanded="false">분야 선택 <span aria-hidden="true">⌄</span></button><nav class="dk-navigation" data-categories aria-label="전체와 세부 분류"></nav></aside>
    <section class="dk-explorer" aria-label="도구 탐색">
      <div class="dk-map-header"><nav class="dk-breadcrumb" data-breadcrumb aria-label="지도 위치"></nav><div class="dk-maptools" data-maptools><span data-overview-actions><button type="button" data-expand-all>분류 모두 펼치기</button><button type="button" data-collapse-all>모두 접기</button></span><div>
        <button type="button" data-zoom="out" aria-label="지도 축소">−</button><output data-scale>100%</output><button type="button" data-zoom="in" aria-label="지도 확대">+</button><button type="button" data-zoom="fit">맞춤</button><button type="button" data-zoom="reset" aria-label="지도 배율 초기화">1:1</button></div></div></div>
      <div class="dk-tag-filters" data-category-tags role="group" aria-label="세부 분류 필터" hidden></div>
      <div class="dk-viewport" data-viewport tabindex="0" aria-label="도구 지도. 드래그 또는 방향키로 이동하고 Tab으로 도구를 선택합니다."><div class="dk-stage" data-stage></div></div>
      <p class="dk-legend" data-legend></p>
    </section>
    <aside class="dk-panel-host" data-panel-host hidden><section class="dk-detail" data-detail aria-label="선택한 도구 상세"></section></aside>
  </div>
  <dialog class="dk-detail-dialog" data-detail-dialog aria-label="선택한 도구 상세"></dialog>`;

export function renderNavigation($, state) {
  const active = state.groups.find(group => group.id === state.category || group.categories.some(category => category.id === state.category));
  $('[data-categories]').innerHTML = `<button type="button" class="dk-nav-all" data-category="all" aria-pressed="${state.category === 'all' && !state.query}">전체 조망 <small>${state.model.tools.size}</small></button>` + state.groups.map(group => {
    const open = state.expanded.has(group.id);
    return `<section class="dk-nav-group"><div class="dk-nav-heading"><button type="button" data-category="${group.id}" aria-pressed="${group.id === state.category}"><span>${group.name}</span><small>${group.tools.size}</small></button><button type="button" data-expand="${group.id}" aria-expanded="${open}" aria-label="${group.name} 세부 분류 ${open ? '접기' : '펼치기'}">${open ? '−' : '+'}</button></div><div class="dk-nav-children"${open ? '' : ' hidden'}>${group.categories.map(category => `<button type="button" data-category="${esc(category.id)}" aria-pressed="${category.id === state.category}">${esc(category.name)}<small>${category.count}</small></button>`).join('')}</div></section>`;
  }).join('');
  const category = state.model.categories.find(category => category.id === state.category);
  $('[data-breadcrumb]').innerHTML = `<button type="button" data-category="all">전체 조망</button>` + (state.query ? '<span> / 전체 검색 결과</span>' : active ? `<span> / </span><button type="button" data-category="${active.id}">${active.name}</button>${category ? `<span> / ${esc(category.name)}</span>` : ''}` : '<span> / 분야별 탐색</span>');
}

export function renderTagFilters(target, model, categoryId, selected = '') {
  const category = model.categories.find(category => category.id === categoryId);
  target.hidden = !category?.tags?.length;
  if (target.hidden) { target.innerHTML = ''; return; }
  const tools = [...model.tools.values()].filter(tool => tool.categories.includes(categoryId));
  const options = [{ id: '', name: '전체', count: tools.length }, ...category.tags.map(tag => ({
    ...tag, count: tools.filter(tool => tool.categoryTags?.[categoryId]?.includes(tag.id)).length,
  }))];
  target.innerHTML = options.map(tag => `<button type="button" data-category-tag="${esc(tag.id)}" aria-pressed="${selected === tag.id}">${esc(tag.name)} <small>${tag.count}</small></button>`).join('');
}

export function renderMap(stage, state, filtered) {
  const document = stage.ownerDocument;
  stage.innerHTML = '';
  for (const category of state.model.categories) {
    const group = state.groups.find(group => group.id === state.category);
    if (!state.query.trim() && state.category !== 'all' && (group ? !group.categories.some(item => item.id === category.id) : category.id !== state.category)) continue;
    const ids = [...filtered.visible].filter(id => state.model.tools.get(id).categories.includes(category.id));
    if (!ids.length) continue;
    const hierarchy = state.query.trim() ? { ids, groups: new Map(), owners: new Map(), hiddenCount: 0 }
      : toolHierarchy(state.model, category.id, new Set(ids), state.expandedHosts);
    const visible = new Set(hierarchy.ids);
    const edges = filtered.edges.filter(edge => edge.category === category.id && visible.has(edge.from) && visible.has(edge.to));
    const layout = layoutToolHierarchy(hierarchy, edges, Math.max(168, (stage.parentElement?.clientWidth || 992) - 32));
    const markerId = `arrow-${state.markerPrefix || ''}${category.id}`;
    const routes = routeConnections(layout, edges);
    const edgeHtml = edges.map((edge, index) => {
      const route = routes[index];
      if (!route) return '';
      const path = route.path;
      const label = `${state.model.tools.get(edge.from).name} → ${state.model.tools.get(edge.to).name}: ${RELATIONS[edge.relation] || edge.relation || '관계'}`;
      return `<g class="dk-edge${['complement', 'wrapper'].includes(edge.relation) ? ' is-complement' : ''}" data-edge="${edge.id}" role="button" tabindex="0" aria-label="${esc(label)}"><title>${esc(label)}</title><path class="dk-edge-hit" d="${path}"/><path class="dk-edge-halo" d="${path}"/><path class="dk-edge-line" d="${path}" marker-end="url(#${markerId})"/></g>`;
    }).join('');
    const frames = layout.frames.map(frame => `<g class="dk-extension-frame"><title>${esc(state.model.tools.get(frame.host).name)} 확장 도구 · 소속 묶음이며 도구 관계선이 아닙니다.</title><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}"/></g>`).join('');
    const nodes = hierarchy.ids.map(id => {
      const tool = state.model.tools.get(id), pos = layout.positions.get(id);
      const extensions = hierarchy.groups.get(id) || [];
      const open = state.expandedHosts?.has(id) || false;
      const width = layout.nodeWidth - (extensions.length ? 28 : 0);
      const node = `<g class="dk-node${state.query.trim() && !filtered.matches.has(id) ? ' is-context' : ''}${!filtered.visible.has(id) ? ' dk-context-host' : ''}" data-tool="${esc(id)}" role="button" tabindex="0" aria-label="${esc(tool.name + ' 상세 보기')}" aria-pressed="false" transform="translate(${pos.x},${pos.y})"><title>${esc(tool.name + (!filtered.visible.has(id) ? ' · 사용 환경' : '') + (tool.description ? ' · ' + tool.description : ''))}</title><rect width="${width}" height="${layout.nodeHeight}"/><text x="10" y="21" class="dk-node-title">${esc(shortLabel(tool.name, extensions.length ? 8 : 12))}</text></g>`;
      const toggle = extensions.length ? `<g class="dk-host-toggle" data-toggle-host="${esc(id)}" role="button" tabindex="0" aria-expanded="${open}" aria-label="${esc(tool.name)} 확장 도구 ${extensions.length}개 ${open ? '접기' : '펼치기'}" transform="translate(${pos.x + width + 2},${pos.y})"><title>${esc(tool.name)} 확장 도구 ${extensions.length}개</title><rect width="26" height="${layout.nodeHeight}"/><text x="13" y="21" text-anchor="middle">${open ? '−' : '+'}${extensions.length}</text></g>` : '';
      return node + toggle;
    }).join('');
    const board = document.createElement('section');
    board.className = 'dk-board';
    board.innerHTML = `<h3>${esc(category.name)} <small>${ids.length}개${hierarchy.hiddenCount ? ` · 확장 ${hierarchy.hiddenCount}개 접힘` : ''}</small></h3><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width * state.zoom}" height="${layout.height * state.zoom}" data-width="${layout.width}" data-height="${layout.height}" role="group" aria-label="${esc(category.name)} 관계 지도"><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>${frames}${edgeHtml}${nodes}</svg>`;
    stage.append(board);
  }
  if (!stage.children.length) stage.innerHTML = '<p class="dk-empty">검색 결과가 없습니다. 검색어 또는 분야를 바꿔보세요.</p>';
}

export function renderList(list, state, filtered) {
  const query = state.query.trim().toLowerCase();
  const ids = [...filtered.matches].sort((a, b) => Number(state.model.tools.get(b).aliases.has(query)) - Number(state.model.tools.get(a).aliases.has(query)));
  list.innerHTML = ids.map(id => {
    const tool = state.model.tools.get(id);
    return `<div class="dk-search-row"><button type="button" class="dk-tool-row" data-search-tool="${esc(id)}"><strong>${esc(tool.name)}</strong><span>${esc(tool.description || '소개와 자료 보기')}</span></button><button type="button" data-quick="${esc(id)}" aria-label="${esc(tool.name)} 사용법 바로 보기">사용법 →</button></div>`;
  }).join('') || '<p class="dk-empty">검색 결과가 없습니다.</p>';
}
