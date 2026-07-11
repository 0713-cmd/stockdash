import { useState, useEffect } from 'react';
import { MACRO_INIT, MACRO_META } from '../lib/data';
import { calcComprehensiveScore } from '../lib/calculations';
import { computeMacroValues, levelMatch, colOf } from './shared';
import { buildStocks } from './stockUtils';

// 홈 3개 컨셉이 공유하는 데이터 훅
export function useHomeData({ prices, macro }) {
  const m = { ...MACRO_INIT, ...macro };
  const treasury = m.treasury_10y || 4.42;
  const values = computeMacroValues(m);

  const [screen, setScreen] = useState(null);
  const [screenErr, setScreenErr] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/screen').then(r => r.json()).then(d => {
      if (!alive) return;
      if (d.error) setScreenErr(d.error);
      setScreen(d);
    }).catch(e => { if (alive) setScreenErr(e.message); });
    return () => { alive = false; };
  }, []);

  const stocks = buildStocks(prices, treasury);
  const myStocks = stocks
    .filter(s => s.type === 'portfolio' || s.type === 'watch' || s.type === 'locked')
    .map(s => {
      const comprehensive = calcComprehensiveScore(s, prices[s.sym]);
      const target = s.fair_value ?? null;
      let upside = s.cur && target ? +((target - s.cur) / s.cur * 100).toFixed(1) : null;
      if (upside != null && upside > 200) upside = null;
      return {
        symbol: s.sym, name: s.name, sector: s.sector, lite: false,
        price: s.cur, change: s.chg,
        target, targetSrc: target ? 'DCF' : null, upside,
        comprehensive, marsV: s.comp, tenBagger: s.ten,
        locked: s.type === 'locked',
      };
    })
    .sort((a, b) => b.comprehensive.score - a.comprehensive.score);

  // 매크로 신호등
  const macroKeys = ['fed_rate', 'shiller_cape', 'buffett_indicator', 'ism_pmi', 'cpi_yoy', 'dxy', 'fed_model'];
  const macroDots = macroKeys.map(k => {
    const meta = MACRO_META[k];
    const lvl = meta ? levelMatch(meta.levels, values[k]) : null;
    return { key: k, short: meta?.short || k, col: lvl ? colOf(lvl.color) : 'var(--dim)', label: lvl?.label };
  });
  const redCnt = macroDots.filter(d => d.col === 'var(--red)').length;

  return { m, screen, screenErr, myStocks, macroDots, redCnt };
}

// 랭킹 기준 선택지 (3개 컨셉 공통)
export const RANK_BASES = [
  { key: 'comp', label: '종합점수', sub: '5개 영역 100점 · 커버리지 70%+' },
  { key: 'mars', label: 'MARS-V 전략', sub: '18개 방법론 · 정밀 종목' },
  { key: 'ten', label: '텐베거', sub: '5년 10배 잠재력' },
  { key: 'my', label: '내 종목', sub: '보유·트래킹' },
];

export function rowsForBase(base, screen, myStocks) {
  if (base === 'my') return myStocks;
  if (!screen) return null;
  if (base === 'comp') return screen.top30Comprehensive;
  if (base === 'mars') return screen.top30MarsV;
  if (base === 'ten') return screen.top30TenBagger;
  return null;
}
