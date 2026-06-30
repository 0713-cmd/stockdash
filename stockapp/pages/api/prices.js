// Yahoo Finance 직접 fetch — npm 패키지 없음, Vercel 서버리스 호환
const SYMBOLS = [
  'GOOGL','TSLA','AAPL','AMZN','AVGO','COIN','IREN','NTRA',
  'NVDA','META','MSFT','ORCL','VRT','MU',
  'AMD','PLTR','ARM','SMCI','TSM','ASML','CRWD','SNOW',
  'UBER','ABNB','SHOP',
  'NFLX','NOW','ADBE','CRM','PANW','APP','MDB','DDOG','ZS',
  'MELI','BKNG','QCOM','ANET','CELH',
];

const HDRS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

const FIELDS = [
  'regularMarketPrice','regularMarketChangePercent','regularMarketPreviousClose',
  'fiftyTwoWeekHigh','fiftyTwoWeekLow','marketCap',
  'trailingPE','forwardPE','priceToSalesTrailing12Months',
].join(',');

async function bulkFetch(syms) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms.join(',')}&fields=${FIELDS}&formatted=false&lang=en-US&region=US`;
  const r = await fetch(url, { headers: HDRS, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`v7 ${r.status}`);
  const j = await r.json();
  return j.quoteResponse?.result || [];
}

async function chartFetch(sym) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d&includePrePost=false`;
  const r = await fetch(url, { headers: HDRS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`chart ${r.status}`);
  const j = await r.json();
  const m = j?.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) throw new Error('no price');
  const prev = m.previousClose ?? m.chartPreviousClose;
  const chg = prev ? (m.regularMarketPrice - prev) / prev * 100 : 0;
  return {
    symbol: sym,
    regularMarketPrice: m.regularMarketPrice,
    regularMarketChangePercent: chg,
    regularMarketPreviousClose: prev,
    fiftyTwoWeekHigh: m.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: m.fiftyTwoWeekLow,
    marketCap: m.marketCap,
    trailingPE: null, forwardPE: null,
    priceToSalesTrailing12Months: null,
  };
}

function parse(q) {
  if (!q?.regularMarketPrice) return null;
  const p = q.regularMarketPrice;
  return {
    price: +p.toFixed(2),
    change: +(q.regularMarketChangePercent ?? 0).toFixed(2),
    prevClose: q.regularMarketPreviousClose ? +q.regularMarketPreviousClose.toFixed(2) : null,
    high52: q.fiftyTwoWeekHigh ? +q.fiftyTwoWeekHigh.toFixed(2) : null,
    low52: q.fiftyTwoWeekLow ? +q.fiftyTwoWeekLow.toFixed(2) : null,
    mktCap: q.marketCap ?? null,
    trailingPE: q.trailingPE ? +q.trailingPE.toFixed(2) : null,
    forwardPE: q.forwardPE ? +q.forwardPE.toFixed(2) : null,
    psr: q.priceToSalesTrailing12Months ? +q.priceToSalesTrailing12Months.toFixed(2) : null,
    fetched: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');

  const { sym } = req.query;
  const targets = sym ? [sym.toUpperCase()] : SYMBOLS;
  const results = {};
  const done = new Set();

  // 1차: v7 bulk (20개씩 청크)
  try {
    const chunks = [];
    for (let i = 0; i < targets.length; i += 20) chunks.push(targets.slice(i, i + 20));
    for (const chunk of chunks) {
      try {
        const quotes = await bulkFetch(chunk);
        for (const q of quotes) {
          const p = parse(q);
          if (p) { results[q.symbol] = p; done.add(q.symbol); }
        }
      } catch (_) {}
    }
  } catch (_) {}

  // 2차: 실패 심볼 chart fallback
  const missing = targets.filter(s => !done.has(s));
  if (missing.length > 0) {
    await Promise.allSettled(missing.map(async (s) => {
      try {
        results[s] = parse(await chartFetch(s)) ?? null;
      } catch { results[s] = null; }
    }));
  }

  res.status(200).json({ prices: results, fetched_at: new Date().toISOString() });
}
