// ═══════════════════════════════════════════════════
// 주간 스크리닝 API — 200종목 유니버스 3대 TOP30
// ═══════════════════════════════════════════════════
import { fetchPrices } from '../../lib/priceFetcher';
import { STOCK_UNIVERSE, getUniverseStock } from '../../lib/data';
import { UNIVERSE_SYMBOLS } from '../../lib/universe';
import { screenUniverse } from '../../lib/calculations';

const ALL_SYMBOLS = [...new Set([...Object.keys(STOCK_UNIVERSE), ...UNIVERSE_SYMBOLS])];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // 200종목 스크리닝은 무거우므로 6시간 캐시
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');

  try {
    const prices = await fetchPrices(ALL_SYMBOLS);

    const stocksWithPrices = ALL_SYMBOLS.map(symbol => ({
      ...getUniverseStock(symbol),
      priceData: prices[symbol] || null,
    }));

    const result = screenUniverse(stocksWithPrices);
    const failedCount = ALL_SYMBOLS.length - result.screened;

    res.status(200).json({
      ...result,
      universe_size: ALL_SYMBOLS.length,
      failed: failedCount,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(200).json({
      top30Comprehensive: [], top30MarsV: [], top30TenBagger: [],
      screened: 0, error: e.message, fetched_at: new Date().toISOString(),
    });
  }
}
