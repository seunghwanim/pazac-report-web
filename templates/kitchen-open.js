// templates/kitchen-open.js — 주방 오픈 로직
// 평가항목은 전부 점수 입력(dev=편차%, score=점수점). 맛→식감→향 그룹핑 + 최종 종합 점수.

import { ITEMS, ATTR_DEF, SCORE_TYPES, FINAL_SCORE, ATTR_GROUPS, AGED_ACTIONS, CAT_ORDER } from '../data/kitchen.js';
import { BRANCHES } from '../data/branches.js';
import { esc, toast, bindTagInput, renderNoteList } from '../core/ui.js';

// ── 상태 ──────────────────────────────────────────────
let roster = [];
let st = {};
let notes = [];
let agedSel = {};      // agedKey -> [선택된 조치들]
let added = new Set();
let menuOpen = null;
let rdateEl = null;

// ── 평가항목 메타 (그룹/유형) ─────────────────────────
// 접두사 붙은 항목('토마토 맛')은 끝 단어로 자동 판단
function attrMeta(name) {
  if (ATTR_DEF[name]) return ATTR_DEF[name];
  const base = name.split(' ').pop();
  return ATTR_DEF[base] || { group: '기타', type: 'dev' };
}
// ── 생산분 초기화 ────────────────────────────────────────
function newLot(name) {
  const it = ITEMS[name];
  if (it.special) return { prodDate:'', pan:'', ferm:'95', cold:'', notes:[] };
  const av = {};
  (it.attrs || []).forEach(a => av[a] = SCORE_TYPES[attrMeta(a).type].default);
  return { prodDate:'', qty:'', unit:'', attrVals:av, finalScore:FINAL_SCORE_DEFAULT(), notes:[] };
}
function FINAL_SCORE_DEFAULT() { return SCORE_TYPES[FINAL_SCORE.type].default; }
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

// 생산분 건수 + 오늘없음/입력 토글 버튼 (카드 상단 공통)
function lotsHead(name) {
  const s = st[name], it = ITEMS[name];
  const isNone = s.status === 'none' && !it.special;
  const label = isNone ? '오늘 없음' : `생산분 ${s.lots.length}건`;
  const btn = isNone
    ? `<button class="nonebtn on" data-act="revert" data-item="${name}">↩ 입력하기</button>`
    : `<button class="nonebtn" data-act="setnone" data-item="${name}">오늘 없음</button>`;
  return `<div class="lotshead"><span class="lotcount">${label}</span>${btn}</div>`;
}

function cardInner(name) {
  const it = ITEMS[name], s = st[name];
  let h = `<div class="chead" data-act="toggle" data-item="${name}">
    <span class="dot"></span><span class="name">${esc(name)}</span>`;
  if (s.status === 'pending') h += `<span class="badge b-need">입력 필요</span>`;
  else if (s.status === 'good') h += `<span class="badge b-good">${it.special ? '기록됨' : '확인 완료 · ' + (s.lots[0]?.finalScore ?? '') + '점'}</span>`;
  else h += `<span class="badge b-none">오늘 없음</span>`;
  h += `<span class="chev">${s._open ? '▾' : '▸'}</span></div>`;

  if (!s._open) return h;

  h += `<div class="cbody">`;
  h += lotsHead(name);
  if (it.special) h += doughBody(name);
  else if (s.status === 'none') h += `<p class="nonehint">오늘 없음으로 표시됨 — 위 <b>↩ 입력하기</b>로 되돌릴 수 있어요</p>`;
  else {
    s.lots.forEach((lo, i) => { h += lotBox(name, lo, i, s.lots.length); });
    h += `<button class="dashed" data-act="addlot" data-item="${name}">＋ 생산분 추가 (다른 생산일)</button>`;
    h += `<button class="done-btn" data-act="done" data-item="${name}">입력 완료</button>`;
  }
  if (added.has(name)) h += `<button class="delitem" data-act="delitem" data-item="${name}">이 재료 삭제</button>`;
  h += `</div>`;
  return h;
}

// 점수 항목 한 칸 (배경 톤 + 라벨 + 단위 + 점수 입력줄) — dev/score를 배경색으로 구분
function scoreField(name, i, kind, key, label, val, typeKey, presets, max) {
  const unit = SCORE_TYPES[typeKey].unit;
  return `<div class="scoreblk ${typeKey}">` +
    `<div class="sub">${esc(label)} <span class="utag ${typeKey}">${unit}</span></div>` +
    scoreRow(name, i, kind, key, val, typeKey, presets, max) +
    `</div>`;
}

// 점수 입력 한 줄 (프리셋 버튼 + 직접입력 + 단위)
function scoreRow(name, i, kind, key, val, typeKey, presets, max) {
  const tc = SCORE_TYPES[typeKey];
  const ps = presets || tc.presets;
  const mx = (max ?? tc.max);
  const v  = (val ?? tc.default);
  const onPreset = ps.includes(v);
  let h = `<div class="cond-row ${typeKey}">`;
  h += ps.map(c =>
    `<button data-act="setscore" data-item="${name}" data-i="${i}" data-kind="${kind}" data-key="${esc(key)}" data-c="${c}" class="${v === c ? 'on' : ''}">${c}</button>`
  ).join('');
  h += `<div class="direct ${onPreset ? '' : 'on'}"><input type="number" inputmode="numeric" min="0" max="${mx}" ` +
       `data-act="scoreinput" data-item="${name}" data-i="${i}" data-kind="${kind}" data-key="${esc(key)}" value="${v}"><span>${tc.unit}</span></div>`;
  h += `</div>`;
  return h;
}

function lotBox(name, lo, i, n) {
  const it = ITEMS[name];
  let h = `<div class="lot"><div class="lh"><b>생산분 ${i+1}<span>${lo.prodDate || '생산일 미입력'}</span></b>` +
    (n > 1 ? `<button class="x" data-act="rmlot" data-item="${name}" data-i="${i}">✕</button>` : '') + `</div>`;

  // 생산일 / 수량 / 단위
  h += `<div class="lgrid" style="grid-template-columns:1.2fr .9fr .7fr">` +
    lf(name,i,'prodDate','생산일','','date',lo.prodDate) +
    lf(name,i,'qty','수량','예 12','text',lo.qty) +
    lf(name,i,'unit','단위','개/판','text',lo.unit) + `</div>`;

  // 평가항목 (맛 → 식감 → 향 → 기타)
  ATTR_GROUPS.forEach(group => {
    const inGroup = (it.attrs || []).filter(a => attrMeta(a).group === group);
    if (!inGroup.length) return;
    h += `<div class="agroup">${esc(group)}</div>`;
    inGroup.forEach(a => {
      const meta = attrMeta(a);
      h += scoreField(name, i, 'attr', a, a, lo.attrVals[a], meta.type);
    });
  });

  // 최종 종합 점수
  h += `<div class="agroup final">${esc(FINAL_SCORE.label)} <span class="utag score">${SCORE_TYPES[FINAL_SCORE.type].unit}</span></div>`;
  h += `<div class="scoreblk score">` + scoreRow(name, i, 'final', '', lo.finalScore, FINAL_SCORE.type) + `</div>`;

  // 메모 · 조치
  h += noteBlock(name, i, lo, it.actions);
  h += `</div>`;
  return h;
}

// 메모/조치 블록 (도우·일반 공통)
function noteBlock(name, i, lo, actions) {
  let h = `<div class="sub">메모 · 조치</div>`;
  if ((actions || []).length) {
    h += `<div class="ctas">` + actions.map(a =>
      `<button class="achip ${lo.notes.includes(a)?'on':''}" data-act="cta" data-item="${name}" data-i="${i}" data-x="${esc(a)}">＋ ${esc(a)}</button>`
    ).join('') + `</div>`;
  }
  if (lo.notes.length) {
    h += `<div class="tags">` + lo.notes.map((nt, j) =>
      `<span class="tag">${esc(nt)}<button data-act="rmnote" data-item="${name}" data-i="${i}" data-j="${j}">✕</button></span>`
    ).join('') + `</div>`;
  }
  h += `<input class="noteinput" type="text" data-act="noteinput" data-item="${name}" data-i="${i}" placeholder="직접 입력 후 Enter">`;
  return h;
}

function doughBody(name) {
  const s = st[name]; let h = '';
  s.lots.forEach((lo, i) => {
    h += `<div class="lot"><div class="lh"><b>생산분 ${i+1}<span>${lo.prodDate||'날짜 미입력'}</span></b>` +
      (s.lots.length > 1 ? `<button class="x" data-act="rmlot" data-item="${name}" data-i="${i}">✕</button>` : '') + `</div>` +
      `<div class="lgrid">` +
      lf(name,i,'prodDate','생산일','','date',lo.prodDate) +
      uf(name,i,'pan','판수','5',lo.pan,'판') + `</div>` +
      `<div class="lgrid" style="margin-top:8px">` +
      uf(name,i,'ferm','발효도','93',lo.ferm,'%') +
      uf(name,i,'cold','냉기','10',lo.cold,'%') + `</div>` +
      noteBlock(name, i, lo, []) + `</div>`;
  });
  h += `<button class="dashed" data-act="addlot" data-item="${name}">＋ 날짜 추가</button>`;
  h += `<button class="done-btn" data-act="done" data-item="${name}">입력 완료</button>`;
  return h;
}

function lf(name, i, field, label, ph, type, val) {
  return `<div class="lf"><label>${label}</label><input type="${type}" data-act="lot" data-item="${name}" data-i="${i}" data-f="${field}" placeholder="${ph}" value="${esc(val||'')}"></div>`;
}
// 단위 붙은 입력칸 (도우 판수/발효도/냉기)
function uf(name, i, field, label, ph, val, unit) {
  return `<div class="lf"><label>${label}</label><div class="direct on" style="min-width:0;width:100%">` +
    `<input type="text" inputmode="numeric" data-act="lot" data-item="${name}" data-i="${i}" data-f="${field}" placeholder="${ph}" value="${esc(val||'')}" style="flex:1;min-width:0;text-align:left">` +
    `<span>${unit}</span></div></div>`;
}

// ── 진행률 ────────────────────────────────────────────
function updateProgress() {
  const total = roster.length;
  const done  = roster.filter(n => st[n].status !== 'pending').length;
  const left  = total - done;
  document.getElementById('koCount').textContent = `${done} / ${total} 확인`;
  document.getElementById('koLeft').textContent  = `남은 항목 ${left}`;
  document.getElementById('koFill').style.width  = (total ? done/total*100 : 0) + '%';
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
    const sel = agedSel[key] || [];
    const row = document.createElement('div'); row.className = 'agedrow';
    row.innerHTML = `<div class="ai"><b>${esc(r.name)}</b><span>${r.prodDate} · ${r.days}일 경과${r.qty ? ' · ' + esc(r.qty) : ''}</span></div>` +
      `<div class="ctas">` + AGED_ACTIONS.map(a =>
        `<button class="achip ${sel.includes(a)?'on':''}" data-aged="${esc(key)}" data-a="${esc(a)}">${esc(a)}</button>`
      ).join('') + `</div>`;
    L.appendChild(row);
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

// ── 점수 반영 ─────────────────────────────────────────
function applyScore(lo, kind, key, v) {
  if (kind === 'final') lo.finalScore = v;
  else lo.attrVals[key] = v;
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
    } else if (act === 'setnone') { st[name].status='none'; st[name]._open=true; refreshCard(name); renderAged(); }
    else if (act === 'revert')    { st[name].status='pending'; st[name]._menu=false; st[name]._open=true; menuOpen=null; refreshCard(name); renderAged(); }
    else if (act === 'done')      {
      if (st[name].lots.some(l => !l.prodDate)) { toast('생산일을 입력해야 확인 완료할 수 있어요'); return; }
      st[name].status='good'; st[name]._open=false; refreshCard(name);
    }
    else if (act === 'setscore')  { applyScore(st[name].lots[+t.dataset.i], t.dataset.kind, t.dataset.key, +t.dataset.c); refreshCard(name); }
    else if (act === 'cta')       { const a=t.dataset.x, arr=st[name].lots[+t.dataset.i].notes, k=arr.indexOf(a); k<0?arr.push(a):arr.splice(k,1); refreshCard(name); }
    else if (act === 'rmnote')    { st[name].lots[+t.dataset.i].notes.splice(+t.dataset.j,1); refreshCard(name); }
    else if (act === 'delitem')   { roster=roster.filter(n=>n!==name); delete st[name]; added.delete(name); render(); renderAged(); }
    else if (act === 'addlot')    { st[name].lots.push(newLot(name)); refreshCard(name); }
    else if (act === 'rmlot')     { st[name].lots.splice(+t.dataset.i,1); refreshCard(name); renderAged(); }
  });

  list.addEventListener('input', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const name = t.dataset.item, i = +t.dataset.i;
    if (t.dataset.act === 'scoreinput') {
      let v = parseInt(t.value, 10); if (isNaN(v)) return;
      const mx = +t.max || 150;
      v = Math.min(mx, Math.max(0, v));
      applyScore(st[name].lots[i], t.dataset.kind, t.dataset.key, v);
      const row = t.closest('.cond-row');
      row.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.c === v));
      row.querySelector('.direct').classList.toggle('on', !Array.from(row.querySelectorAll('button')).some(b => +b.dataset.c === v));
    } else if (t.dataset.act === 'lot') {
      st[name].lots[i][t.dataset.f] = t.value;
      if (t.dataset.f === 'prodDate') renderAged();
    }
  });

  list.addEventListener('keydown', e => {
    const t = e.target.closest('[data-act=noteinput]'); if (!t || e.key !== 'Enter') return;
    if (e.isComposing || e.keyCode === 229) return;   // 한글 IME 조합 중이면 무시
    e.preventDefault();
    const name = t.dataset.item, i = +t.dataset.i, v = t.value.trim();
    if (v && !st[name].lots[i].notes.includes(v)) st[name].lots[i].notes.push(v);
    t.value = ''; refreshCard(name);
    document.querySelector(`[data-card="${CSS.escape(name)}"]`)?.querySelectorAll('.lot')[i]?.querySelector('.noteinput')?.focus();
  });

  // 3일 경과 조치 토글 (복수 선택)
  document.getElementById('koAged').addEventListener('click', e => {
    const b = e.target.closest('[data-aged]'); if (!b) return;
    const key = b.dataset.aged, a = b.dataset.a;
    const arr = agedSel[key] || (agedSel[key] = []);
    const k = arr.indexOf(a); k < 0 ? arr.push(a) : arr.splice(k, 1);
    b.classList.toggle('on');
  });

  document.getElementById('koAddItem').onclick = openAddSheet;
  document.getElementById('branch').addEventListener('change', e => loadRoster(e.target.value));
  document.getElementById('rdate').addEventListener('change', renderAged);

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

// 특이사항 문장 목록 다시 그림
function reRenderNotes() {
  renderNoteList(document.getElementById('koNotesList'), notes, i => { notes.splice(i, 1); reRenderNotes(); });
}

function loadRoster(branch) {
  roster = (BRANCHES[branch]?.roster || []).slice();
  st = {}; added = new Set(); agedSel = {};
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

// 저장된 payload를 폼에 되채움 — init() 이후 호출
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
        prodDate: l.prod_date || '', pan: l.pan || '', ferm: l.fermentation || '', cold: l.cold || '',
        notes: l.notes ? l.notes.slice() : (l.note ? [l.note] : []),
      };
      const av = {};
      (meta.attrs || []).forEach(a => av[a] = SCORE_TYPES[attrMeta(a).type].default);
      (l.scores || []).forEach(s => { av[s.attr] = s.value; });
      return {
        prodDate: l.prod_date || '', qty: l.quantity || '', unit: l.unit || '',
        attrVals: av, finalScore: l.final_score ?? FINAL_SCORE_DEFAULT(),
        notes: (l.notes || []).slice(),
      };
    });
    st[name] = { status: it.status || 'good', lots: lots.length ? lots : [newLot(name)] };
  });

  const branchRoster = BRANCHES[document.getElementById('branch')?.value]?.roster || [];
  added = new Set(roster.filter(n => !branchRoster.includes(n)));

  notes.length = 0; notes.push(...(data.general_notes || []));

  agedSel = {};
  (data.aged_inventory || []).forEach(a => {
    const idx = (st[a.item_name]?.lots || []).findIndex(l => l.prodDate === a.prod_date);
    if (idx >= 0) agedSel[agedKey(a.item_name, idx, a.prod_date)] = (a.actions || []).slice();
  });

  render();
  renderAged();
  reRenderNotes();
}

export function buildPayload(header) {
  const items = roster.map(name => {
    const it = ITEMS[name], s = st[name];
    if (it.special) return { item_name:name, category:it.cat, status:s.status,
      lots: s.lots.map(l => ({ prod_date:l.prodDate||null, pan:l.pan||null, fermentation:l.ferm||null, cold:l.cold||null, notes:l.notes })) };
    return { item_name:name, category:it.cat, status:s.status,
      lots: s.status==='none' ? [] : s.lots.map(l => ({
        prod_date: l.prodDate||null, quantity: l.qty||null, unit: l.unit||null,
        scores: (it.attrs||[]).map(a => ({ attr:a, value:l.attrVals[a], type:attrMeta(a).type, group:attrMeta(a).group })),
        final_score: l.finalScore,
        notes: l.notes,
      })) };
  });
  const aged = getAged().map(r => ({
    item_name: r.name, prod_date: r.prodDate, days_old: r.days,
    quantity: r.qty || null, actions: agedSel[agedKey(r.name,r.i,r.prodDate)] || [],
  }));
  return { report: header, items, aged_inventory: aged, general_notes: notes };
}
