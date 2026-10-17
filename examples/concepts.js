import '../src/element.js';

const concepts = {
  technical: {
    title: '기술 문서형',
    description: '흰 바탕, 얇은 구분선, 파란 강조색. 장식을 덜고 정보의 위계를 드러냅니다.',
  },
  workbench: {
    title: '개발 도구형',
    description: '회색 패널, 조밀한 간격, 선명한 경계. IDE처럼 탐색과 조작에 집중합니다.',
  },
  terminal: {
    title: '터미널형',
    description: '짙은 단색 바탕, 고정폭 글꼴, 녹색 강조. 선과 텍스트로 계층을 표현합니다.',
  },
};

function selectConcept(id) {
  if (!Object.hasOwn(concepts, id)) id = 'technical';
  document.documentElement.dataset.concept = id;
  document.documentElement.dataset.mode = id === 'terminal' ? 'dark' : 'light';
  document.querySelector('[data-concept-title]').textContent = concepts[id].title;
  document.querySelector('[data-concept-description]').textContent = concepts[id].description;
  document.querySelectorAll('[data-concept-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.conceptChoice === id));
  });
  const url = new URL(location.href);
  url.searchParams.set('concept', id);
  history.replaceState(null, '', url);
}

document.querySelector('.concept-switcher').addEventListener('click', event => {
  const button = event.target.closest('[data-concept-choice]');
  if (button) selectConcept(button.dataset.conceptChoice);
});
selectConcept(new URL(location.href).searchParams.get('concept'));
