import { pluginRole, pluginSection } from '../core/plugin-labels.js';
import { escapeHtml as esc } from '../core/reference-data.js';
import { toolHierarchy } from '../core/extensions.js';

// Purpose cards include every tool, including tools without registered relations.
export function overviewHtml(groups, expanded, zoom = 1, columns = 2, model = null, focused = '', expandedHosts = new Set()) {
  return `<div class="dk-purpose-grid">${groups.map(group => `<section class="dk-purpose-card" data-domain="${esc(group.id)}"><header><h3>${esc(group.name)}</h3><small>${group.tools.size}개 도구</small></header>${group.categories.map(category => {
    const visible = new Set([...group.tools].filter(id => model?.tools.get(id)?.categories.includes(category.id)));
    const hierarchy = model ? toolHierarchy(model, category.id, visible, expandedHosts) : { ids: [], groups: new Map(), owners: new Map() };
    const open = expanded.has(category.id);
    let previousSection = '';
    const ids = open ? hierarchy.ids : hierarchy.ids.slice(0, 4);
    return `<section class="dk-purpose-category"><div class="dk-purpose-label"><button type="button" data-expand="${esc(category.id)}" aria-expanded="${open}">${esc(category.name)} <small>${category.count}</small></button><button type="button" data-open-map="${esc(category.id)}" aria-label="${esc(category.name)} 관계도 열기">↗</button></div><div class="dk-purpose-tools">${ids.map(id => {
      const tool = model.tools.get(id), children = hierarchy.groups.get(id) || [];
      const hostOpen = expandedHosts.has(id);
      const owner = hierarchy.owners.get(id);
      const section = owner ? pluginSection(tool, category.id) : '';
      const heading = section && section !== previousSection ? `<span class="dk-purpose-plugin-heading">${esc(section)}</span>` : '';
      previousSection = section;
      return heading + `<span class="dk-purpose-tool${hierarchy.owners.has(id) ? ' dk-purpose-extension dk-extension-child' : ''}"><button type="button" data-tool="${esc(id)}" title="${esc(tool.description || tool.name)}" aria-pressed="${focused === id}">${esc(tool.name)}${owner && pluginRole(tool) ? `<small class="dk-purpose-role">${esc(pluginRole(tool))}</small>` : ''}</button>${children.length ? `<button type="button" data-toggle-host="${esc(id)}" aria-expanded="${hostOpen}" aria-label="${esc(tool.name)} 확장 도구 ${hostOpen ? '접기' : '펼치기'}">${hostOpen ? '−' : '+'}${children.length}</button>` : ''}</span>`;
    }).join('')}</div>${!open && hierarchy.ids.length > ids.length ? `<button class="dk-purpose-more" type="button" data-expand="${esc(category.id)}">+${hierarchy.ids.length - ids.length}개 더 보기</button>` : ''}</section>`;
  }).join('')}</section>`).join('')}</div>`;
}
