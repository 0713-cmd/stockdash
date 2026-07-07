// ═══════════════════════════════════════════════════
// 스크리닝 유니버스 — lib/universe.js
// 인베스팅닷컴 스타일 대량 스크리닝 대상 종목 리스트
// ═══════════════════════════════════════════════════

const MEGA = [
  ['AAPL','기술'],['MSFT','기술'],['GOOGL','기술'],['GOOG','기술'],['AMZN','소비순환재'],
  ['NVDA','기술'],['META','기술'],['TSLA','소비순환재'],['BRK-B','금융'],['AVGO','기술'],
  ['JPM','금융'],['LLY','헬스케어'],['V','금융'],['UNH','헬스케어'],['XOM','에너지'],
  ['MA','금융'],['COST','필수소비재'],['HD','소비순환재'],['PG','필수소비재'],['JNJ','헬스케어'],
  ['ORCL','기술'],['ABBV','헬스케어'],['BAC','금융'],['CRM','기술'],['NFLX','커뮤니케이션'],
  ['KO','필수소비재'],['MRK','헬스케어'],['AMD','기술'],['PEP','필수소비재'],['TMO','헬스케어'],
  ['WMT','필수소비재'],['ADBE','기술'],['CSCO','기술'],['ACN','기술'],['MCD','소비순환재'],
  ['DIS','커뮤니케이션'],['ABT','헬스케어'],['LIN','소재'],['WFC','금융'],['TXN','기술'],
  ['DHR','헬스케어'],['PM','필수소비재'],['INTU','기술'],['VZ','커뮤니케이션'],['IBM','기술'],
  ['CAT','산업재'],['GE','산업재'],['AMGN','헬스케어'],['NOW','기술'],['UBER','기술'],
  ['SPGI','금융'],['QCOM','기술'],['HON','산업재'],['LOW','소비순환재'],['UNP','산업재'],
  ['ISRG','헬스케어'],['ELV','헬스케어'],['PFE','헬스케어'],['BLK','금융'],['BA','산업재'],
];

const GROWTH = [
  ['PLTR','기술'],['SNOW','기술'],['CRWD','기술'],['NET','기술'],['DDOG','기술'],
  ['MDB','기술'],['ZS','기술'],['PANW','기술'],['FTNT','기술'],['SHOP','기술'],
  ['SQ','기술'],['ABNB','소비순환재'],['DASH','소비순환재'],['RBLX','커뮤니케이션'],['U','기술'],
  ['COIN','금융'],['HOOD','금융'],['SOFI','금융'],['AFRM','금융'],['UPST','금융'],
  ['ARM','기술'],['SMCI','기술'],['DELL','기술'],['ANET','기술'],['VRT','산업재'],
  ['MU','기술'],['TSM','기술'],['ASML','기술'],['LRCX','기술'],['KLAC','기술'],
  ['AMAT','기술'],['MRVL','기술'],['ON','기술'],['NXPI','기술'],['MPWR','기술'],
  ['ENPH','기술'],['FSLR','기술'],['CEG','유틸리티'],['VST','유틸리티'],['NRG','유틸리티'],
  ['TLN','유틸리티'],['GEV','산업재'],['ETN','산업재'],['PWR','산업재'],['NTRA','헬스케어'],
  ['EXAS','헬스케어'],['TDOC','헬스케어'],['VEEV','헬스케어'],['DXCM','헬스케어'],['PODD','헬스케어'],
];

const QUALITY = [
  ['COST','필수소비재'],['TJX','소비순환재'],['ROST','소비순환재'],['ULTA','소비순환재'],['LULU','소비순환재'],
  ['NKE','소비순환재'],['SBUX','소비순환재'],['CMG','소비순환재'],['YUM','소비순환재'],['DPZ','소비순환재'],
  ['BKNG','소비순환재'],['MAR','소비순환재'],['HLT','소비순환재'],['RCL','소비순환재'],['CCL','소비순환재'],
  ['AXP','금융'],['COF','금융'],['DFS','금융'],['GS','금융'],['MS','금융'],
  ['SCHW','금융'],['ICE','금융'],['CME','금융'],['MCO','금융'],['TRV','금융'],
  ['PGR','금융'],['ALL','금융'],['AIG','금융'],['MET','금융'],['PRU','금융'],
  ['CB','금융'],['AON','금융'],['MMC','금융'],['ADP','기술'],['PAYX','기술'],
  ['FIS','기술'],['FISV','기술'],['GPN','기술'],['PYPL','기술'],['WM','산업재'],
  ['RSG','산업재'],['ECL','소재'],['APD','소재'],['SHW','소재'],['NEE','유틸리티'],
  ['DUK','유틸리티'],['SO','유틸리티'],['D','유틸리티'],['AEP','유틸리티'],['EXC','유틸리티'],
];

const MANUAL = [
  ['IREN','기술'],
];

function buildUniverse() {
  const seen = new Set();
  const out = [];
  const add = (list, category) => {
    for (const [symbol, sector] of list) {
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      out.push({ symbol, sector, category });
    }
  };
  add(MEGA, 'mega');
  add(GROWTH, 'growth');
  add(QUALITY, 'quality');
  add(MANUAL, 'manual');
  return out;
}

export const UNIVERSE = buildUniverse();
export const UNIVERSE_SYMBOLS = UNIVERSE.map(u => u.symbol);

export function universeMeta(symbol) {
  return UNIVERSE.find(u => u.symbol === symbol) || null;
}
