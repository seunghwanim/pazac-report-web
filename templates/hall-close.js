// templates/hall-close.js

import { ORDER_ITEMS, UNIT_MAP, DEFAULT_UNIT } from '../data/hall.js';
import { esc, bindTagInput, renderNoteList } from '../core/ui.js';

let bev   = [{ item:'', qty:'', unit:'' }];
let con   = [{ item:'', qty:'', unit:'' }];
let invDone = false;
let tasks = [];
let notes = [];

function itemUnit(name) { return UNIT_MAP[name] || DEFAULT_UNIT; }

function orderRows(arr, grp) {
  const el = document.getElementById(grp === 'bev' ? 'hcBevRows' : 'hcConRows');
  el.innerHTML = arr.map((r, i) => {
    const opts = `<option value="">품목 선택</option>` +
      ORDER_ITEMS[grp].map(n => `<option ${r.item===n?'selected':''}>${esc(n)}</option>`).join('');
    return `<div class="orow">
      <select data-grp="${grp}" data-i="${i}" data-f="item">${opts}</select>
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

function renderTasks() {
  const L = document.getElementById('hcTasks');
  L.innerHTML = tasks.map((t, i) =>
    `<div class="checkrow ${t.done?'on':''}">
      <button class="checkbox ${t.done?'on':''}" data-act="taskdone" data-i="${i}">${t.done?'✓':''}</button>
      <span class="ct">${esc(t.text)}</span>
      <button class="x" data-act="rmtask" data-i="${i}">✕</button>
    </div>`
  ).join('');
}

function reRenderNotes() {
  renderNoteList(document.getElementById('hcNotesList'), notes, i => { notes.splice(i,1); reRenderNotes(); });
}

function getArr(grp) { return grp === 'bev' ? bev : con; }

export function init() {
  bev = [{ item:'', qty:'', unit:'' }];
  con = [{ item:'', qty:'', unit:'' }];
  invDone = false; tasks = []; notes = [];

  orderRows(bev, 'bev'); orderRows(con, 'con');
  renderInv(); renderTasks();

  // 섹션 전체 위임
  const sect = document.querySelector('.sect');  // hall-close의 첫 sect
  document.getElementById('hcBevRows').addEventListener('change', e => {
    const t = e.target.closest('select[data-f=item]'); if (!t) return;
    const arr = getArr(t.dataset.grp), i = +t.dataset.i;
    arr[i].item = t.value;
    arr[i].unit = t.value ? itemUnit(t.value) : '';
    orderRows(arr, t.dataset.grp);
  });
  document.getElementById('hcConRows').addEventListener('change', e => {
    const t = e.target.closest('select[data-f=item]'); if (!t) return;
    const arr = getArr(t.dataset.grp), i = +t.dataset.i;
    arr[i].item = t.value;
    arr[i].unit = t.value ? itemUnit(t.value) : '';
    orderRows(arr, t.dataset.grp);
  });

  // input (qty, unit 직접 입력)
  ['hcBevRows','hcConRows'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      const t = e.target.closest('input[data-grp][data-f]'); if (!t) return;
      getArr(t.dataset.grp)[+t.dataset.i][t.dataset.f] = t.value;
    });
  });

  // addinv, rmorder, taskdone, rmtask — 전체 tplContainer 위임
  document.getElementById('tplContainer').addEventListener('click', e => {
    // 추가 버튼
    const addBtn = e.target.closest('.addinv');
    if (addBtn) { const grp = addBtn.dataset.grp; getArr(grp).push({item:'',qty:'',unit:''}); orderRows(getArr(grp), grp); return; }

    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act;
    if (act === 'rmorder') {
      const arr = getArr(t.dataset.grp); arr.splice(+t.dataset.i,1); orderRows(arr, t.dataset.grp);
    } else if (act === 'taskdone') {
      tasks[+t.dataset.i].done = !tasks[+t.dataset.i].done; renderTasks();
    } else if (act === 'rmtask') {
      tasks.splice(+t.dataset.i, 1); renderTasks();
    }

    // 재고 체크
    if (e.target.closest('#hcInvCheck')) { invDone = !invDone; renderInv(); }
  });

  // 태스크 입력
  document.getElementById('hcTaskInput').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const v = e.target.value.trim(); if (v) tasks.push({ text:v, done:false });
    e.target.value = ''; renderTasks(); e.target.focus();
  });

  bindTagInput(document.getElementById('hcNotesInput'), notes, reRenderNotes);
}

// 저장된 payload를 폼에 되채움 — init() 이후 호출
export function hydrate(data) {
  if (!data) return;
  const fromOrders = arr => (arr || []).map(r => ({ item: r.item || '', qty: r.qty ?? '', unit: r.unit || '' }));
  bev = fromOrders(data.orders?.beverage);
  con = fromOrders(data.orders?.consumables);
  if (!bev.length) bev = [{ item:'', qty:'', unit:'' }];
  if (!con.length) con = [{ item:'', qty:'', unit:'' }];
  invDone = !!data.inventory_updated;
  tasks = (data.opening_tasks || []).map(t => ({ text: t.task || '', done: !!t.done }));
  // bindTagInput이 notes 참조를 붙들고 있으므로 in-place로 교체
  notes.length = 0; notes.push(...(data.handover_notes || []));
  orderRows(bev, 'bev');
  orderRows(con, 'con');
  renderInv();
  renderTasks();
  reRenderNotes();
}

export function buildPayload(header) {
  const clean = arr => arr.filter(r => r.item).map(r => ({ item:r.item, qty:r.qty!==''?Number(r.qty):null, unit:r.unit||null }));
  return {
    report: header,
    orders: { beverage: clean(bev), consumables: clean(con) },
    inventory_updated: invDone,
    opening_tasks: tasks.filter(t => t.text.trim()).map(t => ({ task:t.text.trim(), done:t.done })),
    handover_notes: notes,
  };
}
