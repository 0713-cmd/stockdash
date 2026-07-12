// 종목 심층 데이터 — 실공시 재무 시계열 + 애널리스트 리비전/서프라이즈 + 배당 + 1년 주가
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const TYPES = [
  'annualTotalRevenue', 'annualGrossProfit', 'annualOperatingCashFlow', 'annualFreeCashFlow',
  'quarterlyTotalRevenue', 'quarterlyGrossProfit',
].join(',');

// cookie+crumb (quoteSummary용)
let crumbCache = { cookie: null, crumb: null, ts: 0 };
async function getCrumb() {
  if (crumbCache.crumb && Date.now() - crumbCache.ts < 30 * 60 * 1000) return crumbCache;
  try {
    const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const cookie = (r1.headers.get('set-cookie') || '').split(';')[0] || null;
    if (!cookie) return crumbCache;
    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie }, signal: AbortSignal.timeout(8000) });
    const crumb = (await r2.text()).trim();
    if (crumb && crumb.length < 30 && !crumb.includes('{')) crumbCache = { cookie, crumb, ts: Date.now() };
  } catch (_) {}
  return crumbCache;
}

const raw = v => v?.raw ?? null;

// 애널리스트 리비전(earningsTrend) + 서프라이즈(earningsHistory) + 배당(summaryDetail)
async function fetchSummaryExtras(sym) {
  const { cookie, crumb } = await getCrumb();
  if (!crumb) return {};
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=earningsTrend,earningsHistory,summaryDetail&crumb=${encodeURIComponent(crumb)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`quoteSummary ${r.status}`);
  const j = await r.json();
  const res = j?.quoteSummary?.result?.[0] || {};

  // 리비전: 당해연도(0y) EPS 추정치의 7/30/60/90일 전 대비 변화
  const trend0y = (res.earningsTrend?.trend || []).find(t => t.period === '0y');
  const revisions = trend0y ? {
    period: trend0y.endDate || '당해연도',
    current: raw(trend0y.epsTrend?.current),
    d7: raw(trend0y.epsTrend?.['7daysAgo']),
    d30: raw(trend0y.epsTrend?.['30daysAgo']),
    d60: raw(trend0y.epsTrend?.['60daysAgo']),
    d90: raw(trend0y.epsTrend?.['90daysAgo']),
    upLast30: raw(trend0y.epsRevisions?.upLast30days),
    downLast30: raw(trend0y.epsRevisions?.downLast30days),
  } : null;

  // 서프라이즈: 최근 4분기 예상 대비 실제
  const surprises = (res.earningsHistory?.history || []).map(h => ({
    quarter: h.quarter?.fmt || null,
    epsEst: raw(h.epsEstimate),
    epsActual: raw(h.epsActual),
    surprisePct: h.surprisePercent?.raw != null ? +(h.surprisePercent.raw * 100).toFixed(1) : null,
  })).filter(h => h.epsActual != null);

  const sd = res.summaryDetail || {};
  const dividend = {
    rate: raw(sd.dividendRate),
    yieldPct: sd.dividendYield?.raw != null ? +(sd.dividendYield.raw * 100).toFixed(2) : null,
    payoutRatio: sd.payoutRatio?.raw != null ? +(sd.payoutRatio.raw * 100).toFixed(1) : null,
    exDate: sd.exDividendDate?.fmt || null,
    fiveYearAvgYield: raw(sd.fiveYearAvgDividendYield),
  };

  return { revisions, surprises, dividend };
}

// 1년 주가 (주간 종가)
async function fetchPriceSeries(sym) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1wk&range=1y`;
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`chart ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  const closes = res?.indicators?.quote?.[0]?.close || [];
  const ts = res?.timestamp || [];
  return ts.map((t, i) => closes[i] != null ? { t: t * 1000, c: +closes[i].toFixed(2) } : null).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');

  const sym = (req.query.sym || '').toUpperCase();
  if (!sym) { res.status(400).json({ error: 'sym required' }); return; }

  try {
    const p2 = Math.floor(Date.now() / 1000);
    const p1 = p2 - 6 * 365 * 86400;
    const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}?type=${TYPES}&period1=${p1}&period2=${p2}`;

    const [tsRes, extraRes, chartRes] = await Promise.allSettled([
      fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetchSummaryExtras(sym),
      fetchPriceSeries(sym),
    ]);

    let annual = [], quarterly = [];
    if (tsRes.status === 'fulfilled') {
      const series = {};
      for (const item of tsRes.value?.timeseries?.result || []) {
        const t = item.meta?.type?.[0];
        if (!t) continue;
        series[t] = {};
        for (const row of item[t] || []) {
          if (row?.asOfDate && row.reportedValue?.raw != null) series[t][row.asOfDate] = row.reportedValue.raw;
        }
      }
      const merge = (revKey, gpKey, ocfKey, fcfKey) => {
        const dates = Object.keys(series[revKey] || {}).sort();
        return dates.map(d => ({
          date: d,
          revenue: series[revKey]?.[d] ?? null,
          grossProfit: series[gpKey]?.[d] ?? null,
          ocf: ocfKey ? series[ocfKey]?.[d] ?? null : null,
          fcf: fcfKey ? series[fcfKey]?.[d] ?? null : null,
        }));
      };
      annual = merge('annualTotalRevenue', 'annualGrossProfit', 'annualOperatingCashFlow', 'annualFreeCashFlow');
      quarterly = merge('quarterlyTotalRevenue', 'quarterlyGrossProfit', null, null);
    }

    const extras = extraRes.status === 'fulfilled' ? extraRes.value : {};
    const priceSeries = chartRes.status === 'fulfilled' ? chartRes.value : [];

    res.status(200).json({
      sym, annual, quarterly,
      revisions: extras.revisions ?? null,
      surprises: extras.surprises ?? [],
      dividend: extras.dividend ?? null,
      priceSeries,
      source: 'Yahoo Finance 공시 기준',
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(200).json({ sym, annual: [], quarterly: [], revisions: null, surprises: [], dividend: null, priceSeries: [], error: e.message });
  }
}
