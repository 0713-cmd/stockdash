// ═══════════════════════════════════════════════════
// 투자 계산 엔진 — lib/calculations.js
// 18개 방법론 기반 종합 신호 생성
// ═══════════════════════════════════════════════════
import { METHOD_WEIGHTS } from './data';

// ── 1. 역산 DCF — Mauboussin PIE 갭 ──────────────
export function calcReverseDCF(stock, currentPrice) {
  const { roic, wacc, revenue_ttm, eps_ttm, fair_value } = stock;
  if (!currentPrice || !fair_value) return { score: 0, label: '데이터 없음' };

  const gap = (fair_value - currentPrice) / currentPrice * 100;

  // 데이터 정합성 가드: 갭이 +200% 초과면 액면분할 미반영 등
  // fair_value 기준 오류 가능성이 높으므로 신호에서 제외한다.
  if (gap > 200) {
    return { score: 0, gap: gap.toFixed(1), fair_value, label: '⚠️ 기준가 검증 필요(액면분할 의심)', suspect: true };
  }

  let score = 0;
  if (gap > 20) score = 2;
  else if (gap > 10) score = 1.5;
  else if (gap > 0) score = 0.5;
  else if (gap > -10) score = -0.5;
  else score = -2;

  // ROIC-WACC 스프레드 보정
  if (roic && wacc) {
    const spread = roic - wacc;
    if (spread > 15) score *= 1.2;
    else if (spread < 0) score *= 0.5;
  }
  score = Math.max(-2, Math.min(2, score));
  return { score, gap: gap.toFixed(1), fair_value, label: gap > 10 ? '저평가' : gap < -10 ? '고평가' : '적정' };
}

// ── 2. EV/EBITDA 상대 평가 ───────────────────────
export function calcEVEBITDA(stock, currentPrice) {
  // 섹터별 기준 배수 (보수적)
  const sectorBenchmarks = {
    'AI 반도체': 40, 'AI·클라우드': 32, '클라우드·AI': 32,
    '소비자 기술': 25, '클라우드·DB': 28, '클라우드·이커머스': 22,
    '헬스케어·진단': 35, '크립토 인프라': 18,
    'AI인프라(전력·냉각)': 28, 'AI클라우드·BTC채굴': 20,
    'EV·로보틱스': 30, 'HBM 메모리': 15,
  };
  const benchmark = sectorBenchmarks[stock.sector] || 25;
  const pe = currentPrice && stock.eps_ttm > 0 ? currentPrice / stock.eps_ttm : null;
  if (!pe) return { score: 0, label: '계산 불가' };

  const ratio = pe / benchmark;
  let score = 0;
  if (ratio < 0.7) score = 2;
  else if (ratio < 0.85) score = 1;
  else if (ratio < 1.0) score = 0.5;
  else if (ratio < 1.2) score = -0.5;
  else score = -1.5;
  return { score: Math.max(-2, Math.min(2, score)), pe: pe.toFixed(1), benchmark, ratio: ratio.toFixed(2) };
}

// ── 3. FCF Yield vs 국채 ─────────────────────────
export function calcFCFYield(stock, currentPrice, treasury10y = 4.42) {
  const { fcf_annual, shares_out, sbc_annual } = stock;
  if (!currentPrice || !fcf_annual || !shares_out) return { score: 0 };

  // SBC 조정 FCF
  const adj_fcf = fcf_annual - (sbc_annual || 0);
  const mktCap = currentPrice * shares_out;
  const fcf_yield = (adj_fcf / mktCap * 100);
  const premium = fcf_yield - treasury10y;

  let score = 0;
  if (premium > 3) score = 2;
  else if (premium > 1) score = 1;
  else if (premium > 0) score = 0.5;
  else if (premium > -2) score = -0.5;
  else score = -1.5;

  return { score: Math.max(-2, Math.min(2, score)), fcf_yield: fcf_yield.toFixed(2), premium: premium.toFixed(2), adj_fcf };
}

// ── 4. Piotroski F-Score 해석 ────────────────────
export function calcPiotroski(score) {
  if (score === null || score === undefined) return { score: 0, label: '데이터 없음' };
  let s = 0;
  if (score >= 8) s = 2;
  else if (score >= 6) s = 1;
  else if (score >= 4) s = 0;
  else if (score >= 2) s = -1;
  else s = -2;
  return { score: s, raw: score, label: score >= 7 ? '우수' : score >= 4 ? '보통' : '주의' };
}

// ── 5. Beneish M-Score — 게이트키퍼 ─────────────
export function calcBeneish(m) {
  if (m === null || m === undefined) return { score: 0, pass: true, label: '계산 불가' };
  if (m > -1.78) return { score: -2, pass: false, label: '조작 의심 ⛔', raw: m };
  let s = 0;
  if (m < -2.5) s = 1;
  else if (m < -2.0) s = 0.5;
  else s = 0;
  return { score: s, pass: true, label: '안전', raw: m };
}

// ── 6. ROIC-WACC 스프레드 ─────────────────────────
export function calcROICWACC(roic, wacc) {
  if (!roic || !wacc) return { score: 0, label: '데이터 없음' };
  const spread = roic - wacc;
  let score = 0;
  if (spread > 20) score = 2;
  else if (spread > 10) score = 1.5;
  else if (spread > 5) score = 0.5;
  else if (spread > 0) score = 0;
  else score = -1.5;
  return { score, spread: spread.toFixed(1), label: spread > 15 ? '우수' : spread > 5 ? '양호' : spread > 0 ? '보통' : '위험' };
}

// ── 7. 가격 모멘텀 (12-1M) ───────────────────────
export function calcMomentum(mom_12_1) {
  if (mom_12_1 === null || mom_12_1 === undefined) return { score: 0 };
  let score = 0;
  if (mom_12_1 > 30) score = 2;
  else if (mom_12_1 > 15) score = 1.5;
  else if (mom_12_1 > 5) score = 0.5;
  else if (mom_12_1 > -5) score = 0;
  else if (mom_12_1 > -15) score = -1;
  else score = -2;
  return { score, raw: mom_12_1, label: mom_12_1 > 15 ? '강함' : mom_12_1 > 0 ? '중립' : '약함' };
}

// ── 8. 어닝 리비전 모멘텀 ───────────────────────
export function calcEarningsRevision(erv) {
  if (erv === null || erv === undefined) return { score: 0 };
  let score = 0;
  if (erv > 0.4) score = 2;
  else if (erv > 0.2) score = 1;
  else if (erv > 0) score = 0.5;
  else if (erv > -0.2) score = -0.5;
  else score = -1.5;
  return { score, raw: erv, label: erv > 0.2 ? '상향 중' : erv > 0 ? '중립' : '하향 중' };
}

// ── 9. 구루 13F 신호 ─────────────────────────────
export function calcGuruSignal(stock, currentPrice) {
  const { guru_cost, guru_note } = stock;
  if (!guru_cost || !currentPrice) return { score: 0, label: '정보 없음' };
  const diff = (guru_cost - currentPrice) / guru_cost * 100;
  let score = 0;
  if (diff > 15) score = 2; // 구루보다 훨씬 저렴
  else if (diff > 5) score = 1.5;
  else if (diff > 0) score = 0.5;
  else if (diff > -10) score = 0;
  else score = -0.5; // 구루보다 10%+ 비쌈
  return { score, diff: diff.toFixed(1), cheaper: diff > 0 };
}

// ── 10. 종합 신호 (가중 합의) ────────────────────
export function calcCompositeSignal(stock, currentPrice, treasury10y = 4.42) {
  if (!currentPrice) return { signal: 'UNKNOWN', score: 0 };

  // Beneish 먼저 (게이트키퍼)
  const beneish = calcBeneish(stock.beneish_m);
  if (!beneish.pass) {
    return { signal: 'DANGER', score: -2, reason: '실적 조작 의심', beneish };
  }

  // Altman Z-Score 체크
  if (stock.altman_z !== null && stock.altman_z < 1.81) {
    return { signal: 'DANGER', score: -2, reason: '파산 위험 구간', altman_z: stock.altman_z };
  }

  const methods = {
    reverse_dcf: calcReverseDCF(stock, currentPrice),
    ev_ebitda: calcEVEBITDA(stock, currentPrice),
    fcf_yield: calcFCFYield(stock, currentPrice, treasury10y),
    piotroski: calcPiotroski(stock.piotroski),
    beneish: beneish,
    roic_wacc: calcROICWACC(stock.roic, stock.wacc),
    momentum: calcMomentum(stock.mom_12_1),
    erv: calcEarningsRevision(stock.erv_score),
    guru_13f: calcGuruSignal(stock, currentPrice),
  };

  // 가중 합계
  let weighted_sum = 0;
  let total_weight = 0;
  for (const [key, method] of Object.entries(methods)) {
    const w = METHOD_WEIGHTS[key] || 0;
    weighted_sum += method.score * w;
    total_weight += w;
  }
  const composite = total_weight > 0 ? weighted_sum / total_weight : 0;

  let signal, label;
  if (composite >= 1.0) { signal = 'BUY'; label = '지금 매수'; }
  else if (composite >= 0.3) { signal = 'HOLD'; label = '보유 유지'; }
  else if (composite >= -0.3) { signal = 'NEUTRAL'; label = '대기'; }
  else { signal = 'WAIT'; label = '진입 보류'; }

  return { signal, label, score: composite.toFixed(3), methods };
}

// ── PE 역사 백분위 계산 ──────────────────────────
export function calcPEPercentile(currentPE, histAvg, histMin, histMax) {
  if (!currentPE || !histMin || !histMax) return null;
  const pct = (currentPE - histMin) / (histMax - histMin) * 100;
  return Math.max(0, Math.min(100, pct)).toFixed(0);
}

// ── 포지션 사이징 (하프켈리) ────────────────────
export function calcPositionSize(signal_score, upside_pct, max_loss_pct = 25) {
  if (signal_score <= 0) return 0;
  // 풀켈리: f = (기대수익 - 무위험) / 분산 근사
  const kelly = Math.max(0, upside_pct / max_loss_pct);
  const half_kelly = kelly / 2;
  // 최대 15% 제한
  return Math.min(15, Math.round(half_kelly * 100) / 100).toFixed(1);
}

// ── 텐베거 스코어 ────────────────────────────────
export function calcTenBaggerScore(stock) {
  let score = 0;
  const { rule_of_40, rev_growth_yoy, rev_growth_accel, gross_margin, gm_trend, tam_penetration, piotroski } = stock;

  // Rule of 40 (최대 30점)
  const r40 = rule_of_40 || (gross_margin + rev_growth_yoy - 100);
  if (r40 > 60) score += 30;
  else if (r40 > 40) score += 22;
  else if (r40 > 20) score += 12;
  else if (r40 > 0) score += 5;

  // 매출 성장 가속도 (최대 25점)
  if (rev_growth_accel > 5) score += 25;
  else if (rev_growth_accel > 2) score += 18;
  else if (rev_growth_accel > 0) score += 10;
  else if (rev_growth_accel > -5) score += 3;

  // TAM 침투율 (최대 20점)
  if (tam_penetration !== undefined) {
    if (tam_penetration < 3) score += 20;
    else if (tam_penetration < 8) score += 14;
    else if (tam_penetration < 15) score += 7;
  } else {
    score += 8; // 데이터 없으면 중립
  }

  // GM 트렌드 (최대 15점)
  if (gm_trend > 3) score += 15;
  else if (gm_trend > 1) score += 10;
  else if (gm_trend > 0) score += 5;

  // 품질 (Piotroski, 최대 10점)
  if (piotroski >= 8) score += 10;
  else if (piotroski >= 6) score += 6;
  else if (piotroski >= 4) score += 3;

  return Math.min(100, Math.round(score));
}

// ── 포트폴리오 수익률 계산 ───────────────────────
export function calcPortfolioStats(trades, currentPrices) {
  if (!trades || trades.length === 0) return null;

  let totalCost = 0, totalValue = 0;
  const holdings = {};

  for (const t of trades) {
    if (t.action === '매수') {
      if (!holdings[t.sym]) holdings[t.sym] = { qty: 0, cost: 0 };
      holdings[t.sym].qty += t.qty;
      holdings[t.sym].cost += t.price * t.qty;
    } else if (t.action === '매도') {
      if (holdings[t.sym]) {
        holdings[t.sym].qty -= t.qty;
      }
    }
  }

  const positions = [];
  for (const [sym, h] of Object.entries(holdings)) {
    if (h.qty <= 0) continue;
    const avgCost = h.cost / h.qty; // 이 계산은 단순화됨
    const currentPrice = currentPrices[sym]?.price;
    const currentValue = currentPrice ? currentPrice * h.qty : null;
    const pnl_pct = currentPrice ? (currentPrice - avgCost) / avgCost * 100 : null;

    totalCost += h.cost;
    if (currentValue) totalValue += currentValue;

    positions.push({ sym, qty: h.qty, avg_cost: avgCost, current_price: currentPrice, current_value: currentValue, pnl_pct });
  }

  const total_return = totalCost > 0 ? (totalValue - totalCost) / totalCost * 100 : 0;
  return { positions, total_cost: totalCost, total_value: totalValue, total_return };
}

// ── 재무 추이 재구성 (분기 8개 + 연간 5개) ───────
// 주의: 실제 공시 수치가 아니라 revenue_ttm/gross_margin/rev_growth_yoy 등
// 현재 스냅샷 값으로부터 역산 재구성한 "추정 추이"입니다. 절대값보다 방향성(추세) 참고용.
export function genFinancialHistory(stock) {
  const { revenue_ttm, gross_margin, rev_growth_yoy, rev_growth_accel, fcf_annual, sbc_annual } = stock;
  if (!revenue_ttm) return null;

  const baseQRev = revenue_ttm / 4;
  const qGrowth = (rev_growth_yoy || 8) / 100;      // 최근 YoY 성장률
  const accel = (rev_growth_accel || 0) / 100 / 4;   // 분기당 가속도(완만 적용)
  const baseGM = gross_margin || 45;
  const gmTrendQ = (stock.gm_trend || 0) / 4;

  // 8개 분기(최근이 마지막) 역산: 최근 분기가 baseQRev, 과거로 갈수록 YoY 성장률 역산
  const quarters = [];
  for (let i = 7; i >= 0; i--) {
    const yearsBack = i / 4;
    const growthDecay = qGrowth - accel * i; // 과거로 갈수록 성장률이 accel만큼 낮았다고 가정
    const rev = baseQRev / Math.pow(1 + Math.max(growthDecay, -0.3), yearsBack);
    const gm = Math.max(5, baseGM - gmTrendQ * i);
    const opMargin = Math.max(-20, gm - 28); // 대략적인 영업비용률 가정(설명용 근사)
    quarters.push({
      label: `Q${4 - (i % 4)}`,
      idx: 7 - i,
      revenue: rev,
      grossMargin: gm,
      opMargin,
    });
  }

  // 연간 5개년 (최근 FY가 revenue_ttm 근사)
  const annualGrowth = qGrowth;
  const annual = [];
  for (let y = 4; y >= 0; y--) {
    const rev = revenue_ttm / Math.pow(1 + Math.max(annualGrowth - (rev_growth_accel || 0) / 100 * y * 0.3, -0.25), y);
    const fcf = (fcf_annual || rev * 0.12) / Math.pow(1 + Math.max(annualGrowth - 0.03, -0.2), y);
    const ocf = fcf + (sbc_annual || rev * 0.03) * (1 - y * 0.05);
    annual.push({
      label: `FY${new Date().getFullYear() - y - 1}`,
      revenue: rev,
      fcf,
      ocf,
    });
  }

  return { quarters, annual, estimated: true };
}

// ── 종합점수 (인베스팅닷컴 건전성 점수 철학) ─────
// 밸류에이션 30 + 성장 25 + 수익성 20 + 건전성 15 + 모멘텀 10 = 100
// 항목별 채점 근거(items)를 함께 반환 — 현재값/기준/획득점수 전부 공개.
// 데이터 없는 항목은 채점에서 제외하고 채점 가능 배점 대비 %로 환산(조작 없음).
export const COMPREHENSIVE_CATEGORIES = [
  { key: 'value', label: '밸류에이션', max: 30, desc: '지금 가격이 이익·성장 대비 싼가' },
  { key: 'growth', label: '성장', max: 25, desc: '매출·이익이 얼마나 빠르게 크는가' },
  { key: 'profitability', label: '수익성', max: 20, desc: '마진과 자본효율이 좋은가' },
  { key: 'health', label: '건전성', max: 15, desc: '재무구조가 튼튼한가' },
  { key: 'momentum', label: '모멘텀', max: 10, desc: '주가 추세가 살아있는가' },
];

// 섹터별 PE 벤치마크 (성장주 이중페널티 제거 — 섹터 상대 채점)
const SECTOR_PE_BENCH = {
  // 한글 (자체 큐레이션 세분류)
  '기술': 32, 'AI 반도체': 34, 'AI·클라우드': 32, '클라우드·AI': 32, 'AI 소프트웨어': 34,
  '사이버보안 AI': 34, 'AI 서버 인프라': 28, 'AI인프라(전력·냉각)': 30, 'AI 인프라(전력·냉각)': 30,
  'AI 광고·모바일': 30, 'AI클라우드·BTC채굴': 25,
  'AI 네트워크 인프라': 32, '클라우드 DB': 32, '클라우드 모니터링': 32, '클라우드·이커머스': 28,
  '클라우드·DB': 32, 'HBM 메모리': 20, '소비자 기술': 28, 'EV·로보틱스': 40,
  '커뮤니케이션': 25, '스트리밍·미디어': 30, '소비순환재': 24, '이커머스 플랫폼': 30,
  '이커머스·핀테크': 30, '온라인 여행': 22, '필수소비재': 22, '에너지드링크·소비재': 25,
  '헬스케어': 20, '헬스케어·진단': 30, '금융': 15, '크립토 인프라': 25,
  '에너지': 14, '소재': 18, '산업재': 22, '유틸리티': 18,
  // 영문 (Yahoo 원본 섹터명)
  'Technology': 32, 'Communication Services': 25, 'Consumer Cyclical': 24,
  'Consumer Defensive': 22, 'Healthcare': 20, 'Financial Services': 15,
  'Industrials': 22, 'Energy': 14, 'Basic Materials': 18, 'Utilities': 18, 'Real Estate': 16,
};
const peBench = sector => SECTOR_PE_BENCH[sector] ?? 24;

export function calcComprehensiveScore(stock, priceData) {
  const p = priceData || {};
  const breakdown = { value: 0, growth: 0, profitability: 0, health: 0, momentum: 0 };
  const items = [];

  const add = (cat, label, curDisp, stdDisp, pts, max) => {
    breakdown[cat] += pts;
    items.push({ cat, label, cur: curDisp, std: stdDisp, pts, max });
  };
  const skip = (cat, label, reason) => items.push({ cat, label, cur: reason || '데이터 없음', std: '—', pts: null, max: null });

  // ── 이상치 가드 (STEP3) ──
  // epsForward가 trailing EPS의 5배 초과면 분기/연간 혼동 이상치로 간주
  let epsForward = p.epsForward;
  const epsAnomalous = epsForward != null && p.eps != null && p.eps > 0 && epsForward > p.eps * 5;
  if (epsAnomalous) epsForward = null;

  // ── 밸류에이션 30점 ──
  // PER: 섹터 벤치마크 상대 채점 (STEP4 — 절대기준 이중페널티 제거)
  const peRaw = p.trailingPE ?? (p.price && stock.eps_ttm > 0 ? p.price / stock.eps_ttm : null);
  // 큐레이션 종목은 자체 세분류(예: AI 반도체 34x)가 Yahoo 대분류보다 정확 → 우선 적용
  const bench = peBench(stock.lite ? (p.sector || stock.sector) : (stock.sector || p.sector));
  if (peRaw != null && peRaw > 0 && peRaw <= 200) {
    const r = peRaw / bench;
    const pts = r < 0.6 ? 10 : r < 0.85 ? 7 : r < 1.1 ? 4 : r < 1.5 ? 2 : 0;
    add('value', 'PER(섹터 상대)', `${peRaw.toFixed(1)}x / 섹터기준 ${bench}x`, '섹터기준의 60%↓ 10점 · 85%↓ 7점 · 110%↓ 4점 · 150%↓ 2점', pts, 10);
  } else if (peRaw != null && peRaw > 200) skip('value', 'PER(섹터 상대)', `N/A(이상치 ${peRaw.toFixed(0)}x)`);
  else if (peRaw != null && peRaw <= 0) skip('value', 'PER(섹터 상대)', 'N/A(적자기업)');
  else skip('value', 'PER(섹터 상대)');

  // PEG: 자체 계산 → Yahoo pegRatio 폴백
  let peg = null, pegSrc = '';
  if (peRaw != null && peRaw > 0 && peRaw <= 200) {
    if (epsForward && p.eps > 0 && epsForward > p.eps) {
      const g = (epsForward - p.eps) / p.eps * 100;
      if (g > 1) { peg = peRaw / g; pegSrc = 'EPS성장 기준'; }
    }
    if (peg == null && stock.eps_growth_yoy > 1) { peg = peRaw / stock.eps_growth_yoy; pegSrc = 'EPS성장(TTM) 기준'; }
    if (peg == null && stock.rev_growth_yoy > 1) { peg = peRaw / stock.rev_growth_yoy; pegSrc = '매출성장 기준'; }
  }
  if (peg == null && stock.peg_yahoo != null && stock.peg_yahoo > 0) { peg = stock.peg_yahoo; pegSrc = 'Yahoo 공식'; }
  if (peg != null && peg > 0 && peg < 20) {
    const pts = peg < 1 ? 10 : peg < 2 ? 5 : 0;
    add('value', `PEG(${pegSrc})`, peg.toFixed(2), '1.0↓ 10점 · 2.0↓ 5점 (낮을수록 성장 대비 저렴)', pts, 10);
  } else skip('value', 'PEG', epsAnomalous ? 'N/A(데이터 이상 감지)' : undefined);

  // 애널리스트 목표가: prices → 재무캐시 폴백
  const target = p.targetMean ?? stock.target_mean;
  if (target && p.price) {
    const up = (target - p.price) / p.price * 100;
    const pts = up > 25 ? 10 : up > 15 ? 7 : up > 5 ? 4 : up > 0 ? 2 : 0;
    const na = p.numAnalysts ?? stock.num_analysts;
    add('value', '애널리스트 목표가 괴리', `${up > 0 ? '+' : ''}${up.toFixed(1)}% (${na ?? '?'}명 평균 $${target})`, '+25%↑ 10점 · +15%↑ 7점 · +5%↑ 4점', pts, 10);
  } else skip('value', '애널리스트 목표가 괴리');

  // ── 성장 25점 ──
  if (stock.rev_growth_yoy != null) {
    const g = stock.rev_growth_yoy;
    const pts = g > 30 ? 15 : g > 15 ? 10 : g > 0 ? 5 : 0;
    add('growth', '매출성장(YoY)', `${g > 0 ? '+' : ''}${g.toFixed(1)}%`, '+30%↑ 15점 · +15%↑ 10점 · +0%↑ 5점', pts, 15);
  } else skip('growth', '매출성장(YoY)');

  let epsG = null, epsGSrc = '선행 추정';
  if (epsForward != null && p.eps != null && p.eps > 0) epsG = (epsForward - p.eps) / p.eps * 100;
  else if (stock.eps_growth_yoy != null) { epsG = stock.eps_growth_yoy; epsGSrc = 'TTM 공시'; }
  if (epsG != null) {
    const pts = epsG > 30 ? 10 : epsG > 15 ? 5 : epsG > 0 ? 2 : 0;
    add('growth', `EPS성장(${epsGSrc})`, `${epsG > 0 ? '+' : ''}${epsG.toFixed(1)}%`, '+30%↑ 10점 · +15%↑ 5점 · +0%↑ 2점', pts, 10);
  } else skip('growth', 'EPS성장', epsAnomalous ? 'N/A(데이터 이상 감지)' : undefined);

  // ── 수익성 20점 ──
  if (stock.gross_margin != null) {
    const g = stock.gross_margin;
    const pts = g > 60 ? 10 : g > 40 ? 5 : g > 25 ? 2 : 0;
    add('profitability', '매출총이익률', `${g.toFixed(1)}%`, '60%↑ 10점 · 40%↑ 5점 · 25%↑ 2점', pts, 10);
  } else skip('profitability', '매출총이익률');

  if (stock.roic != null) {
    const pts = stock.roic > 20 ? 10 : stock.roic > 10 ? 5 : 0;
    add('profitability', 'ROIC(투하자본이익률)', `${stock.roic.toFixed(1)}%`, '20%↑ 10점 · 10%↑ 5점', pts, 10);
  } else if (stock.roa != null) {
    // ROIC 미보유 종목은 ROA(총자산이익률)로 근사 — 기준 완화 적용
    const pts = stock.roa > 15 ? 10 : stock.roa > 7 ? 5 : 0;
    add('profitability', '자본효율(ROA 근사)', `${stock.roa.toFixed(1)}%`, '15%↑ 10점 · 7%↑ 5점 (ROIC 대용)', pts, 10);
  } else skip('profitability', 'ROIC/ROA');

  // ── 건전성 15점 ──
  if (stock.piotroski != null) {
    const pts = stock.piotroski >= 7 ? 10 : stock.piotroski >= 4 ? 5 : 0;
    add('health', 'Piotroski F-Score', `${stock.piotroski}/9`, '7점↑ 10점 · 4점↑ 5점', pts, 10);
  } else if (stock.debt_to_equity != null) {
    // Piotroski 미산정 종목은 부채비율로 대체 채점
    const d = stock.debt_to_equity;
    const pts = d < 50 ? 10 : d < 100 ? 6 : d < 200 ? 3 : 0;
    add('health', '부채비율(D/E, 대체지표)', `${d.toFixed(0)}%`, '50%↓ 10점 · 100%↓ 6점 · 200%↓ 3점', pts, 10);
  } else skip('health', 'Piotroski F / 부채비율');

  if (stock.altman_z != null) {
    const pts = stock.altman_z > 2.99 ? 5 : stock.altman_z > 1.81 ? 2 : 0;
    add('health', 'Altman Z(부도위험)', `${stock.altman_z}`, '2.99↑ 5점(안전) · 1.81↑ 2점(회색)', pts, 5);
  } else if (stock.current_ratio != null) {
    const c = stock.current_ratio;
    const pts = c > 1.5 ? 5 : c > 1.0 ? 2 : 0;
    add('health', '유동비율(대체지표)', `${c.toFixed(2)}`, '1.5↑ 5점 · 1.0↑ 2점', pts, 5);
  } else skip('health', 'Altman Z / 유동비율');

  // ── 모멘텀 10점 ──
  if (p.twoHundredDayChgPct != null) {
    const g = p.twoHundredDayChgPct;
    const pts = g > 15 ? 10 : g > 5 ? 7 : g > 0 ? 4 : 0;
    add('momentum', '200일 이평선 대비', `${g > 0 ? '+' : ''}${g.toFixed(1)}%`, '+15%↑ 10점 · +5%↑ 7점 · +0%↑ 4점', pts, 10);
  } else if (stock.mom_12_1 != null) {
    const g = stock.mom_12_1;
    const pts = g > 30 ? 10 : g > 15 ? 7 : g > 0 ? 4 : 0;
    add('momentum', '가격모멘텀(12-1M)', `${g > 0 ? '+' : ''}${g.toFixed(1)}%`, '+30%↑ 10점 · +15%↑ 7점 · +0%↑ 4점', pts, 10);
  } else skip('momentum', '모멘텀');

  // ── STEP1: 측정 항목만으로 정규화 + 커버리지 페널티 ──
  const measured = items.filter(i => i.pts !== null);
  const earnedPoints = measured.reduce((s, i) => s + i.pts, 0);
  const possiblePoints = measured.reduce((s, i) => s + i.max, 0);

  let normalizedScore = possiblePoints > 0 ? (earnedPoints / possiblePoints) * 100 : 0;
  const coverage = possiblePoints / 100; // 전항목 만점 합 = 100

  // 데이터 부족 페널티: 신뢰도 낮은 점수가 완비 종목 위에 오지 못하게
  if (coverage < 0.5) normalizedScore *= 0.70;
  else if (coverage < 0.7) normalizedScore *= 0.85;

  const score = Math.round(normalizedScore);
  let grade;
  if (score >= 80) grade = 'A+';
  else if (score >= 70) grade = 'A';
  else if (score >= 60) grade = 'B+';
  else if (score >= 50) grade = 'B';
  else if (score >= 40) grade = 'C';
  else grade = 'D';

  // lite 종목 등급 상한: 커버리지 90% 이상이면 데이터가 충분하므로 A 허용,
  // 미만이면 B+ 상한 (데이터 부족 종목이 최상위권 차지 방지)
  if (stock.lite && grade.startsWith('A') && coverage < 0.9) grade = 'B+';

  return {
    score, grade, breakdown,
    coverage: Math.round(coverage * 100),
    lowConfidence: coverage < 0.5,
    items, raw: earnedPoints,
  };
}

// ── 주간 스크리닝 (3대 체계 동시 실행) ──────────
export function screenUniverse(stocksWithPrices, treasury10y = 4.42) {
  const withScores = stocksWithPrices
    .filter(s => s.priceData?.price)
    .map(s => ({
      symbol: s.symbol,
      name: s.priceData?.name || s.name || s.symbol,
      sector: s.priceData?.sector || s.sector,
      lite: s.lite,
      price: s.priceData.price,
      change: s.priceData.change,
      targetMean: s.priceData.targetMean,
      recommendation: s.priceData.recommendation,
      comprehensive: calcComprehensiveScore(s, s.priceData),
      marsV: calcCompositeSignal(s, s.priceData.price, treasury10y),
      tenBagger: s.rev_growth_yoy != null ? calcTenBaggerScore(s) : null,
      ruleOf40: s.rule_of_40 ?? (s.gross_margin != null && s.rev_growth_yoy != null ? Math.round(s.gross_margin + s.rev_growth_yoy - 100) : null),
      revGrowth: s.rev_growth_yoy,
    }));

  // 신뢰도 확보(커버리지 70%+) 종목만 메인 랭킹, 미달은 별도 목록
  const top30Comprehensive = [...withScores]
    .filter(s => s.comprehensive.coverage >= 70)
    .sort((a, b) => b.comprehensive.score - a.comprehensive.score)
    .slice(0, 30);

  const lowCoverage = [...withScores]
    .filter(s => s.comprehensive.coverage < 70)
    .sort((a, b) => b.comprehensive.score - a.comprehensive.score)
    .slice(0, 30);

  const top30MarsV = [...withScores]
    .filter(s => s.marsV.signal !== 'DANGER' && s.marsV.signal !== 'UNKNOWN' && !s.lite)
    .sort((a, b) => parseFloat(b.marsV.score) - parseFloat(a.marsV.score))
    .slice(0, 30);

  const top30TenBagger = [...withScores]
    .filter(s => s.tenBagger != null)
    .sort((a, b) => b.tenBagger - a.tenBagger)
    .slice(0, 30);

  return { top30Comprehensive, lowCoverage, top30MarsV, top30TenBagger, screened: withScores.length };
}

// ── 손절·익절 경보 ──────────────────────────────
export function checkAlerts(stock, currentPrice, avgCost) {
  const alerts = [];
  if (!currentPrice || !avgCost) return alerts;

  const drawdown = (currentPrice - avgCost) / avgCost * 100;

  if (drawdown <= -20) {
    alerts.push({ type: 'STOP_LOSS', msg: `손절 기준 -20% 도달 (현재 ${drawdown.toFixed(1)}%)`, color: 'red' });
  } else if (drawdown <= -15) {
    alerts.push({ type: 'WARNING', msg: `손절 기준 접근 (현재 ${drawdown.toFixed(1)}%)`, color: 'orange' });
  }

  if (stock.fair_value && currentPrice > stock.fair_value * 1.25) {
    alerts.push({ type: 'TAKE_PROFIT', msg: `적정가 25% 초과. 익절 검토 구간.`, color: 'gold' });
  }

  if (stock.beneish_m > -1.78) {
    alerts.push({ type: 'DANGER', msg: `Beneish M 경보: 실적 조작 의심`, color: 'red' });
  }

  return alerts;
}
