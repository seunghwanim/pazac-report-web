// templates/kitchen-open.js — 주방 오픈 로직

import { ITEMS, SCALE, NONE_DEFAULT, CAT_ORDER } from '../data/kitchen.js';
import { BRANCHES } from '../data/branches.js';
import { esc, toast, bindTagInput, renderNoteList } from '../core/ui.js';

// ── 상태 ──────────────────────────────────────────────
let roster = [];
let st = {};
let notes = [];
let agedPlans = {};
let added = new Set();
let menuOpen = null;
let rdateEl = null;

// ── 속성 헬퍼 ─────────────────────────────────────────
function scaleKey(n) {
  for (const p of ['루꼴라 ','토마토 ','사과컷 ','사과 ','카이피라 '])
    if (n.startsWith(p)) n = n.slice(p.length);
  if (n === '상태') n = '컨디션';
  return n;
}
function attrOpts(n)    { return SCALE[scaleKey(n)] || ['양호','주의']; }
function attrDefault(n) {
  const k = scaleKey(n);
  if (NONE_DEFAULT.has(k)) return '없음';
  const o = attrOpts(n);
  return o.includes('양호') ? '양호' : o[0];
}

// ── 로트 초기화 ────────────────────────────────────────
function newLot(name) {
  const it = ITEMS[name];
  if (it.special) return { prodDate:'', pan:'', ferm:'', cold:'', note:'' };
  const av = {};
  (it.attrs || []).forEach(a => av[a] = attrDefault(a));
  return { prodDate:'', qty:'', cond:100, attrVals:av, notes:[] };
}
function initItem(name) { return { status:'pending', lots:[newLot(name)] }; }

// ── 렌더 ───────────────────────────────────────────────
function render() {
  const L = document.getElementById('koList');
  L.innerHTML = '';
  let lastCat = null;
  roster.forEach(name => {
    const cat = ITEMS[name].cat;
    if (cat !== lastCat) {
      const h = document.createElement('div');
      h.className = 'catlabel'; h.textContent = cat;
      L.appendChild(h); lastCat = cat;
    }
    L.appendChild(makeCard(name));
  });
  updateProgress();
}

function makeCard(name) {
  const d = document.createElement('div');
  d.dataset.card = name;
  const s = st[name];
  d.className = `card s-${s.status}${s._open ? ' open' : ''}`;
  d.innerHTML = cardInner(name);
  return d;
}

function refreshCard(name) {
  const d = document.querySelector(`[data-card="${CSS.escape(name)}"]`);
  if (!d) return;
  const s = st[name];
  d.className = `card s-${s.status}${s._open ? ' open' : ''}`;
  d.innerHTML = cardInner(name);
  updateProgress();
}

function cardInner(name) {
  const it = ITEMS[name], s = st[name];
  let h = `<div class="chead" data-act="toggle" data-item="${name}">
    <span class="dot"></span><span class="name">${esc(name)}</span>`;
  if (s.status === 'pending') h += `<span class="badge b-need">입력 필요</span>`;
  else if (s.status === 'good') h += `<span class="badge b-good">${it.special ? '기록됨' : '확인 완료 · ' + (s.lots[0]?.cond ?? '') + '%'}</span>`;
  else h += `<span class="badge b-none">오늘 없음</span>`;
  h += `<button class="kebab" data-act="menu" data-item="${name}">⋯</button>`;
  h += `<span class="chev">${s._open ? '▾' : '▸'}</span></div>`;

  if (s._menu) {
    h += `<div class="popover">` +
      (s.status === 'none'
        ? `<button data-act="revert" data-item="${name}">↩ 입력하기</button>`
        : `<button data-act="setnone" data-item="${name}">∅ 오늘 없음으로 표시</button>`) +
      `</div>`;
  }
  if (!s._open) return h;

  h += `<div class="cbody">`;
  if (it.special) h += doughBody(name);
  else if (s.status === 'none') h += `<p class="nonehint">오늘 없음 — 우측 <b>⋯</b> 메뉴로 되돌리기</p>`;
  else {
    s.lots.forEach((lo, i) => { h += lotBox(name, lo, i, s.lots.length); });
    h += `<button class="dashed" data-act="addlot" data-item="${name}">＋ 로트 추가 (다른 생산일)</button>`;
    h += `<button class="done-btn" data-act="done" data-item="${name}">입력 완료</button>`;
  }
  if (added.has(name)) h += `<button class="delitem" data-act="delitem" data-item="${name}">이 재료 삭제</button>`;
  h += `</div>`;
  return h;
}

function lotBox(name, lo, i, n) {
  const it = ITEMS[name], presets = [100, 95, 90];
  let h = `<div class="lot"><div class="lh"><b>로트 ${i+1}<span>${lo.prodDate || '생산일 미입력'}</span></b>` +
    (n > 1 ? `<button class="x" data-act="rmlot" data-item="${name}" data-i="${i}">✕</button>` : '') + `</div>`;
  h += `<div class="lgrid">${lf(name,i,'prodDate','생산일','','date',lo.prodDate)}${lf(name,i,'qty','수량','예 12개','text',lo.qty)}</div>`;
  h += `<div class="sub">컨디션</div><div class="cond-row">` +
    presets.map(c => `<button data-act="cond" data-item="${name}" data-i="${i}" data-c="${c}" class="${lo.cond===c?'on':''}">${c}%</button>`).join('') +
    `<div class="direct ${presets.includes(lo.cond)?'':'on'}"><input type="number" inputmode="numeric" min="0" max="100" data-act="condinput" data-item="${name}" data-i="${i}" value="${lo.cond}"><span>%</span></div></div>`;
  h += `<div class="sub">평가 항목</div>`;
  (it.attrs || []).forEach(a => {
    const cur = lo.attrVals[a], def = attrDefault(a);
    h += `<div class="attr"><div class="alab">${a}</div><div class="pills">` +
      attrOpts(a).map(o => `<button class="pill ${o===cur?'on':''} ${o===cur&&o!==def?'flag':''}" data-act="attr" data-item="${name}" data-i="${i}" data-a="${a}" data-v="${o}">${o}</button>`).join('') +
      `</div></div>`;
  });
  h += `<div class="sub">메모 · 조치</div>`;
  if ((it.actions || []).length) {
    h += `<div class="ctas">` + it.actions.map(a =>
      `<button class="achip ${lo.notes.includes(a)?'on':''}" data-act="cta" data-item="${name}" data-i="${i}" data-x="${a}">＋ ${a}</button>`
    ).join('') + `</div>`;
  }
  if (lo.notes.length) {
    h += `<div class="tags">` + lo.notes.map((nt, j) =>
      `<span class="tag">${esc(nt)}<button data-act="rmnote" data-item="${name}" data-i="${i}" data-j="${j}">✕</button></span>`
    ).join('') + `</div>`;
  }
  h += `<input class="noteinput" type="text" data-act="noteinput" data-item="${name}" data-i="${i}" placeholder="직접 입력 후 Enter">`;
  h += `</div>`;
  return h;
}

function doughBody(name) {
  const s = st[name]; let h = `<div class="sub">로트 ${s.lots.length}건</div>`;
  s.lots.forEach((lo, i) => {
    h += `<div class="lot"><div class="lh"><b>로트 ${i+1}<span>${lo.prodDate||'날짜 미입력'}</span></b>` +
      (s.lots.length > 1 ? `<button class="x" data-act="rmlot" data-item="${name}" data-i="${i}">✕</button>` : '') + `</div>` +
      `<div class="lgrid" style="grid-template-columns:1fr 1fr 1fr">` +
      lf(name,i,'prodDate','생산일','','date',lo.prodDate)+lf(name,i,'pan','판수','예 5판','text',lo.pan)+lf(name,i,'ferm','발효도%','93','text',lo.ferm)+`</div>` +
      `<div class="lgrid" style="margin-top:8px">` +
      lf(name,i,'cold','냉기%','10','text',lo.cold)+lf(name,i,'note','메모','전판 꺼냄 등','text',lo.note)+`</div></div>`;
  });
  h += `<button class="dashed" data-act="addlot" data-item="${name}">＋ 날짜 추가</button>`;
  h += `<button class="done-btn" data-act="done" data-item="${name}">입력 완료</button>`;
  return h;
}

function lf(name, i, field, label, ph, type, val) {
  return `<div class="lf"><label>${label}</label><input type="${type}" data-act="lot" data-item="${name}" data-i="${i}" data-f="${field}" placeholder="${ph}" value="${esc(val||'')}"></div>`;
}

// ── 진행률 ────────────────────────────────────────────
function updateProgress() {
  const total = roster.length;
  const done  = roster.filter(n => st[n].status !== 'pending').length;
  const left  = total - done;
  document.getElementById('koCount').textContent = `${done} / ${total} 확인`;
  document.getElementById('koLeft').textContent  = `남은 항목 ${left}`;
  document.getElementById('koFill').style.width  = (total ? done/total*100 : 0) + '%';
  const btn = document.getElementById('submitBtn');
  if (btn) { btn.disabled = left > 0; btn.textContent = left > 0 ? `입력 필요 ${left}개 남음` : '보고 제출'; }
}

// ── 3일 이상 재고 ─────────────────────────────────────
function agedKey(name, i, d) { return `${name}|${i}|${d}`; }
function getAged() {
  const rd = rdateEl?.value; if (!rd) return [];
  const rdate = new Date(rd + 'T00:00:00'), out = [];
  roster.forEach(name => {
    if (st[name].status === 'none') return;
    (st[name].lots || []).forEach((lo, i) => {
      if (!lo.prodDate) return;
      const days = Math.floor((rdate - new Date(lo.prodDate + 'T00:00:00')) / 86400000);
      if (days >= 3) out.push({ name, i, prodDate:lo.prodDate, days, qty:(ITEMS[name].special?lo.pan:lo.qty)||'' });
    });
  });
  return out.sort((a, b) => b.days - a.days);
}
function renderAged() {
  const L = document.getElementById('koAged'); L.innerHTML = '';
  const list = getAged();
  if (!list.length) { L.innerHTML = '<p class="hint" style="margin:0">3일 이상 경과한 재고가 없습니다.</p>'; return; }
  list.forEach(r => {
    const key = agedKey(r.name, r.i, r.prodDate);
    const row = document.createElement('div'); row.className = 'agedrow';
    row.innerHTML = `<div class="ai"><b>${esc(r.name)}</b><span>${r.prodDate} · ${r.days}일 경과${r.qty ? ' · ' + esc(r.qty) : ''}</span></div>`;
    const pi = document.createElement('input'); pi.className = 'planinput';
    pi.placeholder = '처리 계획 (예: 익일 소진 / 직식 전환)';
    pi.value = agedPlans[key] || '';
    pi.addEventListener('input', () => { agedPlans[key] = pi.value; });
    row.appendChild(pi); L.appendChild(row);
  });
}

// ── 재료 추가 시트 ────────────────────────────────────
function openAddSheet() {
  const body = document.getElementById('pickBody'); body.innerHTML = '';
  const avail = Object.keys(ITEMS).filter(n => !roster.includes(n));
  if (!avail.length) { body.innerHTML = '<p style="color:var(--muted);font-size:13px">추가할 재료가 없습니다.</p>'; }
  CAT_ORDER.forEach(cat => {
    const items = avail.filter(n => ITEMS[n].cat === cat); if (!items.length) return;
    const h = document.createElement('div'); h.className = 'pickcat'; h.textContent = cat; body.appendChild(h);
    const row = document.createElement('div'); row.className = 'pickrow';
    items.forEach(n => {
      const b = document.createElement('button'); b.textContent = '＋ ' + n;
      b.onclick = () => {
        roster.push(n);
        roster.sort((a, b) => CAT_ORDER.indexOf(ITEMS[a].cat) - CAT_ORDER.indexOf(ITEMS[b].cat));
        st[n] = initItem(n); st[n]._open = true; added.add(n);
        document.getElementById('ovAdd').classList.remove('show');
        render();
        document.querySelector(`[data-card="${CSS.escape(n)}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' });
      };
      row.appendChild(b);
    });
    body.appendChild(row);
  });
  document.getElementById('ovAdd').classList.add('show');
}

// ── 이벤트 위임 ───────────────────────────────────────
function bindEvents() {
  const list = document.getElementById('koList');

  list.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act, name = t.dataset.item;
    if (act === 'toggle') {
      st[name]._menu = false; closeMenus(name); st[name]._open = !st[name]._open; refreshCard(name);
    } else if (act === 'menu') {
      const open = st[name]._menu; closeMenus(); st[name]._menu = !open; menuOpen = st[name]._menu ? name : null; refreshCard(name);
    } else if (act === 'setnone') { st[name].status='none'; st[name]._menu=false; st[name]._open=false; menuOpen=null; refreshCard(name); renderAged(); }
    else if (act === 'revert')    { st[name].status='pending'; st[name]._menu=false; st[name]._open=true; menuOpen=null; refreshCard(name); renderAged(); }
    else if (act === 'done')      { st[name].status='good'; st[name]._open=false; refreshCard(name); }
    else if (act === 'cond')      { st[name].lots[+t.dataset.i].cond = +t.dataset.c; refreshCard(name); }
    else if (act === 'attr')      { st[name].lots[+t.dataset.i].attrVals[t.dataset.a] = t.dataset.v; refreshCard(name); }
    else if (act === 'cta')       { const a=t.dataset.x, arr=st[name].lots[+t.dataset.i].notes, k=arr.indexOf(a); k<0?arr.push(a):arr.splice(k,1); refreshCard(name); }
    else if (act === 'rmnote')    { st[name].lots[+t.dataset.i].notes.splice(+t.dataset.j,1); refreshCard(name); }
    else if (act === 'delitem')   { roster=roster.filter(n=>n!==name); delete st[name]; added.delete(name); render(); renderAged(); }
    else if (act === 'addlot')    { st[name].lots.push(newLot(name)); refreshCard(name); }
    else if (act === 'rmlot')     { st[name].lots.splice(+t.dataset.i,1); refreshCard(name); renderAged(); }
  });

  list.addEventListener('input', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const name = t.dataset.item, i = +t.dataset.i;
    if (t.dataset.act === 'condinput') {
      let v = parseInt(t.value, 10); if (isNaN(v)) return;
      v = Math.min(100, Math.max(0, v));
      st[name].lots[i].cond = v;
      const lotEl = t.closest('.lot');
      lotEl.querySelectorAll('.cond-row button').forEach(b => b.classList.remove('on'));
      lotEl.querySelector('.direct').classList.toggle('on', ![100,95,90].includes(v));
    } else if (t.dataset.act === 'lot') {
      st[name].lots[i][t.dataset.f] = t.value;
      if (t.dataset.f === 'prodDate') renderAged();
    }
  });

  list.addEventListener('keydown', e => {
    const t = e.target.closest('[data-act=noteinput]'); if (!t || e.key !== 'Enter') return;
    e.preventDefault();
    const name = t.dataset.item, i = +t.dataset.i, v = t.value.trim();
    if (v && !st[name].lots[i].notes.includes(v)) st[name].lots[i].notes.push(v);
    t.value = ''; refreshCard(name);
    document.querySelector(`[data-card="${CSS.escape(name)}"]`)?.querySelectorAll('.lot')[i]?.querySelector('.noteinput')?.focus();
  });

  document.getElementById('koAddItem').onclick = openAddSheet;

  // 지점 변경 시 로스터 재로드
  document.getElementById('branch').addEventListener('change', e => loadRoster(e.target.value));
  document.getElementById('rdate').addEventListener('change', renderAged);

  // 바깥 클릭 시 메뉴 닫기
  document.addEventListener('click', e => {
    if (!menuOpen) return;
    if (e.target.closest('.kebab') || e.target.closest('.popover')) return;
    const n = menuOpen; menuOpen = null; if (st[n]) { st[n]._menu = false; refreshCard(n); }
  });
}

function closeMenus(except) {
  if (menuOpen && menuOpen !== except && st[menuOpen]) {
    const n = menuOpen; menuOpen = null; st[n]._menu = false; refreshCard(n);
  }
}

// 특이사항 문장 목록 다시 그림 (개별 삭제 포함)
function reRenderNotes() {
  renderNoteList(document.getElementById('koNotesList'), notes, i => { notes.splice(i, 1); reRenderNotes(); });
}

function loadRoster(branch) {
  roster = (BRANCHES[branch]?.roster || []).slice();
  st = {}; added = new Set(); agedPlans = {};
  notes.length = 0;  // bindTagInput 참조 유지를 위해 in-place 비움
  roster.forEach(n => st[n] = initItem(n));
  render(); renderAged();
  reRenderNotes();
}

// ── 공개 API ──────────────────────────────────────────
export function init({ branch, rdate, author }) {
  rdateEl = rdate;
  bindTagInput(document.getElementById('koNotesInput'), notes, reRenderNotes);
  bindEvents();
  loadRoster(branch.value);
}

// 저장된 payload(buildPayload 결과)를 폼에 되채움 — init() 이후 호출
export function hydrate(data) {
  if (!data) return;

  roster = (data.items || []).map(it => it.item_name).filter(n => ITEMS[n]);
  st = {};
  (data.items || []).forEach(it => {
    const name = it.item_name, meta = ITEMS[name];
    if (!meta) return;
    if (it.status === 'none') { st[name] = { status:'none', lots:[newLot(name)] }; return; }

    const lots = (it.lots || []).map(l => {
      if (meta.special) return {
        prodDate: l.prod_date || '', pan: l.quantity || '',
        ferm: l.fermentation || '', cold: l.cold || '', note: l.note || '',
      };
      const av = {};
      (meta.attrs || []).forEach(a => av[a] = attrDefault(a));
      (l.issues || []).forEach(iss => { av[iss.attr] = iss.value; });
      return {
        prodDate: l.prod_date || '', qty: l.quantity || '',
        cond: l.condition_pct ?? 100, attrVals: av, notes: (l.notes || []).slice(),
      };
    });
    st[name] = { status: it.status || 'good', lots: lots.length ? lots : [newLot(name)] };
  });

  // 지점 기본 로스터에 없는 항목 = 작성자가 추가한 항목
  const branchRoster = BRANCHES[document.getElementById('branch')?.value]?.roster || [];
  added = new Set(roster.filter(n => !branchRoster.includes(n)));

  notes.length = 0; notes.push(...(data.general_notes || []));  // in-place 교체

  // 처리 계획 복원 (생산일로 로트 인덱스 매칭)
  agedPlans = {};
  (data.aged_inventory || []).forEach(a => {
    const idx = (st[a.item_name]?.lots || []).findIndex(l => l.prodDate === a.prod_date);
    if (idx >= 0) agedPlans[agedKey(a.item_name, idx, a.prod_date)] = a.plan || '';
  });

  render();
  renderAged();
  reRenderNotes();
}

export function buildPayload(header) {
  const items = roster.map(name => {
    const it = ITEMS[name], s = st[name];
    if (it.special) return { item_name:name, category:it.cat, status:s.status,
      lots: s.lots.map(l => ({ prod_date:l.prodDate||null, quantity:l.pan||null, fermentation:l.ferm||null, cold:l.cold||null, note:l.note||null })) };
    return { item_name:name, category:it.cat, status:s.status,
      lots: s.status==='none' ? [] : s.lots.map(l => ({
        prod_date: l.prodDate||null, quantity: l.qty||null, condition_pct: l.cond,
        issues: (it.attrs||[]).filter(a => l.attrVals[a] !== attrDefault(a)).map(a => ({ attr:a, value:l.attrVals[a] })),
        notes: l.notes,
      })) };
  });
  const aged = getAged().map(r => ({
    item_name: r.name, prod_date: r.prodDate, days_old: r.days,
    quantity: r.qty || null, plan: agedPlans[agedKey(r.name,r.i,r.prodDate)] || null,
  }));
  return { report: header, items, aged_inventory: aged, general_notes: notes };
}
