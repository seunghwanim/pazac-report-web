// core/router.js — URL 파라미터 읽어서 template 로드

const TEMPLATES = {
  kitchen_open:  { label:'주방 오픈', icon:'☀️', module:'../templates/kitchen-open.js', html:'../templates/kitchen-open.html' },
  kitchen_close: { label:'주방 마감', icon:'🌙', module:'../templates/kitchen-close.js', html:'../templates/kitchen-close.html' },
  hall_open:     { label:'홀 오픈',   icon:'🪑', module:'../templates/hall-open.js',     html:'../templates/hall-open.html' },
  hall_close:    { label:'홀 마감',   icon:'🔒', module:'../templates/hall-close.js',    html:'../templates/hall-close.html' },
};

export function getParams() {
  const p = new URLSearchParams(location.search);
  return {
    type:   p.get('type')   || '',
    branch: p.get('branch') || '',
    date:   p.get('date')   || new Date().toISOString().slice(0, 10),
    author: p.get('author') || '',
  };
}

export async function loadTemplate(container, type) {
  const tpl = TEMPLATES[type];
  if (!tpl) { container.innerHTML = '<p style="padding:24px;color:#999">알 수 없는 보고 종류입니다.</p>'; return null; }

  // 1) HTML 마크업 fetch해서 inject
  const html = await fetch(tpl.html).then(r => r.text());
  container.innerHTML = html;

  // 2) JS 모듈 동적 import → init() 호출
  const mod = await import(tpl.module);
  return mod;
}

export function getTemplateInfo(type) {
  return TEMPLATES[type] || null;
}
