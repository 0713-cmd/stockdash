// ═══════════════════════════════════════════════════
// Yahoo Finance 직접 HTTP fetch — 서버리스(Vercel) 호환
// 주의: 'yahoo-finance2' npm 패키지는 Vercel 서버리스에서
// Yahoo가 요청을 차단해 가격이 전부 0으로 나오는 문제가 있어
// User-Agent 스푸핑 직접 fetch 방식을 사용합니다.
// ═══════════════════════════════════════════════════

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
  'trailingPE','forwardPE','priceToSalesTrailing12Months','priceToBook',
  'epsTrailingTwelveMonths','epsForward',
  'targetMeanPrice','targetHighPrice','targetLowPrice','numberOfAnalystOpinions','averageAnalystRating',
  'dividendYield','trailingAnnualDividendYield','beta','sector','shortName','currency',
  'fiftyDayAverage','fiftyDayAverageChangePercent',
  'twoHundredDayAverage','twoHundredDayAverageChangePercent',
].join(',');

// v7 quote API는 cookie+crumb 인증 필요 — 모듈 레벨 30분 캐시
let crumbCache = { cookie: null, crumb: null, ts: 0 };

async function getCrumb() {
  if (crumbCache.crumb && Date.now() - crumbCache.ts < 30 * 60 * 1000) return crumbCache;
  try {
    const r1 = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': HDRS['User-Agent'] },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
    const setCookie = r1.headers.get('set-cookie');
    const cookie = setCookie ? setCookie.split(';')[0] : null;
    if (!cookie) return crumbCache;
    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': HDRS['User-Agent'], Cookie: cookie },
      signal: AbortSignal.timeout(8000),
    });
    const crumb = (await r2.text()).trim();
    if (crumb && crumb.length < 30 && !crumb.includes('{')) {
      crumbCache = { cookie, crumb, ts: Date.now() };
    }
  } catch (_) {}
  return crumbCache;
}

async function bulkFetch(syms) {
  const { cookie, crumb } = await getCrumb();
  const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
  const hdrs = cookie ? { ...HDRS, Cookie: cookie } : HDRS;
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms.join(',')}&fields=${FIELDS}&formatted=false&lang=en-US&region=US${crumbParam}`;
  const r = await fetch(url, { headers: hdrs, signal: AbortSignal.timeout(10000) });
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
    currency: m.currency,
    shortName: sym,
  };
}

function round(n, d = 2) { return n == null ? null : +Number(n).toFixed(d); }

function parse(q) {
  if (!q?.regularMarketPrice) return null;
  return {
    price: round(q.regularMarketPrice),
    change: round(q.regularMarketChangePercent),
    prevClose: round(q.regularMarketPreviousClose),
    high52: round(q.fiftyTwoWeekHigh),
    low52: round(q.fiftyTwoWeekLow),
    mktCap: q.marketCap ?? null,
    trailingPE: round(q.trailingPE, 2),
    forwardPE: round(q.forwardPE, 2),
    psr: round(q.priceToSalesTrailing12Months, 2),
    pb: round(q.priceToBook, 2),
    eps: round(q.epsTrailingTwelveMonths, 2),
    epsForward: round(q.epsForward, 2),
    targetMean: round(q.targetMeanPrice, 2),
    targetHigh: round(q.targetHighPrice, 2),
    targetLow: round(q.targetLowPrice, 2),
    numAnalysts: q.numberOfAnalystOpinions ?? null,
    recommendation: q.averageAnalystRating ?? null,
    dividendYield: (() => {
      // v7의 dividendYield는 이미 %단위, trailingAnnualDividendYield는 소수(fraction)
      if (q.dividendYield != null) return round(q.dividendYield, 2);
      if (q.trailingAnnualDividendYield != null) return round(q.trailingAnnualDividendYield * 100, 2);
      return null;
    })(),
    beta: round(q.beta, 2),
    sector: q.sector ?? null,
    name: q.shortName ?? null,
    currency: q.currency ?? 'USD',
    fiftyDayAvg: round(q.fiftyDayAverage),
    fiftyDayChgPct: round(q.fiftyDayAverageChangePercent ? q.fiftyDayAverageChangePercent*100 : null),
    twoHundredDayAvg: round(q.twoHundredDayAverage),
    twoHundredDayChgPct: round(q.twoHundredDayAverageChangePercent ? q.twoHundredDayAverageChangePercent*100 : null),
    fetched: new Date().toISOString(),
  };
}

// symbols 배열을 받아 { SYM: parsedData|null } 맵을 반환
export async function fetchPrices(symbols) {
  const results = {};
  const done = new Set();

  const chunks = [];
  for (let i = 0; i < symbols.length; i += 20) chunks.push(symbols.slice(i, i + 20));

  await Promise.allSettled(chunks.map(async (chunk) => {
    try {
      const quotes = await bulkFetch(chunk);
      for (const q of quotes) {
        const p = parse(q);
        if (p) { results[q.symbol] = p; done.add(q.symbol); }
      }
    } catch (_) {}
  }));

  const missing = symbols.filter(s => !done.has(s));
  if (missing.length > 0) {
    await Promise.allSettled(missing.map(async (s) => {
      try {
        const p = parse(await chartFetch(s));
        results[s] = p ?? null;
      } catch { results[s] = null; }
    }));
  }

  return results;
}
