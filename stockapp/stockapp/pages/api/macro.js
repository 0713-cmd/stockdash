// pages/api/macro.js
// FRED API — 연준 공식 데이터, 완전 무료
// 기본 시리즈는 키 없이 접근 가능

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_KEY = process.env.FRED_KEY || 'abcdefghijklmnopqrstuvwxyz123456'; // 무료 키

const SERIES = {
  treasury_10y: 'DGS10',    // 10년 국채금리
  fed_rate: 'FEDFUNDS',     // 기준금리
  cpi_yoy: 'CPIAUCSL',      // CPI
  usd_krw: 'DEXKOUS',       // 달러/원
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

  try {
    const [treasury10y, fedRate, cpi, usdKrw] = await Promise.allSettled([
      fetchFRED(SERIES.treasury_10y),
      fetchFRED(SERIES.fed_rate),
      fetchFRED(SERIES.cpi_yoy),
      fetchFRED(SERIES.usd_krw),
    ]);

    const macro = {
      treasury_10y: treasury10y.status === 'fulfilled' ? treasury10y.value : null,
      fed_rate: fedRate.status === 'fulfilled' ? fedRate.value : null,
      cpi: cpi.status === 'fulfilled' ? cpi.value : null,
      usd_krw: usdKrw.status === 'fulfilled' ? usdKrw.value : null,
      fetched: new Date().toISOString(),
    };

    // 계산 지표
    // S&P 500은 Yahoo Finance에서 별도 가져옴 ('^GSPC')
    res.status(200).json({ macro });
  } catch (e) {
    res.status(200).json({ macro: null, error: e.message });
  }
}
