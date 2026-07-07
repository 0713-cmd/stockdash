// 실제 공시 재무제표 시계열 — Yahoo fundamentals-timeseries
// 연간 4~5개년 + 분기 5개: 매출/매출총이익/영업CF/FCF (raw 공시값)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const TYPES = [
  'annualTotalRevenue', 'annualGrossProfit', 'annualOperatingCashFlow', 'annualFreeCashFlow',
  'quarterlyTotalRevenue', 'quarterlyGrossProfit',
].join(',');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');

  const sym = (req.query.sym || '').toUpperCase();
  if (!sym) { res.status(400).json({ error: 'sym required' }); return; }

  try {
    const p2 = Math.floor(Date.now() / 1000);
    const p1 = p2 - 6 * 365 * 86400;
    const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}?type=${TYPES}&period1=${p1}&period2=${p2}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();

    const series = {};
    for (const item of j?.timeseries?.result || []) {
      const t = item.meta?.type?.[0];
      if (!t) continue;
      series[t] = {};
      for (const row of item[t] || []) {
        if (row?.asOfDate && row.reportedValue?.raw != null) {
          series[t][row.asOfDate] = row.reportedValue.raw;
        }
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

    const annual = merge('annualTotalRevenue', 'annualGrossProfit', 'annualOperatingCashFlow', 'annualFreeCashFlow');
    const quarterly = merge('quarterlyTotalRevenue', 'quarterlyGrossProfit', null, null);

    res.status(200).json({ sym, annual, quarterly, source: 'Yahoo Finance 공시 기준', fetched_at: new Date().toISOString() });
  } catch (e) {
    res.status(200).json({ sym, annual: [], quarterly: [], error: e.message });
  }
}
