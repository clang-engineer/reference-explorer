import { explorerFilter } from '../core/navigation.js';
import { renderMap, renderTagFilters } from './views.js';
import { categoryTag } from '../core/classification.js';
import { tagHostExpansion } from '../core/extensions.js';
import { createDetailPanel } from './details.js';

let nextId = 0;

// Owns the temporary map and its inline detail, independently of the background explorer.
export function createRelationDialog(root, { fetchImpl, clipboard }) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const lifetime = new window.AbortController();
  const listen = (type, callback) => dialog.addEventListener(type, callback, { signal: lifetime.signal });
  const dialog = document.createElement('dialog');
  dialog.className = 'dk-relation-dialog';
  dialog.setAttribute('aria-label', '분류 관계도');
  dialog.innerHTML = `<header class="dk-relation-header"><h2 data-map-title></h2><div class="dk-maptools"><span class="dk-maptools" data-map-controls>
    <button type="button" data-map-zoom="out" aria-label="관계도 축소">−</button><output data-map-scale>100%</output><button type="button" data-map-zoom="in" aria-label="관계도 확대">+</button><button type="button" data-map-zoom="fit">맞춤</button></span>
    <button type="button" data-close-map autofocus aria-label="관계도 닫기">닫기 ×</button></div></header>
    <div class="dk-tag-filters" data-map-tags role="group" aria-label="관계도 세부 분류 필터" hidden></div>
    <div class="dk-relation-workspace"><div class="dk-relation-viewport" data-map-viewport tabindex="0" aria-label="관계도. 스크롤하여 이동하세요."><div class="dk-stage" data-map-stage></div></div>
    <section class="dk-detail" data-map-detail aria-label="관계도에서 선택한 도구 상세" hidden></section></div>
    <p class="dk-legend" data-map-legend>실선: 대안·대체·특화 / 점선: 보완·래퍼. 도구나 선을 선택하면 상세로 전환합니다.</p>`;
  root.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const stage = $('[data-map-stage]');
  const viewport = $('[data-map-viewport]');
  const panel = $('[data-map-detail]');
  const details = createDetailPanel(panel, { fetchImpl, clipboard });
  const state = { model: null, groups: [], category: '', tag: '', expandedHosts: new Set(), query: '', zoom: 1, tool: '', tab: 'about', edge: '', markerPrefix: `modal-${++nextId}-` };
  let previousOverflow;
  let trigger;

  function highlight() {
    stage.querySelectorAll('[data-tool]').forEach(node => {
      node.classList.toggle('is-selected', node.dataset.tool === state.tool);
      node.setAttribute('aria-pressed', String(node.dataset.tool === state.tool));
    });
    stage.querySelectorAll('[data-edge]').forEach(node => {
      const edge = state.model.edges.find(edge => edge.id === node.dataset.edge);
      node.classList.toggle('is-selected', edge?.from === state.tool || edge?.to === state.tool);
      node.classList.toggle('is-muted', !!state.tool && edge?.from !== state.tool && edge?.to !== state.tool);
    });
  }
  function showMap() {
    viewport.hidden = false; panel.hidden = true;
    $('[data-map-controls]').hidden = false;
    $('[data-map-legend]').hidden = false;
    renderTagFilters($('[data-map-tags]'), state.model, state.category, state.tag);
  }
  function renderDetail() {
    details.show(state.model, state.tool, state.tab, state.edge);
    panel.querySelector('[data-close-detail]').textContent = '← 관계도';
  }
  function select(tool, edge = '') {
    if (!state.model.tools.has(tool)) return;
    state.tool = tool; state.edge = edge;
    viewport.hidden = true; panel.hidden = false;
    $('[data-map-controls]').hidden = true;
    $('[data-map-legend]').hidden = true;
    $('[data-map-tags]').hidden = true;
    renderDetail();
    panel.scrollTop = 0;
    panel.querySelector('[data-close-detail]').focus({ preventScroll: true });
    highlight();
  }
  function setZoom(value) {
    state.zoom = Math.max(.3, Math.min(2, value));
    stage.querySelectorAll('svg').forEach(svg => {
      svg.setAttribute('width', svg.dataset.width * state.zoom);
      svg.setAttribute('height', svg.dataset.height * state.zoom);
    });
    $('[data-map-scale]').textContent = Math.round(state.zoom * 100) + '%';
  }
  function fit() {
    const width = Math.max(1, ...[...stage.querySelectorAll('svg')].map(svg => Number(svg.dataset.width)));
    setZoom(Math.min(1, (viewport.clientWidth - 32) / width));
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
  }
  function cleanup() {
    if (previousOverflow !== undefined) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = undefined;
    }
    details.show(state.model, '');
    state.tool = ''; state.edge = '';
    showMap();
    stage.replaceChildren();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  }
  listen('close', cleanup);
  listen('cancel', event => { event.preventDefault(); dialog.close(); });
  listen('click', event => {
    event.stopPropagation();
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      return;
    }
    const element = event.target.closest('button, [data-tool], [data-edge], [data-toggle-host]');
    if (!element) return;
    const data = element.dataset;
    if ('closeMap' in data) dialog.close();
    else if (data.toggleHost) {
      if (!state.expandedHosts.delete(data.toggleHost)) state.expandedHosts.add(data.toggleHost);
      renderMap(stage, state, explorerFilter(state.model, state.groups, state.category, '', state.tag));
      fit();
      [...stage.querySelectorAll('[data-toggle-host]')].find(button => button.dataset.toggleHost === data.toggleHost)?.focus({ preventScroll: true });
    } else if ('categoryTag' in data) {
      state.tag = categoryTag(state.model, state.category, data.categoryTag);
      state.expandedHosts = tagHostExpansion(state.model, state.category, state.tag);
      renderTagFilters($('[data-map-tags]'), state.model, state.category, state.tag);
      renderMap(stage, state, explorerFilter(state.model, state.groups, state.category, '', state.tag));
      fit();
      [...$('[data-map-tags]').querySelectorAll('button')].find(button => button.dataset.categoryTag === state.tag)?.focus({ preventScroll: true });
    } else if ('closeDetail' in data) {
      const selected = [...stage.querySelectorAll('[data-tool]')].find(node => node.dataset.tool === state.tool);
      details.show(state.model, '');
      state.tool = ''; state.edge = '';
      showMap(); highlight();
      (selected || $('[data-close-map]')).focus({ preventScroll: true });
    } else if (data.mapZoom) {
      if (data.mapZoom === 'fit') fit();
      else setZoom(state.zoom + (data.mapZoom === 'in' ? .15 : -.15));
    } else if (data.tool || data.related) select(data.tool || data.related);
    else if (data.edge) {
      const edge = state.model.edges.find(edge => edge.id === data.edge);
      if (edge) { state.tab = 'about'; select(edge.to, edge.id); }
    } else if (data.tab) {
      state.tab = data.tab;
      renderDetail();
      panel.querySelector(`[data-tab="${state.tab}"]`)?.focus({ preventScroll: true });
    } else if ('tldrRetry' in data) details.retry();
    else if ('copy' in data) details.copy(element);
  });
  listen('keydown', event => {
    event.stopPropagation();
    if (event.target.matches('[data-tool], [data-edge], [data-toggle-host]') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      event.target.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    }
  });
  return {
    open(category, model, groups, opener) {
      state.model = model; state.groups = groups; state.category = category;
      state.zoom = 1; state.tool = ''; state.edge = ''; state.tab = 'about'; state.tag = ''; state.expandedHosts = new Set();
      showMap();
      $('[data-map-title]').textContent = `${model.categories.find(item => item.id === category)?.name || '분류'} 관계도`;
      trigger = opener;
      dialog.showModal();
      renderMap(stage, state, explorerFilter(model, groups, category, '', state.tag));
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      fit();
    },
    get isOpen() { return dialog.open; },
    destroy() {
      lifetime.abort();
      if (dialog.open) dialog.close();
      if (state.model) cleanup();
      details.destroy();
      dialog.remove();
    },
  };
}
