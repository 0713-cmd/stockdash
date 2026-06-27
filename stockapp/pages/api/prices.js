// pages/api/prices.js
// 야후 파이낸스 비공식 API — 서버사이드, CORS 없음, 무료

const SYMBOLS = [
  'GOOGL','TSLA','AAPL','AMZN','AVGO','COIN','IREN','NTRA',
  'NVDA','META','MSFT','ORCL','VRT','MU',
];

async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No result');

  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const prev = meta.previousClose;
  const high52 = meta.fiftyTwoWeekHigh;
  const low52 = meta.fiftyTwoWeekLow;
  const mktCap = meta.marketCap;

  // 역사적 가격 (1년치) → PE 히스토리 계산용
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const hist = timestamps.slice(-252).map((t, i) => ({
    date: new Date(t * 1000).toISOString().split('T')[0],
    close: closes[i] ? Math.round(closes[i] * 100) / 100 : null,
  })).filter(h => h.close);

  return {
    price: Math.round(price * 100) / 100,
    prev: Math.round(prev * 100) / 100,
    change: prev ? +((price - prev) / prev * 100).toFixed(2) : 0,
    high52: high52 ? Math.round(high52 * 100) / 100 : null,
    low52: low52 ? Math.round(low52 * 100) / 100 : null,
    mktCap: mktCap || null,
    currency: meta.currency || 'USD',
    hist, // 1년치 종가 히스토리
    fetched: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');

  // 특정 심볼만 요청 시
  const { sym } = req.query;
  const targets = sym ? [sym.toUpperCase()] : SYMBOLS;

  const results = {};
  const errors = {};

  await Promise.allSettled(
    targets.map(async (s) => {
      try {
        results[s] = await fetchYahoo(s);
      } catch (e) {
        errors[s] = e.message;
        results[s] = null;
      }
    })
  );

  res.status(200).json({
    prices: results,
    errors: Object.keys(errors).length ? errors : undefined,
    fetched_at: new Date().toISOString(),
  });
}
