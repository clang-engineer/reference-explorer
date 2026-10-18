// Owns only the detail panel. Request/cache logic lives in integrations/tldr.js.
import { escapeHtml as esc } from '../core/reference-data.js';
import { RELATIONS, safeUrl } from '../core/catalog.js';
import { createTldrClient, tldrPaths } from '../integrations/tldr.js';

export function createDetailPanel(panel, { fetchImpl = globalThis.fetch, clipboard } = {}) {
  const client = createTldrClient(fetchImpl);
  const Controller = panel.ownerDocument.defaultView.AbortController;
  const $ = selector => panel.querySelector(selector);
  let state, request, result;
  let version = 0;
  let disposed = false;
  function linkHtml(link) {
    const url = safeUrl(link?.url);
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(link.label || '문서')} <span aria-hidden="true">↗</span></a>` : '';
  }
  function linksHtml(links, empty) {
    return links.length ? `<ul class="dk-links">${links.map(link => `<li>${linkHtml(link)}</li>`).join('')}</ul>` : `<p class="dk-muted">${esc(empty)}</p>`;
  }
  function show(model, id, tab = 'about', edge = '') {
    if (disposed) return;
    state = { model, tool: id, tab, edge };
    request?.abort();
    result = null;
    version++;
    const tool = state.model.tools.get(state.tool);
    if (!tool) { panel.innerHTML = '<div class="dk-placeholder"><h2>도구를 선택하세요</h2><p>분야를 펼치거나 검색하면 소개·사용법·문서 링크를 확인할 수 있습니다.</p></div>'; return; }
    const edges = state.model.edges.filter(edge => edge.from === tool.id || edge.to === tool.id);
    panel.innerHTML = `<div class="dk-detail-actions"><span>${tool.kind === 'guide' ? '문서 소개' : tool.kind === 'language' ? '언어 소개' : '도구 소개'}</span><button type="button" data-close-detail aria-label="상세 닫고 지도로 돌아가기">닫기 ×</button></div><header class="dk-detail-head"><p class="dk-eyebrow">${esc(tool.categories.map(id => state.model.categories.find(category => category.id === id)?.name).join(' / '))}</p><h2>${esc(tool.name)}</h2><p>${esc(tool.description || '연결된 관계와 참고 자료에서 도구의 역할을 확인하세요.')}</p></header>
      <div class="dk-detail-tabs" role="group" aria-label="도구 상세 보기">${[['about', '소개'], ['usage', '사용법'], ['resources', '자료']].map(([id, label]) => `<button type="button" data-tab="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</div><div class="dk-detail-body" data-body></div>`;
    const body = $('[data-body]');
    if (tab === 'about') {
      body.innerHTML = `<h3>비교·연동 관계 <small>${edges.length}</small></h3>` + (edges.length ? edges.map(edge => {
        const other = edge.from === tool.id ? edge.to : edge.from;
        return `<details class="dk-relation" ${edge.id === state.edge || edges.length === 1 ? 'open' : ''}><summary><span>${esc(state.model.tools.get(edge.from).name)} → ${esc(state.model.tools.get(edge.to).name)}</span><span class="dk-badge">${esc(RELATIONS[edge.relation] || edge.relation || '관계')}</span></summary><dl>${[['기존 문제', edge.problem || edge.why], ['개선점', edge.solution], ['선택할 때 주의할 점', edge.boundary]].filter(([, value]) => value).map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`).join('')}</dl><button type="button" data-related="${esc(other)}">${esc(state.model.tools.get(other).name)} 살펴보기 →</button></details>`;
      }).join('') : '<p class="dk-muted">등록된 비교·연동 관계가 없습니다. 사용법과 자료에서 이 항목을 더 살펴볼 수 있습니다.</p>');
      if (tool.install) body.innerHTML += `<h3>설치 예시</h3><pre><code>${esc(tool.install)}</code></pre>`;
    } else if (tab === 'usage' && tool.kind === 'guide') {
      body.innerHTML = `<h3>주제별 문서</h3>${linksHtml(tool.custom, '자료 탭의 문서를 참고하세요.')}<p class="dk-muted">개별 실행 명령이 아닌 비교·작업 절차 문서입니다.</p>`;
    } else if (tab === 'usage') {
      body.innerHTML = `<h3>빠른 사용법 <small>tldr</small></h3><div data-tldr></div>${tool.usage ? `<h3>사용 구문</h3><pre><code>${esc(tool.usage)}</code></pre>` : ''}${tool.examples.length ? `<h3>카탈로그 예시</h3>${tool.examples.map(example => `<pre><code>${esc(example)}</code></pre>`).join('')}` : ''}<h3>내 치트시트 · 전체 문서</h3>${linksHtml(tool.custom, '등록된 자체 치트시트가 없습니다. 자료 탭의 공식 문서를 참고하세요.')}<p class="dk-muted">긴 문서는 원문 전체를 새 탭에서 엽니다.</p>`;
      loadTldr(tool, $('[data-tldr]'), version);
    } else {
      body.innerHTML = `<h3>내 치트시트 · 전체 문서</h3>${linksHtml(tool.custom, '등록된 자체 치트시트가 없습니다.')}<h3>공식 문서</h3>${linksHtml(tool.official, '등록된 공식 문서 링크가 없습니다.')}${tool.links.length ? `<h3>관련 글과 자료</h3>${linksHtml(tool.links, '')}` : ''}<p class="dk-muted">문서를 요약하거나 복제하지 않고 원본으로 연결합니다.</p>`;
    }
    if (tab === 'about') {
      const settings = tool.links.filter(link => link.label === '내 설정');
      if (settings.length) body.innerHTML += `<div class="dk-resource-shortcut"><h3>내 설정</h3>${linksHtml(settings, '')}</div>`;
    }
    if (tab === 'about' && tool.custom.length) body.innerHTML += `<div class="dk-resource-shortcut"><h3>내 치트시트 · 전체 문서</h3>${linksHtml(tool.custom, '')}</div>`;
  }
  async function loadTldr(tool, target, sequence = version) {
    if (!target || disposed) return;
    request?.abort();
    const controller = new Controller();
    request = controller;
    if (!tldrPaths(tool.tldr).length) {
      target.innerHTML = '<p class="dk-muted">등록된 tldr 페이지가 없습니다. 아래 치트시트 또는 자료 탭을 이용하세요.</p>';
      return;
    }
    target.innerHTML = '<p class="dk-muted">tldr-pages에서 예시를 불러오는 중…</p>';
    try {
      const loaded = await client.load(tool.tldr, { signal: controller.signal });
      if (sequence !== version || controller.signal.aborted || !target.isConnected) return;
      result = loaded;
      if (!result) {
        target.innerHTML = '<p class="dk-muted">이 명령의 tldr 페이지를 찾지 못했습니다. 치트시트와 공식 문서는 계속 이용할 수 있습니다.</p>';
        return;
      }
      target.innerHTML = result.examples.length ? `<ol class="dk-examples">${result.examples.map((example, index) => `<li><p>${esc(example.description)}</p><pre><code>${esc(example.command)}</code></pre><button type="button" data-copy="${index}">명령 복사</button></li>`).join('')}</ol><p class="dk-muted">{{…}} 자리표시자는 실제 값으로 바꿔 사용하세요.</p>` : '<p class="dk-muted">표시할 tldr 예시가 없습니다.</p>';
      target.innerHTML += `<p class="dk-attribution">${linkHtml({ label: 'tldr-pages 원문 · 기여자', url: 'https://github.com/tldr-pages/tldr/blob/main/pages/' + result.path + '.md' })} · ${linkHtml({ label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' })}</p>`;
    } catch {
      if (sequence !== version || controller.signal.aborted || !target.isConnected) return;
      target.innerHTML = '<p class="dk-muted">네트워크 오류로 tldr를 불러오지 못했습니다.</p><button type="button" data-tldr-retry>tldr 다시 시도</button>';
    }
  }
  async function copy(button) {
    const example = result?.examples[Number(button.dataset.copy)];
    if (!example) return;
    try {
      await clipboard.writeText(example.command);
      if (button.isConnected) button.textContent = '복사됨';
    } catch {
      if (button.isConnected) button.textContent = '코드를 직접 선택해 복사하세요';
    }
  }
  return {
    show,
    copy,
    retry() {
      const tool = state?.model.tools.get(state.tool);
      if (tool && state.tab === 'usage') return loadTldr(tool, $('[data-tldr]'), ++version);
    },
    destroy() {
      disposed = true;
      ++version;
      request?.abort();
      client.clear();
      result = null;
    },
  };
}
