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
// 라이트 종목(재무 원본 없음)은 가격 기반 지표만으로 부분 채점하고
// 채점 가능했던 배점 대비 백분율로 환산(fabricate 하지 않음).
export function calcComprehensiveScore(stock, priceData) {
  const p = priceData || {};
  const breakdown = { value: 0, growth: 0, profitability: 0, health: 0, momentum: 0 };
  let maxPossible = 0;

  // ── 밸류에이션 30점 ──
  // PE (섹터 대비 근사: forward PE < trailing PE = 이익 성장 기대) 10점
  const pe = p.trailingPE ?? (p.price && stock.eps_ttm > 0 ? p.price / stock.eps_ttm : null);
  if (pe != null && pe > 0) {
    maxPossible += 10;
    if (pe < 15) breakdown.value += 10;
    else if (pe < 25) breakdown.value += 7;
    else if (pe < 40) breakdown.value += 4;
    else if (pe < 60) breakdown.value += 2;
  }
  // PEG 10점 (forward EPS 성장률 근사 사용)
  let peg = null;
  if (pe != null && p.epsForward && p.eps && p.eps > 0 && p.epsForward > p.eps) {
    const growthPct = (p.epsForward - p.eps) / p.eps * 100;
    if (growthPct > 1) peg = pe / growthPct;
  } else if (pe != null && stock.rev_growth_yoy > 1) {
    peg = pe / stock.rev_growth_yoy;
  }
  if (peg != null) {
    maxPossible += 10;
    if (peg < 1) breakdown.value += 10;
    else if (peg < 2) breakdown.value += 5;
  }
  // 애널리스트 목표가 대비 상승여력 10점 (EV/FCF 대체 — 라이트 종목도 계산 가능)
  const target = p.targetMean;
  if (target && p.price) {
    maxPossible += 10;
    const upsidePct = (target - p.price) / p.price * 100;
    if (upsidePct > 25) breakdown.value += 10;
    else if (upsidePct > 15) breakdown.value += 7;
    else if (upsidePct > 5) breakdown.value += 4;
    else if (upsidePct > 0) breakdown.value += 2;
  }

  // ── 성장 25점 ──
  if (stock.rev_growth_yoy != null) {
    maxPossible += 15;
    if (stock.rev_growth_yoy > 30) breakdown.growth += 15;
    else if (stock.rev_growth_yoy > 15) breakdown.growth += 10;
    else if (stock.rev_growth_yoy > 0) breakdown.growth += 5;
  }
  // EPS 성장 (forward vs trailing) 10점
  if (p.epsForward != null && p.eps != null && p.eps > 0) {
    maxPossible += 10;
    const epsG = (p.epsForward - p.eps) / p.eps * 100;
    if (epsG > 30) breakdown.growth += 10;
    else if (epsG > 15) breakdown.growth += 5;
    else if (epsG > 0) breakdown.growth += 2;
  }

  // ── 수익성 20점 ──
  if (stock.gross_margin != null) {
    maxPossible += 10;
    if (stock.gross_margin > 60) breakdown.profitability += 10;
    else if (stock.gross_margin > 40) breakdown.profitability += 5;
    else if (stock.gross_margin > 25) breakdown.profitability += 2;
  }
  if (stock.roic != null) {
    maxPossible += 10;
    if (stock.roic > 20) breakdown.profitability += 10;
    else if (stock.roic > 10) breakdown.profitability += 5;
  }

  // ── 건전성 15점 ──
  if (stock.piotroski != null) {
    maxPossible += 10;
    if (stock.piotroski >= 7) breakdown.health += 10;
    else if (stock.piotroski >= 4) breakdown.health += 5;
  }
  if (stock.altman_z != null) {
    maxPossible += 5;
    if (stock.altman_z > 2.99) breakdown.health += 5;
    else if (stock.altman_z > 1.81) breakdown.health += 2;
  }

  // ── 모멘텀 10점 ──
  // 50일/200일 이평선 대비 위치 (가격 데이터만으로 계산 가능)
  if (p.fiftyDayChgPct != null || p.twoHundredDayChgPct != null || stock.mom_12_1 != null) {
    maxPossible += 10;
    let momPts = 0;
    if (p.twoHundredDayChgPct != null) {
      if (p.twoHundredDayChgPct > 15) momPts = 10;
      else if (p.twoHundredDayChgPct > 5) momPts = 7;
      else if (p.twoHundredDayChgPct > 0) momPts = 4;
    } else if (stock.mom_12_1 != null) {
      if (stock.mom_12_1 > 30) momPts = 10;
      else if (stock.mom_12_1 > 15) momPts = 7;
      else if (stock.mom_12_1 > 0) momPts = 4;
    }
    breakdown.momentum += momPts;
  }

  const raw = breakdown.value + breakdown.growth + breakdown.profitability + breakdown.health + breakdown.momentum;
  // 채점된 배점 대비 백분율 환산 (커버리지 40점 미만이면 신뢰도 낮음 표시)
  const score = maxPossible > 0 ? Math.round(raw / maxPossible * 100) : 0;
  const coverage = maxPossible; // 채점 가능했던 총 배점 (최대 100)

  let grade;
  if (score >= 80) grade = 'A+';
  else if (score >= 70) grade = 'A';
  else if (score >= 60) grade = 'B+';
  else if (score >= 50) grade = 'B';
  else if (score >= 40) grade = 'C';
  else grade = 'D';

  return { score, grade, breakdown, coverage, lowConfidence: coverage < 40 };
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

  const top30Comprehensive = [...withScores]
    .filter(s => !s.comprehensive.lowConfidence || !s.lite)
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

  return { top30Comprehensive, top30MarsV, top30TenBagger, screened: withScores.length };
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
