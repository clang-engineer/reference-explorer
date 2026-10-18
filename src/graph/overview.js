import { pluginRole, pluginSection } from '../core/plugin-labels.js';
import { escapeHtml as esc } from '../core/reference-data.js';
import { purposeHierarchy } from '../core/extensions.js';

export function overviewHtml(groups, expanded, zoom = 1, columns = 2, model = null, focused = '', expandedHosts = new Set()) {
  return `<div class="dk-purpose-grid">${groups.map(group => {
    const { model: projected, hierarchy } = purposeHierarchy(model, group, expandedHosts);
    let previousSection = '';
    return `<section class="dk-purpose-card" data-domain="${esc(group.id)}"><header><h3>${esc(group.name)}</h3><small>${group.tools.size}개 항목</small><button type="button" data-open-map="${esc(group.id)}" aria-label="${esc(group.name)} 관계도 열기">↗</button></header><div class="dk-purpose-tools">${hierarchy.ids.map(id => {
      const tool = projected.tools.get(id), children = hierarchy.groups.get(id) || [];
      const owner = hierarchy.owners.get(id), hostOpen = expandedHosts.has(id);
      const section = owner === 'neovim' ? pluginSection(tool, group.id) : '';
      const heading = section && section !== previousSection ? `<span class="dk-purpose-plugin-heading">${esc(section)}</span>` : '';
      previousSection = section;
      const role = owner ? pluginRole(tool) : '';
      return heading + `<span class="dk-purpose-tool${owner ? ' dk-purpose-extension dk-extension-child' : ''}"><button type="button" data-tool="${esc(id)}" title="${esc(tool.description || tool.name)}" aria-pressed="${focused === id}">${esc(tool.name)}${tool.kind === 'language' ? '<small class="dk-purpose-role">언어</small>' : role ? `<small class="dk-purpose-role">${esc(role)}</small>` : ''}</button>${children.length ? `<button type="button" data-toggle-host="${esc(id)}" aria-expanded="${hostOpen}" aria-label="${esc(tool.name)} 하위 항목 ${hostOpen ? '접기' : '펼치기'}">${hostOpen ? '−' : '+'}${children.length}</button>` : ''}</span>`;
    }).join('')}</div></section>`;
  }).join('')}</div>`;
}
