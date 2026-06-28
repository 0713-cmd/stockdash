// pages/api/store.js
// 포트폴리오·투자일지 저장소
// Vercel KV (무료: 30MB, 3000 req/day)
// KV 없을 시 메모리 폴백 (서버 재시작 시 초기화)

let memStore = {}; // KV 없을 때 임시 메모리

async function kv() {
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
  } catch {
    return null;
  }
}

async function kvGet(key) {
  const store = await kv();
  if (store) return store.get(key);
  return memStore[key] || null;
}

async function kvSet(key, value) {
  const store = await kv();
  if (store) return store.set(key, value);
  memStore[key] = value;
  return value;
}

export default async function handler(req, res) {
  const { type, user = 'default' } = req.query;

  // ── 포트폴리오 거래 기록 ──────────────────────
  if (type === 'trades') {
    if (req.method === 'GET') {
      const trades = await kvGet(`trades:${user}`) || [];
      return res.status(200).json({ trades });
    }
    if (req.method === 'POST') {
      const { sym, action, price, qty, date, note } = req.body;
      const trades = await kvGet(`trades:${user}`) || [];
      const newTrade = {
        id: Date.now(),
        sym: sym?.toUpperCase(),
        action, // '매수' or '매도'
        price: parseFloat(price),
        qty: parseFloat(qty),
        date: date || new Date().toISOString().split('T')[0],
        note: note || '',
        created: new Date().toISOString(),
      };
      trades.push(newTrade);
      await kvSet(`trades:${user}`, trades);
      return res.status(200).json({ ok: true, trade: newTrade });
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const trades = await kvGet(`trades:${user}`) || [];
      const filtered = trades.filter(t => t.id !== parseInt(id));
      await kvSet(`trades:${user}`, filtered);
      return res.status(200).json({ ok: true });
    }
  }

  // ── 투자일지 ─────────────────────────────────
  if (type === 'journal') {
    if (req.method === 'GET') {
      const entries = await kvGet(`journal:${user}`) || [];
      return res.status(200).json({ entries });
    }
    if (req.method === 'POST') {
      const { sym, action, price, reason, expected, date } = req.body;
      const entries = await kvGet(`journal:${user}`) || [];
      const entry = {
        id: Date.now(),
        sym: sym?.toUpperCase(),
        action, price: parseFloat(price || 0),
        reason, expected,
        date: date || new Date().toISOString().split('T')[0],
        result: null,     // 나중에 채움
        analysis: null,   // Claude 분석 결과
        status: 'open',
        created: new Date().toISOString(),
      };
      entries.unshift(entry);
      await kvSet(`journal:${user}`, entries);
      return res.status(200).json({ ok: true, entry });
    }
    if (req.method === 'PUT') {
      // 결과 업데이트
      const { id, result, analysis } = req.body;
      const entries = await kvGet(`journal:${user}`) || [];
      const idx = entries.findIndex(e => e.id === parseInt(id));
      if (idx >= 0) {
        entries[idx].result = result;
        entries[idx].analysis = analysis;
        entries[idx].status = 'closed';
        entries[idx].updated = new Date().toISOString();
        await kvSet(`journal:${user}`, entries);
      }
      return res.status(200).json({ ok: true });
    }
  }

  // ── 사용자 설정 ───────────────────────────────
  if (type === 'settings') {
    if (req.method === 'GET') {
      const settings = await kvGet(`settings:${user}`) || {
        cash_pct: 40,
        tsla_lock: true,
        finnhub_key: '',
      };
      return res.status(200).json({ settings });
    }
    if (req.method === 'POST') {
      const current = await kvGet(`settings:${user}`) || {};
      const updated = { ...current, ...req.body };
      await kvSet(`settings:${user}`, updated);
      return res.status(200).json({ ok: true, settings: updated });
    }
  }

  res.status(400).json({ error: '지원하지 않는 type' });
}

export const config = {
  api: { bodyParser: true },
};
