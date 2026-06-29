// templates/hall-close.js

import { ORDER_ITEMS, DEFAULT_UNIT } from '../data/hall.js';
import { esc, bindTagInput, renderNoteList } from '../core/ui.js';

const CUSTOM = '__custom__';

let bev = [];
let con = [];
let invDone = false;
let checklist = [];   // 오픈조 체크리스트 (문장 배열)
let notes = [];       // 인수인계 및 특이사항 (문장 배열)

function getArr(grp) { return grp === 'bev' ? bev : con; }
function blankRow()  { return { item:'', qty:'', unit:'', custom:false }; }

function unitFor(grp, name) {
  const f = ORDER_ITEMS[grp].find(o => o.name === name);
  return f ? f.unit : DEFAULT_UNIT;
}
function isKnown(grp, name) { return ORDER_ITEMS[grp].some(o => o.name === name); }

function orderRows(arr, grp) {
  const el = document.getElementById(grp === 'bev' ? 'hcBevRows' : 'hcConRows');
  el.innerHTML = arr.map((r, i) => {
    const itemCell = r.custom
      ? `<div class="itemcell">
           <input data-grp="${grp}" data-i="${i}" data-f="item" placeholder="품목 직접 입력" value="${esc(r.item)}">
           <button class="tolist" data-act="tolist" data-grp="${grp}" data-i="${i}" title="목록에서 선택">📋</button>
         </div>`
      : `<div class="itemcell">
           <select data-grp="${grp}" data-i="${i}" data-f="item">
             <option value="">품목 선택</option>
             ${ORDER_ITEMS[grp].map(o => `<option ${r.item === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
             <option value="${CUSTOM}">✏️ 직접 입력</option>
           </select>
         </div>`;
    return `<div class="orow">
      ${itemCell}
      <input type="number" inputmode="numeric" min="0" data-grp="${grp}" data-i="${i}" data-f="qty" placeholder="수량" value="${esc(r.qty)}">
      <input data-grp="${grp}" data-i="${i}" data-f="unit" placeholder="단위" value="${esc(r.unit)}">
      <button class="x" data-act="rmorder" data-grp="${grp}" data-i="${i}">✕</button>
    </div>`;
  }).join('');
}

function renderInv() {
  document.getElementById('hcInvCheck').classList.toggle('on', invDone);
  document.getElementById('hcInvCb').classList.toggle('on', invDone);
  document.getElementById('hcInvCb').textContent = invDone ? '✓' : '';
}

function reRenderChecklist() {
  renderNoteList(document.getElementById('hcChecklist'), checklist, i => { checklist.splice(i, 1); reRenderChecklist(); });
}

function reRenderNotes() {
  renderNoteList(document.getElementById('hcNotesList'), notes, i => { notes.splice(i, 1); reRenderNotes(); });
}

export function init() {
  bev = [blankRow()];
  con = [blankRow()];
  invDone = false; checklist = []; notes = [];

  orderRows(bev, 'bev'); orderRows(con, 'con');
  renderInv(); reRenderChecklist(); reRenderNotes();

  ['hcBevRows', 'hcConRows'].forEach(id => {
    const root = document.getElementById(id);

    // 드롭다운 선택
    root.addEventListener('change', e => {
      const sel = e.target.closest('select[data-f=item]'); if (!sel) return;
      const grp = sel.dataset.grp, i = +sel.dataset.i, arr = getArr(grp);
      if (sel.value === CUSTOM) {
        arr[i].custom = true; arr[i].item = '';
        orderRows(arr, grp);
        root.querySelectorAll('.orow')[i]?.querySelector('input[data-f=item]')?.focus();
      } else {
        arr[i].item = sel.value;
        arr[i].unit = sel.value ? unitFor(grp, sel.value) : '';
        orderRows(arr, grp);
      }
    });

    // 텍스트 입력 (직접입력 품목명, 수량, 단위)
    root.addEventListener('input', e => {
      const t = e.target.closest('input[data-grp][data-f]'); if (!t) return;
      getArr(t.dataset.grp)[+t.dataset.i][t.dataset.f] = t.value;
    });

    // 직접입력 → 목록 토글, 행 삭제
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      const grp = t.dataset.grp, i = +t.dataset.i, arr = getArr(grp);
      if (t.dataset.act === 'tolist') {
        arr[i].custom = false; arr[i].item = ''; arr[i].unit = '';
        orderRows(arr, grp);
      } else if (t.dataset.act === 'rmorder') {
        arr.splice(i, 1);
        if (!arr.length) arr.push(blankRow());
        orderRows(arr, grp);
      }
    });
  });

  // 항목 추가 버튼 + 재고 체크 (섹션 전체 위임)
  document.getElementById('tplContainer').addEventListener('click', e => {
    const addBtn = e.target.closest('.addinv');
    if (addBtn) { const grp = addBtn.dataset.grp; getArr(grp).push(blankRow()); orderRows(getArr(grp), grp); return; }
    if (e.target.closest('#hcInvCheck')) { invDone = !invDone; renderInv(); }
  });

  bindTagInput(document.getElementById('hcChecklistInput'), checklist, reRenderChecklist);
  bindTagInput(document.getElementById('hcNotesInput'), notes, reRenderNotes);
}

// 저장된 payload를 폼에 되채움 — init() 이후 호출
export function hydrate(data) {
  if (!data) return;
  const fromOrders = (rows, grp) => (rows || []).map(r => ({
    item: r.item || '', qty: r.qty ?? '', unit: r.unit || '',
    custom: r.item ? !isKnown(grp, r.item) : false,   // 목록에 없으면 직접입력 모드로
  }));
  bev = fromOrders(data.orders?.beverage, 'bev');
  con = fromOrders(data.orders?.consumables, 'con');
  if (!bev.length) bev = [blankRow()];
  if (!con.length) con = [blankRow()];
  invDone = !!data.inventory_updated;
  // bindTagInput이 참조를 붙들고 있으므로 in-place로 교체
  checklist.length = 0; checklist.push(...(data.opening_tasks || []));
  notes.length = 0;     notes.push(...(data.handover_notes || []));

  orderRows(bev, 'bev'); orderRows(con, 'con');
  renderInv(); reRenderChecklist(); reRenderNotes();
}

export function buildPayload(header) {
  const clean = arr => arr
    .filter(r => r.item.trim())
    .map(r => ({ item: r.item.trim(), qty: r.qty !== '' ? Number(r.qty) : null, unit: r.unit || null }));
  return {
    report: header,
    orders: { beverage: clean(bev), consumables: clean(con) },
    inventory_updated: invDone,
    opening_tasks: checklist,    // 문장 배열 (체크는 별도 페이지)
    handover_notes: notes,
  };
}
