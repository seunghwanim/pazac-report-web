// core/submit.js — 저장 레이어 (임시저장 → 최종제출)
// 실연결 시 CONNECTED = true로 바꾸고 URL/KEY 입력.
// CONNECTED = false 면 localStorage에 저장되어 전체 흐름을 바로 테스트할 수 있다.

const CONNECTED = false;
const SUPABASE_URL = '';   // 'https://xxxx.supabase.co'
const SUPABASE_KEY = '';   // anon public key

const DRAFT_TABLE  = 'report_drafts';
const REPORT_TABLE = 'reports';

// 임시저장 보관 기간: 24시간 지나면 자동 삭제
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

// ── 공통 헬퍼 ──────────────────────────────────────────
function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── localStorage 폴백 (CONNECTED=false) ───────────────
const LS_DRAFTS  = 'pazac_drafts';
const LS_REPORTS = 'pazac_reports';
function lsGet(key)      { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
function lsSet(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }

// ── 임시저장 (insert 또는 update) ──────────────────────
// row: { id?, branch, report_date, report_time, shift_type, author, data }
export async function saveDraft(row) {
  const now = new Date().toISOString();

  if (!CONNECTED) {
    const all = lsGet(LS_DRAFTS);
    if (row.id) {
      const i = all.findIndex(d => d.id === row.id);
      if (i >= 0) { all[i] = { ...all[i], ...row, updated_at: now }; lsSet(LS_DRAFTS, all); return { ok: true, id: row.id }; }
    }
    const id = uuid();
    all.push({ ...row, id, created_at: now, updated_at: now });
    lsSet(LS_DRAFTS, all);
    return { ok: true, id };
  }

  if (row.id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${DRAFT_TABLE}?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify({ ...stripId(row), updated_at: now }),
    });
    if (!res.ok) return { ok: false, error: await res.json().catch(() => ({})) };
    return { ok: true, id: row.id };
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${DRAFT_TABLE}`, {
    method: 'POST',
    headers: headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(stripId(row)),
  });
  if (!res.ok) return { ok: false, error: await res.json().catch(() => ({})) };
  const [saved] = await res.json();
  return { ok: true, id: saved.id };
}

// ── 만료된 임시저장 정리 (24시간 경과분 삭제) ──────────
export async function purgeExpiredDrafts() {
  const cutoff = Date.now() - DRAFT_TTL_MS;
  if (!CONNECTED) {
    const all  = lsGet(LS_DRAFTS);
    const kept = all.filter(d => new Date(d.created_at || 0).getTime() >= cutoff);
    if (kept.length !== all.length) lsSet(LS_DRAFTS, kept);
    return;
  }
  const iso = new Date(cutoff).toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/${DRAFT_TABLE}?created_at=lt.${encodeURIComponent(iso)}`,
    { method: 'DELETE', headers: headers() });
}

// ── 임시저장 목록 (지점·날짜·종류로 필터) ──────────────
export async function listDrafts({ branch, date, type } = {}) {
  await purgeExpiredDrafts();

  if (!CONNECTED) {
    let all = lsGet(LS_DRAFTS);
    if (branch) all = all.filter(d => d.branch === branch);
    if (date)   all = all.filter(d => d.report_date === date);
    if (type)   all = all.filter(d => d.shift_type === type);
    return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  const q = ['order=created_at.desc'];
  if (branch) q.push(`branch=eq.${encodeURIComponent(branch)}`);
  if (date)   q.push(`report_date=eq.${date}`);
  if (type)   q.push(`shift_type=eq.${type}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${DRAFT_TABLE}?${q.join('&')}`, { headers: headers() });
  return res.ok ? res.json() : [];
}

// ── 단일 임시저장 불러오기 ─────────────────────────────
export async function loadDraft(id) {
  if (!CONNECTED) return lsGet(LS_DRAFTS).find(d => d.id === id) || null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${DRAFT_TABLE}?id=eq.${id}`, { headers: headers() });
  if (!res.ok) return null;
  const [row] = await res.json();
  return row || null;
}

// ── 최종 제출 (reports insert + 해당 draft 삭제) ────────
// draft: { id, branch, report_date, report_time, shift_type, author, data }
export async function confirmReport({ draft, confirmedBy }) {
  const now = new Date().toISOString();
  const report = {
    branch:       draft.branch,
    report_date:  draft.report_date,
    report_time:  draft.report_time || null,
    shift_type:   draft.shift_type,
    author:       draft.author || null,
    confirmed_by: confirmedBy,
    data:         draft.data,
    draft_id:     draft.id || null,
  };

  if (!CONNECTED) {
    const reports = lsGet(LS_REPORTS);
    const row = { ...report, id: uuid(), created_at: now, confirmed_at: now };
    reports.push(row);
    lsSet(LS_REPORTS, reports);
    if (draft.id) lsSet(LS_DRAFTS, lsGet(LS_DRAFTS).filter(d => d.id !== draft.id));
    return { ok: true, simulated: true, row };
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${REPORT_TABLE}`, {
    method: 'POST',
    headers: headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(report),
  });
  if (!res.ok) return { ok: false, error: await res.json().catch(() => ({})) };
  const [row] = await res.json();

  if (draft.id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${DRAFT_TABLE}?id=eq.${draft.id}`, { method: 'DELETE', headers: headers() });
  }
  return { ok: true, row };
}

function stripId(row) { const { id, ...rest } = row; return rest; }
