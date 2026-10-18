// Short labels describe registered plugin behavior; source categories own the groups.
const roles = {
  'snacks.nvim': '탐색·편의 기능', 'vim-tmux-navigator': '창·pane 이동',
  'flash.nvim': '위치 점프', 'outline.nvim': '심볼 구조', 'which-key.nvim': '키맵 안내', 'trouble.nvim': '진단·참조 목록',
  'vim-visual-multi': '다중 커서', 'nvim-nocut': '삭제·복사 분리', 'mini.comment': '주석 토글', 'mini.surround': '감싸기 편집', 'yanky.nvim': '복사 이력',
  'blink.cmp': '자동완성', 'nvim-lspconfig': 'LSP 설정', 'conform.nvim': '코드 포맷', 'nvim-jdtls': 'Java LSP', 'jvm-env.nvim': 'JVM 환경', 'nvim-dap': '디버깅', 'nvim-dap-ui': '디버깅 화면',
  'render-markdown.nvim': 'Markdown 표시', 'markdown-preview.nvim': '브라우저 미리보기', 'copilot.lua': 'AI 코드 제안', 'copilotchat.nvim': 'AI 대화', 'cyberdream.nvim': '색상 테마',
  'vim-dadbod': 'DB 쿼리', 'vim-dadbod-ui': 'DB 탐색 화면', 'vim-dadbod-completion': 'SQL 자동완성', 'dadbod-vertica.nvim': 'Vertica 연결',
};
export function pluginRole(tool) { return roles[tool.id] || ''; }
export function pluginSection(tool, categoryId) {
  const tags = tool.categoryTags?.[categoryId] || [];
  const tag = tags.find(tag => tag.startsWith('neovim:'));
  if (tag) return tag.slice(7);
  if (tags.includes('config')) return '설정·배포판';
  if (tags.includes('neovim')) return '데이터베이스';
  return '기타 확장';
}
