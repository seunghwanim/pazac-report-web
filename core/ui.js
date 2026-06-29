// core/ui.js — 공용 UI 헬퍼 (보고 종류를 모름)

export const esc = s =>
  String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

// 토스트 알림
export function toast(msg) {
  const t = document.querySelector('.toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

// Enter로 태그 추가하는 인풋 바인딩
// input: input 엘리먼트, arr: 태그 배열(참조), renderFn: 렌더 콜백
export function bindTagInput(input, arr, renderFn) {
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    // 한글 IME 조합 중(예: '시' 입력 중)에 발생하는 Enter는 무시.
    // 조합 중 keydown까지 처리하면 조합 확정 후 keydown과 합쳐져 태그가 중복 추가됨.
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    const v = e.target.value.trim();
    if (v && !arr.includes(v)) arr.push(v);
    e.target.value = '';
    renderFn();
    e.target.focus();
  });
}

// 태그 목록 렌더링 (단어 등 짧은 항목 — 칩 형태)
export function renderTags(container, arr, onRemove) {
  container.innerHTML = arr.map((n, i) =>
    `<span class="tag">${esc(n)}<button data-i="${i}" aria-label="삭제">✕</button></span>`
  ).join('');
  container.querySelectorAll('button').forEach(b =>
    b.onclick = () => { onRemove(+b.dataset.i); }
  );
}

// 문장형 메모 목록 렌더링 (한 줄에 한 문장 — 긴 문장 대응)
export function renderNoteList(container, arr, onRemove) {
  container.innerHTML = arr.map((n, i) =>
    `<div class="noteitem"><span>${esc(n)}</span><button data-i="${i}" aria-label="삭제">✕</button></div>`
  ).join('');
  container.querySelectorAll('button').forEach(b =>
    b.onclick = () => { onRemove(+b.dataset.i); }
  );
}

// 바텀 시트 열기/닫기
export function openSheet(id) { document.getElementById(id).classList.add('show'); }
export function closeSheet(id) { document.getElementById(id).classList.remove('show'); }
