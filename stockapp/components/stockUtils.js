import { STOCK_UNIVERSE, GURU_POSITIONS } from '../lib/data';
import { calcCompositeSignal, calcTenBaggerScore } from '../lib/calculations';

export function buildStocks(prices, treasury) {
  return Object.entries(STOCK_UNIVERSE).map(([sym, s]) => {
    const p = prices[sym];
    const cur = p?.price;
    const comp = cur ? calcCompositeSignal(s, cur, treasury) : { signal:'UNKNOWN', score:'0' };
    const ten = calcTenBaggerScore(s);
    const up = cur && s.fair_value ? (s.fair_value - cur)/cur*100 : null;
    return { sym, ...s, cur, chg:p?.change, high52:p?.high52, low52:p?.low52, mktCap:p?.mktCap, trailingPE:p?.trailingPE, psr:p?.psr, comp, ten, up };
  });
}

// 특정 심볼을 매수/보유 중인 구루 목록
export function guruHoldersOf(sym) {
  const out = [];
  for (const g of GURU_POSITIONS) {
    const pos = g.positions.find(p => p.sym === sym);
    if (pos && pos.action !== 'SOLD') out.push({ guru: g.name, tier: g.tier, ...pos });
  }
  return out;
}

// 섹터 기반 매크로 민감도 서술 (금리/달러/경기 민감 여부)
export function macroSensitivity(stock, macroValues) {
  const notes = [];
  const rateSensitive = stock.eps_ttm <= 0 || (stock.pe_hist_avg_5y && stock.pe_hist_avg_5y > 40) || stock.rule_of_40 > 60;
  if (rateSensitive) {
    notes.push(macroValues.fed_rate > 4
      ? '고금리 국면에서 밸류에이션 압박을 받기 쉬운 고성장/무이익형 종목입니다.'
      : '금리 환경이 우호적이면 상대적으로 유리한 고성장형 종목입니다.');
  }
  if (['소비자 기술','이커머스 플랫폼','이커머스·핀테크','온라인 여행','에너지드링크·소비재'].includes(stock.sector)) {
    notes.push(macroValues.ism_pmi < 50 ? 'PMI 수축 국면에서는 소비 경기 둔화 영향을 받을 수 있는 소비재/소비자 관련 섹터입니다.' : '경기 확장 국면에 우호적인 소비 관련 섹터입니다.');
  }
  if (stock.net_cash < 0 || (stock.geo && stock.geo.some(g=>g.name!=='미국'&&g.pct>30))) {
    notes.push(macroValues.dxy > 103 ? '해외 매출 비중이 있어 달러 강세 시 환차손 영향을 받을 수 있습니다.' : '달러 약세 국면에서는 해외 매출 환산에 유리합니다.');
  }
  if (notes.length === 0) notes.push('현재 매크로 지표와 특별히 강한 상관관계는 확인되지 않았습니다. 개별 펀더멘털 비중이 더 큽니다.');
  return notes;
}
