// pages/api/macro.js
// FRED API — 연준 공식 데이터. 키 없으면 정적 MACRO_INIT 값을 그대로 사용.

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_KEY = process.env.FRED_KEY || null;

const SERIES = {
  treasury_10y: 'DGS10',
  fed_rate: 'FEDFUNDS',
  cpi_yoy: 'CPIAUCSL',
  usd_krw: 'DEXKOUS',
};

async function fetchFRED(seriesId) {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
  const data = await res.json();
  const obs = data?.observations?.[0];
  return obs?.value !== '.' ? parseFloat(obs.value) : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  // FRED_KEY가 설정되지 않았으면 외부 호출 없이 바로 반환 (프론트에서 MACRO_INIT과 병합)
  if (!FRED_KEY) {
    res.status(200).json({ macro: {}, note: 'FRED_KEY 미설정 — 정적 기본값 사용' });
    return;
  }

  try {
    const [treasury10y, fedRate, cpi, usdKrw] = await Promise.allSettled([
      fetchFRED(SERIES.treasury_10y),
      fetchFRED(SERIES.fed_rate),
      fetchFRED(SERIES.cpi_yoy),
      fetchFRED(SERIES.usd_krw),
    ]);

    const macro = {};
    if (treasury10y.status === 'fulfilled' && treasury10y.value != null) macro.treasury_10y = treasury10y.value;
    if (fedRate.status === 'fulfilled' && fedRate.value != null) macro.fed_rate = fedRate.value;
    if (usdKrw.status === 'fulfilled' && usdKrw.value != null) macro.usd_krw = usdKrw.value;
    macro.fetched = new Date().toISOString();

    res.status(200).json({ macro });
  } catch (e) {
    res.status(200).json({ macro: {}, error: e.message });
  }
}
