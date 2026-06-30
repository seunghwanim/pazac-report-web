// templates/kitchen-close.js — 주방 마감(BOH) 보고
// 금일 도우 재고(생산일별+발효도+총판수 자동), 내일 프랩(우선/그날/추가),
// 오늘 추가 진행 프랩, 해동품(오늘 넣음/내일 할 것), 3일 지난 재료(처리계획), 특이사항.
// 저장은 공용 흐름(Supabase) 그대로.

import { esc, bindTagInput, renderNoteList } from '../core/ui.js';

// ── 상태 (재할당 없이 in-place로만 변경) ──────────────
const dough      = [];   // [{ prodDate, pan, ferm }]
const prepMust   = [];   // 내일 ① 우선
const prepDay    = [];   // 내일 ② 그날
const prepExtra  = [];   // 내일 ③ 추가
const todayExtra = [];   // 오늘 추가로 진행한 프랩
const thawNow    = [];   // 오늘 해동 넣어둔 것 [{ item, qty, unit }]
const thawNext   = [];   // 내일 출근 후 해동할 것 [{ item, qty, unit }]
const aged       = [];   // 3일 지난 재료 [{ item, qty, prodDate, plan }]
const notes      = [];   // 특이사항

const blankDough = () => ({ prodDate:'', pan:'', ferm:'' });
const blankThaw  = () => ({ item:'', qty:'', unit:'' });
const blankAged  = () => ({ item:'', qty:'', prodDate:'', plan:'' });

// ── 도우 재고 ─────────────────────────────────────────
function renderDough() {
  document.getElementById('kcDoughRows').innerHTML = dough.map((r, i) => `
    <div class="orow" style="grid-template-columns:1.5fr .8fr .9fr auto">
      <input type="date" data-i="${i}" data-f="prodDate" value="${esc(r.prodDate)}">
      <input type="number" inputmode="decimal" step="any" data-i="${i}" data-f="pan" placeholder="판수" value="${esc(r.pan)}">
      <input type="number" inputmode="numeric" data-i="${i}" data-f="ferm" placeholder="발효도%" value="${esc(r.ferm)}">
      <button class="x" data-act="rmdough" data-i="${i}">✕</button>
    </div>`).join('');
  updateTotal();
}
function updateTotal() {
  const total = dough.reduce((s, r) => s + (parseFloat(r.pan) || 0), 0);
  document.getElementById('kcDoughTotal').textContent = `총 ${+total.toFixed(2)}판`;
}

// ── 품목 행 (해동: item/qty/unit) ──────────────────────
function renderThaw(id, arr) {
  document.getElementById(id).innerHTML = arr.map((r, i) => `
    <div class="orow" style="grid-template-columns:1.5fr .7fr .8fr auto">
      <input data-i="${i}" data-f="item" placeholder="품목" value="${esc(r.item)}">
      <input type="number" inputmode="decimal" step="any" data-i="${i}" data-f="qty" placeholder="수량" value="${esc(r.qty)}">
      <input data-i="${i}" data-f="unit" placeholder="단위" value="${esc(r.unit)}">
      <button class="x" data-act="rm" data-i="${i}">✕</button>
    </div>`).join('');
}
const reThawNow  = () => renderThaw('kcThawNowRows', thawNow);
const reThawNext = () => renderThaw('kcThawNextRows', thawNext);

// ── 3일 지난 재료 (item/qty/date + 처리계획) ───────────
function renderAged() {
  document.getElementById('kcAgedRows').innerHTML = aged.map((r, i) => `
    <div class="agedcard">
      <div class="orow" style="grid-template-columns:1.4fr .7fr 1fr auto">
        <input data-i="${i}" data-f="item" placeholder="품목" value="${esc(r.item)}">
        <input type="number" inputmode="decimal" step="any" data-i="${i}" data-f="qty" placeholder="수량" value="${esc(r.qty)}">
        <input type="date" data-i="${i}" data-f="prodDate" value="${esc(r.prodDate)}">
        <button class="x" data-act="rm" data-i="${i}">✕</button>
      </div>
      <input class="noteinput" style="margin-top:6px" data-i="${i}" data-f="plan" placeholder="처리 계획 (어떻게 쓸지)" value="${esc(r.plan)}">
    </div>`).join('');
}

// ── 문장 리스트 ────────────────────────────────────────
function reList(id, arr) {
  renderNoteList(document.getElementById(id), arr, i => { arr.splice(i, 1); reList(id, arr); });
}
const reMust  = () => reList('kcMustList',  prepMust);
const reDay   = () => reList('kcDayList',   prepDay);
const reExtra = () => reList('kcExtraList', prepExtra);
const reToday = () => reList('kcTodayList', todayExtra);
const reNotes = () => reList('kcNotesList', notes);

// 행 그룹 공통 이벤트 (값 입력 + 행 삭제)
function bindRows(containerId, arr, reRender) {
  const c = document.getElementById(containerId);
  c.addEventListener('input', e => {
    const t = e.target.closest('[data-f]'); if (!t) return;
    arr[+t.dataset.i][t.dataset.f] = t.value;
  });
  c.addEventListener('click', e => {
    const b = e.target.closest('[data-act=rm]'); if (!b) return;
    arr.splice(+b.dataset.i, 1); reRender();
  });
}

// ── 공개 API ──────────────────────────────────────────
export function init() {
  dough.length = 0; dough.push(blankDough());
  [prepMust, prepDay, prepExtra, todayExtra, thawNow, thawNext, aged, notes].forEach(a => a.length = 0);

  renderDough(); reThawNow(); reThawNext(); renderAged();
  reMust(); reDay(); reExtra(); reToday(); reNotes();

  // 도우: 값 입력(합계만 갱신) + 삭제(비면 빈 행 유지) + 추가
  const dr = document.getElementById('kcDoughRows');
  dr.addEventListener('input', e => {
    const t = e.target.closest('input[data-f]'); if (!t) return;
    dough[+t.dataset.i][t.dataset.f] = t.value;
    if (t.dataset.f === 'pan') updateTotal();
  });
  dr.addEventListener('click', e => {
    const b = e.target.closest('[data-act=rmdough]'); if (!b) return;
    dough.splice(+b.dataset.i, 1);
    if (!dough.length) dough.push(blankDough());
    renderDough();
  });
  document.getElementById('kcAddDough').onclick = () => { dough.push(blankDough()); renderDough(); };

  // 해동 / 3일차 행 그룹
  bindRows('kcThawNowRows',  thawNow,  reThawNow);
  bindRows('kcThawNextRows', thawNext, reThawNext);
  bindRows('kcAgedRows',     aged,     renderAged);
  document.getElementById('kcAddThawNow').onclick  = () => { thawNow.push(blankThaw());  reThawNow();  };
  document.getElementById('kcAddThawNext').onclick = () => { thawNext.push(blankThaw()); reThawNext(); };
  document.getElementById('kcAddAged').onclick      = () => { aged.push(blankAged());    renderAged(); };

  // 문장 리스트
  bindTagInput(document.getElementById('kcMustInput'),  prepMust,   reMust);
  bindTagInput(document.getElementById('kcDayInput'),   prepDay,    reDay);
  bindTagInput(document.getElementById('kcExtraInput'), prepExtra,  reExtra);
  bindTagInput(document.getElementById('kcTodayInput'), todayExtra, reToday);
  bindTagInput(document.getElementById('kcNotesInput'), notes,      reNotes);
}

// 저장된 payload를 폼에 되채움 — init() 이후 호출
export function hydrate(data) {
  if (!data) return;
  const fillRows = (arr, src, map) => { arr.length = 0; (src || []).forEach(r => arr.push(map(r))); };
  const fillList = (arr, src) => { arr.length = 0; (src || []).forEach(v => arr.push(v)); };

  fillRows(dough, data.dough_stock, r => ({ prodDate: r.prod_date || '', pan: r.pan ?? '', ferm: r.ferm ?? '' }));
  if (!dough.length) dough.push(blankDough());
  fillRows(thawNow,  data.thaw_now,  r => ({ item: r.item || '', qty: r.qty ?? '', unit: r.unit || '' }));
  fillRows(thawNext, data.thaw_next, r => ({ item: r.item || '', qty: r.qty ?? '', unit: r.unit || '' }));
  fillRows(aged,     data.aged,      r => ({ item: r.item || '', qty: r.qty ?? '', prodDate: r.prod_date || '', plan: r.plan || '' }));
  fillList(prepMust, data.prep_must);
  fillList(prepDay, data.prep_day);
  fillList(prepExtra, data.prep_extra);
  fillList(todayExtra, data.today_extra);
  fillList(notes, data.notes);

  renderDough(); reThawNow(); reThawNext(); renderAged();
  reMust(); reDay(); reExtra(); reToday(); reNotes();
}

export function buildPayload(header) {
  const thaw = arr => arr.filter(r => r.item.trim())
    .map(r => ({ item: r.item.trim(), qty: r.qty !== '' ? Number(r.qty) : null, unit: r.unit || null }));
  return {
    report: header,
    dough_stock: dough
      .filter(r => r.prodDate || r.pan !== '' || r.ferm !== '')
      .map(r => ({ prod_date: r.prodDate || null, pan: r.pan !== '' ? Number(r.pan) : null, ferm: r.ferm !== '' ? Number(r.ferm) : null })),
    dough_total_pan: +dough.reduce((s, r) => s + (parseFloat(r.pan) || 0), 0).toFixed(2),
    prep_must:   prepMust,
    prep_day:    prepDay,
    prep_extra:  prepExtra,
    today_extra: todayExtra,
    thaw_now:    thaw(thawNow),
    thaw_next:   thaw(thawNext),
    aged: aged.filter(r => r.item.trim())
      .map(r => ({ item: r.item.trim(), qty: r.qty !== '' ? Number(r.qty) : null, prod_date: r.prodDate || null, plan: r.plan || null })),
    notes: notes,
  };
}
