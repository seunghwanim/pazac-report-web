// core/submit.js — Supabase 저장 레이어
// 실연결 시 CONNECTED = true로 바꾸고 URL/KEY 입력

const CONNECTED = false;
const SUPABASE_URL = '';   // 'https://xxxx.supabase.co'
const SUPABASE_KEY = '';   // anon public key

export async function submitReport(payload) {
  if (!CONNECTED) {
    // 미연결: JSON 미리보기만 반환
    return {
      ok: false,
      simulated: true,
      row: { id: '(uuid auto)', created_at: '(now auto)', ...payload },
    };
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err };
  }

  const [row] = await res.json();
  return { ok: true, row };
}
