import { fetchCatalog } from '../core/reference-data.js';
import { buildModel, splitReference, validateCatalog } from '../core/catalog.js';
import { navigationGroups, explorerFilter, readExplorerHash } from '../core/navigation.js';
import { overviewHtml } from '../graph/overview.js';
import { buildCategoryOverview } from '../core/category-overview.js';
import { classifyExplorerModel, categoryTag } from '../core/classification.js';
import { tagHostExpansion } from '../core/extensions.js';
import { categoryOverviewHtml } from '../graph/category-overview.js';
import { shellHtml, renderNavigation, renderMap, renderList, renderTagFilters } from './views.js';
import { createDetailPanel } from './details.js';
import { createInspector } from './inspector.js';
import { createRelationDialog } from './relation-dialog.js';

const instances = new WeakMap();

export function mount(root, config = {}) {
  if (!root) return;
  if (instances.has(root)) return instances.get(root);
  const document = root.ownerDocument;
  const window = document.defaultView;
  const { location, history } = window;
  const fetchImpl = window.fetch.bind(window);
  const lifetime = new window.AbortController();
  const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: lifetime.signal });
  root.dataset.devkitMounted = 'true';
  const defaults = (config.defaultView || root.dataset.defaultView) === 'sheet' ? 'sheet' : 'map';
  const state = { model: null, groups: [], expanded: new Set(), tool: '', category: 'all', tag: '', query: '', tab: 'about', zoom: 1, error: '', edge: '', overviewMode: 'explore', expandedHosts: new Set(), overviewReturn: null };
  let categoryOverview;
  let loadRequest = 0;
  let catalogRequest;
  root.classList.add('dk-app');
  root.innerHTML = shellHtml;
  const $ = selector => root.querySelector(selector);
  const viewport = $('[data-viewport]'), stage = $('[data-stage]'), panel = $('[data-detail]');
  const details = createDetailPanel(panel, { fetchImpl, clipboard: window.navigator?.clipboard });
  const inspector = createInspector(root, panel, { onClose: closeDetail, signal: lifetime.signal });
  const relationDialog = createRelationDialog(root, { fetchImpl, clipboard: window.navigator?.clipboard });
  let searchOpen = false;
  let navOpen = false;
  root.dataset.detailOpen = 'false';
  function closeDetail() {
    state.tool = ''; state.edge = '';
    inspector.hide();
    details.show(state.model, '');
    highlight(); remember();
  }
  function clearSearch() {
    state.query = ''; searchOpen = false; $('[data-search]').value = '';
    render(); remember(); fitOverview();
  }
  function setNav(open) {
    navOpen = open; root.dataset.navOpen = String(open);
    $('[data-toggle-nav]').setAttribute('aria-expanded', String(open));
  }
  function remember() {
    const scope = state.model.categories.find(category => category.id === state.category)?.name || state.category;
    const hash = new URLSearchParams({ scope, tab: state.tab });
    if (state.overviewMode === 'macro') hash.set('overview', 'macro');
    if (state.expanded.size) hash.set('open', [...state.expanded].join(','));
    if (state.tag) hash.set('tag', state.tag);
    if (state.expandedHosts.size || state.tag || state.tool) hash.set('hosts', [...state.expandedHosts].join(','));
    if (state.tool) hash.set('tool', state.tool);
    if (state.query) hash.set('q', state.query);
    history.replaceState(null, '', '#' + hash);
  }
  function render() {
    if (!state.model) return;
    const filtered = explorerFilter(state.model, state.groups, state.category, state.query, state.tag);
    const overview = state.category === 'all' && !state.query.trim();
    const macro = overview && state.overviewMode === 'macro';
    root.dataset.currentView = 'explorer';
    renderNavigation($, state);
    renderTagFilters($('[data-category-tags]'), state.model, state.query.trim() ? 'all' : state.category, state.tag);
    $('[data-status]').textContent = state.error || (macro
      ? `${categoryOverview.nodes.length}개 분류 · ${categoryOverview.links.length}개 공통 도구 연결 · 분류를 선택하면 내부 관계도를 엽니다`
      : overview ? `${state.model.tools.size}개 도구 · ${state.model.edges.length}개 관계 · 분야 → 분류 → 도구 순으로 펼치거나 검색하세요` : `${filtered.matches.size}개 도구 · ${filtered.edges.length}개 관계${state.query ? ' · 모든 분야 검색' : ''}`);
    $('[data-retry]').hidden = !state.error;
    $('[data-results]').hidden = !state.query.trim() || !searchOpen;
    $('[data-clear-search]').hidden = !state.query.trim();
    $('[data-overview-actions]').hidden = !overview || macro;
    $('[data-overview-switch]').hidden = !overview;
    root.querySelectorAll('[data-overview-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.overviewMode === state.overviewMode)));
    if (state.query.trim()) renderList($('[data-list]'), state, filtered); else $('[data-list]').innerHTML = '';
    stage.classList.toggle('is-macro', macro);
    if (macro) stage.innerHTML = categoryOverviewHtml(categoryOverview, { zoom: state.zoom, compact: viewport.clientWidth < 700, maxWidth: viewport.clientWidth - 32 });
    else if (overview) stage.innerHTML = overviewHtml(state.groups, state.expanded, state.zoom, viewport.clientWidth < 700 ? 1 : 2, state.model, state.tool, state.expandedHosts);
    else renderMap(stage, state, filtered);
    $('[data-legend]').textContent = macro ? '선 = 공통 도구 · 굵기 = 공통 도구 수 · 내부 관계 수는 원본 분류에 등록된 도구 관계입니다. 대안·보완·학습 순서를 뜻하지 않습니다.' : overview ? (viewport.clientWidth < 700 ? '위아래로 스크롤해 모든 분야를 보세요. +로 분류 펼치기 · 선은 분류 연결입니다.' : '전체 조망에서 분야를 펼치고 도구를 선택하세요. 도구 관계는 분류 안에서 확인할 수 있습니다.') : '실선: 대안·대체·특화 / 점선: 보완·래퍼. 관계는 학습 순서나 출시 연대가 아닙니다. 배경을 드래그하거나 스크롤해 이동하세요.';
    $('[data-scale]').textContent = Math.round(state.zoom * 100) + '%';
    highlight();
  }
  function highlight() {
    const neighbors = new Set([state.tool]);
    for (const edge of state.model.edges) if (edge.from === state.tool || edge.to === state.tool) { neighbors.add(edge.from); neighbors.add(edge.to); }
    stage.querySelectorAll('[data-tool]').forEach(node => {
      node.classList.toggle('is-selected', node.dataset.tool === state.tool);
      node.classList.toggle('is-related', !!state.tool && node.dataset.tool !== state.tool && neighbors.has(node.dataset.tool));
      node.setAttribute('aria-pressed', String(node.dataset.tool === state.tool));
    });
    stage.querySelectorAll('[data-edge]').forEach(node => {
      const edge = state.model.edges.find(item => item.id === node.dataset.edge);
      node.classList.toggle('is-selected', edge?.from === state.tool || edge?.to === state.tool);
    });
  }
  function centerSelected() {
    const node = [...stage.querySelectorAll('[data-tool]')].find(item => item.dataset.tool === state.tool);
    if (!node) return;
    const box = node.getBoundingClientRect(), frame = viewport.getBoundingClientRect();
    viewport.scrollLeft += box.left - frame.left - (viewport.clientWidth - box.width) / 2;
    viewport.scrollTop += box.top - frame.top - (viewport.clientHeight - box.height) / 2;
  }
  function choose(id, reveal = true) {
    if (!state.model.tools.has(id)) return;
    state.tool = id; state.edge = '';
    $('[data-announcement]').textContent = state.model.tools.get(id).name + ' 선택됨';
    highlight(); remember(); renderDetail();
    inspector.show();
    if (reveal) centerSelected();
  }
  function renderDetail() {
    details.show(state.model, state.tool, state.tab, state.edge);
  }
  function setZoom(value) {
    const before = state.zoom;
    state.zoom = Math.max(.3, Math.min(2, value));
    stage.querySelectorAll('svg').forEach(svg => { svg.setAttribute('width', svg.dataset.width * state.zoom); svg.setAttribute('height', svg.dataset.height * state.zoom); });
    viewport.scrollLeft = (viewport.scrollLeft + viewport.clientWidth / 2) * state.zoom / before - viewport.clientWidth / 2;
    viewport.scrollTop = (viewport.scrollTop + viewport.clientHeight / 2) * state.zoom / before - viewport.clientHeight / 2;
    $('[data-scale]').textContent = Math.round(state.zoom * 100) + '%';
  }
  function goToScope(scope) {
    if (state.category === 'all' && scope !== 'all' && !state.query.trim()) state.overviewReturn = { expanded: new Set(state.expanded), zoom: state.zoom, left: viewport.scrollLeft, top: viewport.scrollTop };
    state.category = scope; state.tag = ''; state.query = ''; searchOpen = false; $('[data-search]').value = ''; state.zoom = 1;
    setNav(false);
    const parent = state.groups.find(group => group.id === scope || group.categories.some(category => category.id === scope));
    if (parent) state.expanded.add(parent.id);
    render(); remember(); viewport.scrollTop = 0; viewport.scrollLeft = 0;
    if (scope === 'all') {
      if (state.overviewReturn) { const previous = state.overviewReturn; state.overviewReturn = null; state.expanded = previous.expanded; render(); setZoom(previous.zoom); viewport.scrollLeft = previous.left; viewport.scrollTop = previous.top; remember(); }
      else fitOverview();
    }
  }
  function findTool(id, tab = state.tab, keepSearch = false) {
    const tool = state.model.tools.get(id);
    if (!tool) return;
    state.tab = tab;
    for (const host of Object.values(tool.hostsByCategory || {}).flat()) state.expandedHosts.add(host);
    searchOpen = false;
    if (keepSearch && state.query.trim()) render();
    else goToScope(tool.categories[0] || 'all');
    choose(id); centerSelected();
  }
  function fitOverview() {
    const svg = stage.querySelector('svg');
    if (svg && state.category === 'all' && !state.query.trim()) {
      setZoom(Math.min(1, Math.max(state.overviewMode === 'macro' ? .3 : .78, (viewport.clientWidth - 32) / Number(svg.dataset.width))));
      viewport.scrollLeft = 0;
    }
  }
  function activate(event) {
    const element = event.target.closest('button, [data-tool], [data-edge], [data-category], [data-expand], [data-open-map], [data-toggle-host]');
    if (!element || !root.contains(element)) return;
    const data = element.dataset;
    if ('retry' in data) { start(); return; }
    if ('toggleNav' in data) { setNav(!navOpen); return; }
    if ('closeDetail' in data && state.model) { closeDetail(); return; }
    if ('clearSearch' in data && state.model) { clearSearch(); $('[data-search]').focus(); return; }
    if (!state.model) return;
    if (data.openMap) { relationDialog.open(data.openMap, state.model, state.groups, element); return; }
    if (data.toggleHost) {
      if (!state.expandedHosts.delete(data.toggleHost)) state.expandedHosts.add(data.toggleHost);
      render(); remember();
      [...stage.querySelectorAll('[data-toggle-host]')].find(button => button.dataset.toggleHost === data.toggleHost)?.focus({ preventScroll: true });
      return;
    }
    if ('categoryTag' in data) {
      state.tag = categoryTag(state.model, state.category, data.categoryTag); state.zoom = 1;
      state.expandedHosts = tagHostExpansion(state.model, state.category, state.tag);
      render(); remember(); viewport.scrollTop = 0; viewport.scrollLeft = 0;
      [...$('[data-category-tags]').querySelectorAll('button')].find(button => button.dataset.categoryTag === state.tag)?.focus({ preventScroll: true });
      return;
    }
    if (data.overviewMode) {
      state.overviewMode = data.overviewMode; state.zoom = 1;
      render(); fitOverview(); remember(); viewport.scrollTop = 0;
      return;
    }
    if (data.category) {
      if (state.category === 'all' && !state.query.trim() && state.groups.some(group => group.id === data.category)) {
        const parent = state.groups.find(group => group.id === data.category);
        if (parent) { state.expanded.add(parent.id); render(); remember(); return; }
      }
      goToScope(data.category);
      if (event.detail === 0) $('[data-categories]').querySelector(`[data-category="${data.category}"]`)?.focus();
    } else if (data.expand || 'expandAll' in data || 'collapseAll' in data) {
      if ('expandAll' in data) state.expanded = new Set(state.groups.map(group => group.id));
      else if ('collapseAll' in data) state.expanded.clear();
      else if (!state.expanded.delete(data.expand)) state.expanded.add(data.expand);
      render(); remember(); fitOverview();
      if (data.expand) {
        const area = element.closest('svg') ? stage : $('[data-categories]');
        area.querySelector(`[data-expand="${data.expand}"]`)?.focus({ preventScroll: true });
      }
    } else if (data.quick || data.searchTool) findTool(data.quick || data.searchTool, data.quick ? 'usage' : 'about', true);
    else if (data.tool) choose(data.tool, false);
    else if (data.edge) {
      const edge = state.model.edges.find(item => item.id === data.edge);
      if (edge) { state.tab = 'about'; choose(edge.to); state.edge = edge.id; renderDetail(); }
    } else if (data.related) {
      if (state.category === 'all' && !state.query.trim()) {
        const parent = state.groups.find(group => group.tools.has(data.related));
        if (parent) {
          state.expanded.add(parent.id);
          const category = parent.categories.find(category => state.model.tools.get(data.related).categories.includes(category.id));
          state.expanded.add(category.id);
        }
        render(); choose(data.related, false);
      }
      else findTool(data.related, 'about');
    }
    else if (data.tab) { state.tab = data.tab; remember(); renderDetail(); if (event.detail === 0) $('[data-tab="' + data.tab + '"]').focus(); }
    else if (data.zoom) {
      if (data.zoom === 'fit') {
        const width = Math.max(1, ...[...stage.querySelectorAll('svg')].map(svg => Number(svg.dataset.width)));
        setZoom(Math.min(1, (viewport.clientWidth - 36) / width)); viewport.scrollLeft = 0;
      } else setZoom(data.zoom === 'reset' ? 1 : state.zoom + (data.zoom === 'in' ? .15 : -.15));
    } else if ('tldrRetry' in data) details.retry();
    else if ('copy' in data) details.copy(element);
  }
  listen(root, 'click', activate);
  listen(root, 'keydown', event => {
    if (event.target.matches('[data-tool], [data-edge], [data-category], [data-expand], [data-open-map], [data-toggle-host]') && event.target.tagName.toLowerCase() === 'g' && ['Enter', ' '].includes(event.key)) { event.preventDefault(); activate(event); }
  });
  listen($('[data-search]'), 'input', event => {
    state.query = event.target.value; searchOpen = !!state.query.trim(); render(); remember(); viewport.scrollTop = 0; viewport.scrollLeft = 0;
    if (!state.query.trim()) fitOverview();
  });
  listen($('[data-search]'), 'keydown', event => {
    if (!state.model) return;
    if (event.key === 'Escape') { event.stopPropagation(); if (state.tool) closeDetail(); else clearSearch(); }
    if (event.key === 'ArrowDown' && state.query.trim()) {
      searchOpen = true; $('[data-results]').hidden = false;
      $('[data-list]').querySelector('[data-search-tool]')?.focus(); event.preventDefault();
    }
    if (event.key === 'Enter') {
      const first = $('[data-list]').querySelector('[data-quick]');
      if (first) { event.preventDefault(); findTool(first.dataset.quick, 'usage', true); }
    }
  });
  let drag = null;
  listen(viewport, 'pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('[data-tool], [data-edge], [data-category], [data-expand], [data-open-map], [data-toggle-host]')) return;
    drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging'); event.preventDefault();
  });
  listen(viewport, 'pointermove', event => {
    if (!drag) return;
    viewport.scrollLeft = drag.left + drag.x - event.clientX; viewport.scrollTop = drag.top + drag.y - event.clientY;
  });
  const stopDrag = () => { drag = null; viewport.classList.remove('is-dragging'); };
  listen(viewport, 'pointerup', stopDrag); listen(viewport, 'pointercancel', stopDrag); listen(viewport, 'lostpointercapture', stopDrag);
  // CSS workspace mode also works on iPad and embedded hosts without Fullscreen API.
  let workspace = false;
  function toggleWorkspace() {
    workspace = !workspace;
    root.classList.toggle('is-expanded', workspace);
    $('[data-fullscreen]').textContent = workspace ? '넓게 보기 닫기 ×' : '넓게 보기 ⛶';
    if (state.model) { render(); fitOverview(); inspector.sync(); }
  }
  listen($('[data-fullscreen]'), 'click', toggleWorkspace);
  listen($('[data-search]'), 'focus', () => {
    if (state.query.trim()) { searchOpen = true; $('[data-results]').hidden = false; }
  });
  listen(root, 'focusout', event => {
    if (event.relatedTarget && !event.relatedTarget.closest?.('.dk-search-wrap')) {
      searchOpen = false; $('[data-results]').hidden = true;
    }
  });
  listen(document, 'pointerdown', event => {
    if (!event.target.closest?.('.dk-search-wrap')) { searchOpen = false; $('[data-results]').hidden = true; }
  });
  listen($('[data-list]'), 'keydown', event => {
    const rows = [...$('[data-list]').querySelectorAll('[data-search-tool]')];
    const row = event.target.closest?.('.dk-search-row')?.querySelector('[data-search-tool]');
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) $('[data-search]').focus(); else rows[Math.min(next, rows.length - 1)]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      $('[data-search]').focus(); searchOpen = false; $('[data-results]').hidden = true;
    }
  });
  listen(window, 'keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !event.target.matches?.('input, textarea, select, [contenteditable="true"]') && !$('[data-detail-dialog]').open) {
      event.preventDefault(); $('[data-search]').focus();
    } else if (event.key === 'Escape' && !relationDialog.isOpen && !$('[data-detail-dialog]').open) {
      if (state.tool) closeDetail();
      else if (navOpen) setNav(false);
      else if (workspace) toggleWorkspace();
    }
  });
  function restore() {
    state.overviewReturn = null;
    Object.assign(state, readExplorerHash(location.hash, state.model, state.groups, defaults));
    $('[data-search]').value = state.query; searchOpen = false; render(); if (state.tool) choose(state.tool, false); else { inspector.hide({ focus: false }); renderDetail(); } centerSelected(); fitOverview();
  }
  listen(window, 'resize', () => { if (state.model && state.category === 'all' && !state.query.trim()) { render(); fitOverview(); } });
  listen(window, 'hashchange', () => { if (state.model) restore(); });
  async function start() {
    const request = ++loadRequest;
    catalogRequest?.abort();
    catalogRequest = new window.AbortController();
    const requestOptions = { fetchImpl, signal: catalogRequest.signal };
    $('[data-retry]').hidden = true; $('[data-search]').disabled = true;
    $('[data-status]').textContent = 'Reference 데이터를 불러오는 중…';
    try {
      let model = config.model;
      if (!model) {
        const catalog = config.catalog || await fetchCatalog(config.catalogUrl || root.dataset.catalog || root.getAttribute('src'), requestOptions);
        const reference = splitReference(catalog);
        validateCatalog(reference.catalog, 'categories');
        validateCatalog(reference.cheats, 'groups');
        model = buildModel(reference.catalog, reference.cheats);
      }
      if (request !== loadRequest) return;
      state.model = classifyExplorerModel(model);
      state.groups = navigationGroups(state.model);
      categoryOverview = buildCategoryOverview(state.model);
      state.error = '';
      $('[data-search]').disabled = false; restore();
    } catch {
      if (request !== loadRequest) return;
      $('[data-status]').textContent = 'Reference 데이터를 불러오지 못했습니다. 네트워크 연결과 카탈로그 형식을 확인하고 다시 시도하세요.';
      $('[data-retry]').hidden = false;
    }
  }
  const api = {
    ready: null,
    destroy() {
      if (lifetime.signal.aborted) return;
      ++loadRequest;
      catalogRequest?.abort();
      lifetime.abort();
      relationDialog.destroy();
      details.destroy();
      inspector.destroy();
      root.classList.remove('is-expanded');
      instances.delete(root);
      delete root.dataset.devkitMounted;
      root.innerHTML = '';
    },
  };
  instances.set(root, api);
  api.ready = start();
  return api;
}
