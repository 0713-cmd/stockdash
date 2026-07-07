import { fetchPrices } from '../../lib/priceFetcher';
import { STOCK_UNIVERSE } from '../../lib/data';
import { UNIVERSE_SYMBOLS } from '../../lib/universe';

const ALL_SYMBOLS = [...new Set([...Object.keys(STOCK_UNIVERSE), ...UNIVERSE_SYMBOLS])];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  const { syms, sym } = req.query;
  let targets;
  if (syms) targets = syms.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  else if (sym) targets = [sym.toUpperCase()];
  else targets = ALL_SYMBOLS;

  const prices = await fetchPrices(targets);
  res.status(200).json({ prices, fetched_at: new Date().toISOString() });
}
