// 유니버스 전체 종목의 재무 펀더멘털 수집 → lib/fundamentals_cache.json
// 실행: node scripts/build_fundamentals.mjs
// 출처: Yahoo quoteSummary (financialData + defaultKeyStatistics) — 공시 기반
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// universe.js에서 심볼 추출 (ESM 파싱 대신 정규식 — 의존성 없이)
const uniSrc = readFileSync(join(__dirname, '../lib/universe.js'), 'utf8');
const symbols = [...new Set([...uniSrc.matchAll(/\['([A-Z.\-]+)','/g)].map(m => m[1]))];
console.log(`universe symbols: ${symbols.length}`);

let cookie = null, crumb = null;
async function auth() {
  const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' });
  cookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } });
  crumb = (await r2.text()).trim();
  console.log('crumb:', crumb);
}

const pct = v => v?.raw != null ? +(v.raw * 100).toFixed(2) : null;
const raw = v => v?.raw != null ? +(+v.raw).toFixed(2) : null;

async function fetchOne(sym) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,defaultKeyStatistics&crumb=${encodeURIComponent(crumb)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const fd = j?.quoteSummary?.result?.[0]?.financialData || {};
  const ks = j?.quoteSummary?.result?.[0]?.defaultKeyStatistics || {};
  return {
    rev_growth_yoy: pct(fd.revenueGrowth),
    eps_growth_yoy: pct(fd.earningsGrowth),
    gross_margin: pct(fd.grossMargins),
    op_margin: pct(fd.operatingMargins),
    roa: pct(fd.returnOnAssets),
    roe: pct(fd.returnOnEquity),
    current_ratio: raw(fd.currentRatio),
    debt_to_equity: raw(fd.debtToEquity),
    target_mean: raw(fd.targetMeanPrice),
    target_high: raw(fd.targetHighPrice),
    target_low: raw(fd.targetLowPrice),
    num_analysts: fd.numberOfAnalystOpinions?.raw ?? null,
    recommendation: fd.recommendationKey ?? null,
    peg_yahoo: raw(ks.pegRatio),
    forward_pe: raw(ks.forwardPE),
    beta: raw(ks.beta),
  };
}

await auth();
const out = {};
let ok = 0, fail = 0;
for (let i = 0; i < symbols.length; i += 8) {
  const batch = symbols.slice(i, i + 8);
  await Promise.all(batch.map(async sym => {
    try {
      out[sym] = { ...(await fetchOne(sym)), fetched: new Date().toISOString().slice(0, 10) };
      ok++;
    } catch (e) { fail++; console.log(`  fail ${sym}: ${e.message}`); }
  }));
  process.stdout.write(`\r${Math.min(i + 8, symbols.length)}/${symbols.length} (ok ${ok}, fail ${fail})`);
  await new Promise(r => setTimeout(r, 300));
}
console.log();

writeFileSync(join(__dirname, '../lib/fundamentals_cache.json'), JSON.stringify(out, null, 1));
console.log(`saved lib/fundamentals_cache.json — ${ok} ok, ${fail} fail`);

// 커버리지 리포트
const withGrowth = Object.values(out).filter(v => v.rev_growth_yoy != null).length;
const withMargin = Object.values(out).filter(v => v.gross_margin != null).length;
const withTarget = Object.values(out).filter(v => v.target_mean != null).length;
console.log(`coverage: rev_growth ${withGrowth}, gross_margin ${withMargin}, target ${withTarget}`);
