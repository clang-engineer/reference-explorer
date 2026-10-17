import { escapeHtml as esc } from '../core/reference-data.js';
import { layoutCompactGraph } from './layout.js';
import { routeConnections } from './routing.js';

function shortName(name, limit) {
  let text = '', width = 0;
  for (const character of name) {
    width += character.codePointAt(0) > 255 ? 2 : 1;
    if (width > limit) return text + '…';
    text += character;
  }
  return text;
}

export function categoryOverviewHtml(graph, { zoom = 1, compact = false, maxWidth = compact ? 324 : 960 } = {}) {
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const linked = new Set(graph.links.flatMap(link => [link.from, link.to]));
  const connected = graph.nodes.filter(node => linked.has(node.id));
  const isolated = graph.nodes.filter(node => !linked.has(node.id));
  let diagram = '';
  if (connected.length) {
    const layout = layoutCompactGraph(connected.map(node => node.id), graph.links, { nodeWidth: compact ? 112 : 176, nodeHeight: 48, maxWidth });
    const routes = routeConnections(layout, graph.links);
    const lines = graph.links.map((link, index) => {
      const path = routes[index].path;
      const label = `${byId.get(link.from).name} ↔ ${byId.get(link.to).name} · 공통 도구 ${link.tools.length}개: ${link.tools.map(tool => tool.name).join(', ')}`;
      return `<g class="dk-macro-link" tabindex="0" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><path class="dk-macro-link-hit" d="${path}"/><path class="dk-macro-link-halo" d="${path}"/><path class="dk-macro-link-line" d="${path}" stroke-width="${1 + Math.min(3, Math.log2(link.tools.length + 1))}"/></g>`;
    }).join('');
    const cards = connected.map(node => {
      const position = layout.positions.get(node.id);
      const label = `${node.name} · 도구 ${node.toolCount}개 · 내부 관계 ${node.relationCount}개 · 관계도 보기`;
      return `<g class="dk-macro-node" data-open-map="${esc(node.id)}" role="button" tabindex="0" aria-label="${esc(label)}" transform="translate(${position.x},${position.y})"><title>${esc(label)}</title><rect width="${layout.nodeWidth}" height="${layout.nodeHeight}"/><text class="dk-macro-node-title" x="8" y="20">${esc(shortName(node.name, compact ? 12 : 21))}</text><text class="dk-macro-node-count" x="8" y="38">${node.toolCount} 도구 · ${node.relationCount} 관계</text></g>`;
    }).join('');
    diagram = `<div class="dk-macro-canvas"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width * zoom}" height="${layout.height * zoom}" data-width="${layout.width}" data-height="${layout.height}" role="group" aria-label="공통 도구로 연결된 분류 지도">${lines}${cards}</svg></div>`;
  }
  const sharedTools = graph.links.length ? `<details class="dk-macro-shared"><summary>공통 도구 보기 · ${graph.links.length}개 연결</summary><ul>${graph.links.map(link => `<li><span>${esc(byId.get(link.from).name)} ↔ ${esc(byId.get(link.to).name)}</span><strong>${esc(link.tools.map(tool => tool.name).join(', '))}</strong></li>`).join('')}</ul></details>` : '';
  const standalone = isolated.length ? `<details class="dk-macro-isolated"><summary>공통 도구 없는 분류 · ${isolated.length}개</summary><div class="dk-macro-isolated-grid">${isolated.map(node => `<button type="button" data-open-map="${esc(node.id)}" aria-label="${esc(node.name)} 관계도 보기"><strong>${esc(node.name)}</strong><span>도구 ${node.toolCount} · 내부 관계 ${node.relationCount}</span></button>`).join('')}</div></details>` : '';
  return `<div class="dk-macro"><header class="dk-macro-summary"><h3>분류 관계도</h3><p>${graph.nodes.length}개 분류 · ${graph.links.length}개 공통 도구 연결 · ${graph.toolCount}개 고유 도구</p><p>선은 공통 도구 연결입니다. 분류를 선택하면 내부 관계도가 열립니다.</p></header>${diagram || `<p class="dk-empty">${graph.nodes.length ? '분류 사이에 공통 도구가 없습니다. 아래 목록에서 분류별 관계도를 열 수 있습니다.' : '등록된 분류가 없습니다.'}</p>`}${sharedTools}${standalone}</div>`;
}
