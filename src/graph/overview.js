import { escapeHtml as esc } from '../core/reference-data.js';

// Domain connectors describe membership, never tool alternatives or learning order.
// On narrow canvases use one readable column instead of shrinking every label.
export function overviewHtml(groups, expanded, zoom = 1, columns = 2, model = null, focused = '') {
  const compact = columns === 1;
  const width = compact ? 324 : 880;
  const cardWidth = compact ? 276 : 260;
  const rootX = width / 2;
  const rows = [[], []];
  const categoryTools = (group, category) => model && expanded.has(category.id)
    ? [...group.tools].filter(id => model.tools.get(id)?.categories.includes(category.id)) : [];
  const cardHeight = group => expanded.has(group.id) ? 72 + group.categories.reduce((sum, category) => sum + 40 + categoryTools(group, category).length * 30, 0) : 68;
  const heights = [0, 0];
  for (const [index, group] of groups.entries()) {
    const side = compact ? 0 : index % 2;
    rows[side].push(group);
    heights[side] += cardHeight(group) + 24;
  }
  const height = Math.max(360, ...heights) + (compact ? 122 : 48);
  const centerY = compact ? 44 : height / 2;
  let connectors = '', cards = '';
  rows.forEach((items, side) => {
    let y = compact ? 116 : 24;
    for (const group of items) {
      const open = expanded.has(group.id);
      const x = compact ? 32 : side === 0 ? 24 : width - cardWidth - 24;
      const anchorX = compact ? 16 : side === 0 ? x + cardWidth : x;
      const startX = compact ? 16 : rootX + (side === 0 ? -86 : 86);
      const anchorY = y + 34;
      const path = compact
        ? `M${rootX},76 H16 V${anchorY} H${x}`
        : `M${startX},${centerY} C${(startX + anchorX) / 2},${centerY} ${(startX + anchorX) / 2},${anchorY} ${anchorX},${anchorY}`;
      connectors += `<path data-domain="${esc(group.id)}" d="${path}"/>`;
      let categoryY = 68;
      const categories = open ? group.categories.map(category => { const ids = categoryTools(group, category); const offset = categoryY; categoryY += 40 + ids.length * 30; const relations = model ? model.edges.filter(edge => edge.category === category.id && ids.includes(edge.from) && ids.includes(edge.to)) : [];
      const relationPaths = relations.map(edge => { const from = ids.indexOf(edge.from), to = ids.indexOf(edge.to); const y1 = offset + 52 + from * 30, y2 = offset + 52 + to * 30; return `<path class="dk-inline-relation${['complement','wrapper'].includes(edge.relation) ? ' is-complement' : ''}${focused && (edge.from === focused || edge.to === focused) ? ' is-selected' : ''}" d="M${cardWidth - 27},${y1} H${cardWidth - 18} V${y2} H${cardWidth - 27}"/>`; }).join('');
      return `${relationPaths}<g class="dk-overview-category" data-expand="${esc(category.id)}" role="button" tabindex="0" aria-expanded="${expanded.has(category.id)}" aria-label="${esc(category.name)} 도구 ${expanded.has(category.id) ? '접기' : '펼치기'}" transform="translate(12,${offset})"><title>${esc(category.name)}</title><rect width="${cardWidth - 64}" height="36" rx="6"/><text x="10" y="16">${esc(category.name.length > 21 ? category.name.slice(0, 20) + '…' : category.name)}</text><text class="dk-category-count" x="10" y="30">${category.count}개 도구 ${expanded.has(category.id) ? '−' : '+'}</text></g><g class="dk-overview-category dk-overview-map-link" data-open-map="${esc(category.id)}" role="button" tabindex="0" aria-label="${esc(category.name)} 관계도 보기" transform="translate(${cardWidth - 48},${offset})"><title>${esc(category.name)} 관계도 보기</title><rect width="36" height="36" rx="6"/><text x="18" y="23" text-anchor="middle">↗</text></g>${ids.map((id, index) => `<g class="dk-overview-category" data-tool="${esc(id)}" role="button" tabindex="0" aria-label="${esc(model.tools.get(id).name)} 상세 보기" transform="translate(24,${offset + 39 + index * 30})"><rect width="${cardWidth - 48}" height="26" rx="5"/><text x="10" y="18">${esc(model.tools.get(id).name.slice(0, 25))}</text></g>`).join('')}`; }).join('') : '';
      cards += `<g class="dk-overview-card" data-domain="${esc(group.id)}" transform="translate(${x},${y})"><rect class="dk-overview-frame" width="${cardWidth}" height="${cardHeight(group)}" rx="14"/><rect class="dk-domain-stripe" x="1" y="14" width="4" height="38" rx="2"/>
        <g class="dk-overview-toggle" data-expand="${esc(group.id)}" role="button" tabindex="0" aria-expanded="${open}" aria-label="${esc(group.name)} 세부 분류 ${open ? '접기' : '펼치기'}"><rect width="${cardWidth}" height="62" rx="14"/><text class="dk-overview-title" x="20" y="28">${esc(group.name)}</text><text class="dk-overview-sign" x="${cardWidth - 30}" y="30">${open ? '−' : '+'}</text><text class="dk-overview-meta" x="20" y="49">${group.categories.length}개 분류 · ${group.tools.size}개 도구</text></g>
        ${categories}</g>`;
      y += cardHeight(group) + 24;
    }
  });
  return `<svg class="dk-overview" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * zoom}" height="${height * zoom}" data-width="${width}" data-height="${height}" role="group" aria-label="개발 도구 전체 조망"><g class="dk-overview-lines">${connectors}</g><rect class="dk-overview-root" x="${rootX - 86}" y="${centerY - 32}" width="172" height="64" rx="16"/><text class="dk-overview-root-title" x="${rootX}" y="${centerY - 2}" text-anchor="middle">Developer Tools</text><text class="dk-overview-root-hint" x="${rootX}" y="${centerY + 18}" text-anchor="middle">${groups.length}개 분야를 연결한 지도</text>${cards}</svg>`;
}
