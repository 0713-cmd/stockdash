// pages/api/finnhub.js
// Finnhub API — 무료 (60 req/min), 키 필요
// 세그먼트 데이터, 뉴스, 재무제표

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const BASE = 'https://finnhub.io/api/v1';

async function fhFetch(path) {
  if (!FINNHUB_KEY) throw new Error('FINNHUB_KEY 환경변수 없음. Vercel 대시보드에서 설정 필요.');
  const res = await fetch(`${BASE}${path}&token=${FINNHUB_KEY}`, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'StockDash/1.0' },
  });
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  const { type, sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym 파라미터 필요' });

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    if (type === 'news') {
      const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const to = new Date().toISOString().split('T')[0];
      const data = await fhFetch(`/company-news?symbol=${sym}&from=${from}&to=${to}`);
      const items = (Array.isArray(data) ? data : []).slice(0, 5).map(n => ({
        headline: n.headline,
        source: n.source,
        date: new Date(n.datetime * 1000).toISOString().split('T')[0],
        url: n.url,
        sentiment: n.sentiment || null,
      }));
      return res.status(200).json({ news: items });
    }

    if (type === 'segments') {
      try {
        const product = await fhFetch(`/stock/revenue-breakdown?symbol=${sym}`);
        return res.status(200).json({ segments: product });
      } catch {
        return res.status(200).json({ segments: null, note: '세그먼트 데이터 없음 (무료티어 한계)' });
      }
    }

    if (type === 'financials') {
      const data = await fhFetch(`/stock/financials?symbol=${sym}&statement=bs&freq=quarterly`);
      return res.status(200).json({ financials: data });
    }

    if (type === 'estimate') {
      const data = await fhFetch(`/stock/eps-estimate?symbol=${sym}&freq=quarterly`);
      return res.status(200).json({ estimate: data });
    }

    return res.status(400).json({ error: '지원하지 않는 type' });

  } catch (e) {
    // API 키 없을 때: 초기값(lib/data.js) 사용
    return res.status(200).json({
      error: e.message,
      fallback: true,
      note: 'Finnhub API 키 미설정. lib/data.js 초기값 사용 중.',
    });
  }
}
