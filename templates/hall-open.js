// templates/hall-open.js

import { POSITIONS } from '../data/hall.js';
import { esc, bindTagInput, renderTags, renderNoteList } from '../core/ui.js';

let people = [];
let checks = { upselling: null, review_bread: null };
let upsellItems = [];
let notes = [];

function renderPeople() {
  const L = document.getElementById('hoPeople'); L.innerHTML = '';
  people.forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'person';
    d.innerHTML =
      `<div class="ph"><input data-i="${i}" data-f="name" placeholder="이름" value="${esc(p.name)}">` +
      (people.length > 1 ? `<button class="x" data-act="rmperson" data-i="${i}">✕</button>` : '') + `</div>` +
      `<div class="pills">` +
      POSITIONS.map(r => `<button class="pill ${p.roles.includes(r)?'on':''}" data-act="role" data-i="${i}" data-r="${r}">${r}</button>`).join('') +
      `</div>`;
    L.appendChild(d);
  });
}

function renderChecks() {
  document.querySelectorAll('.ox').forEach(box => {
    const key = box.dataset.key;
    box.querySelectorAll('button').forEach(b => b.classList.toggle('on', checks[key] === b.dataset.v));
  });
}

function reRenderUpsell() {
  renderTags(document.getElementById('hoUpsellTags'), upsellItems, i => { upsellItems.splice(i,1); reRenderUpsell(); });
}

function reRenderNotes() {
  renderNoteList(document.getElementById('hoNotesList'), notes, i => { notes.splice(i,1); reRenderNotes(); });
}

export function init() {
  people = [{ name:'', roles:[] }];
  checks = { upselling:null, review_bread:null };
  upsellItems = [];
  notes = [];
  renderPeople();
  renderChecks();
  reRenderUpsell();
  reRenderNotes();

  document.getElementById('hoPeople').addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const i = +t.dataset.i;
    if (t.dataset.act === 'role') {
      const r = t.dataset.r, roles = people[i].roles, k = roles.indexOf(r);
      k < 0 ? roles.push(r) : roles.splice(k, 1); renderPeople();
    } else if (t.dataset.act === 'rmperson') {
      people.splice(i, 1); renderPeople();
    }
  });

  document.getElementById('hoPeople').addEventListener('input', e => {
    const t = e.target.closest('[data-f=name]'); if (!t) return;
    people[+t.dataset.i].name = t.value;
  });

  document.getElementById('hoAddPerson').onclick = () => {
    people.push({ name:'', roles:[] }); renderPeople();
  };

  document.querySelectorAll('.ox').forEach(box => {
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const key = box.dataset.key;
      checks[key] = checks[key] === b.dataset.v ? null : b.dataset.v;
      renderChecks();
    });
  });

  bindTagInput(document.getElementById('hoUpsellInput'), upsellItems, reRenderUpsell);
  bindTagInput(document.getElementById('hoNotesInput'), notes, reRenderNotes);
}

// 저장된 payload(buildPayload 결과)를 폼에 되채움 — init() 이후 호출
export function hydrate(data) {
  if (!data) return;
  people = (data.positions && data.positions.length)
    ? data.positions.map(p => ({ name: p.name || '', roles: (p.roles || []).slice() }))
    : [{ name:'', roles:[] }];
  checks = {
    upselling:    data.checks?.upselling ?? null,
    review_bread: data.checks?.review_bread ?? null,
  };
  // bindTagInput이 배열 참조를 붙들고 있으므로 재할당하지 말고 in-place로 교체
  upsellItems.length = 0; upsellItems.push(...(data.upsell_items || []));
  notes.length = 0;       notes.push(...(data.general_notes || []));
  renderPeople();
  renderChecks();
  reRenderUpsell();
  reRenderNotes();
}

export function buildPayload(header) {
  const ps = people.filter(p => p.name.trim()).map(p => ({ name:p.name.trim(), roles:p.roles }));
  const byPos = POSITIONS.map(pos => ({
    position: pos,
    staff: ps.filter(p => p.roles.includes(pos)).map(p => p.name),
  }));
  return { report:header, positions:ps, by_position:byPos, checks, upsell_items:upsellItems, general_notes:notes };
}
