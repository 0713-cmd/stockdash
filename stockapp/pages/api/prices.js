import yahooFinance from 'yahoo-finance2';

const SYMBOLS = [
  'GOOGL','TSLA','AAPL','AMZN','AVGO','COIN','IREN','NTRA',
  'NVDA','META','MSFT','ORCL','VRT','MU',
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');

  const { sym } = req.query;
  const targets = sym ? [sym.toUpperCase()] : SYMBOLS;
  const results = {};
  const errors = {};

  await Promise.allSettled(
    targets.map(async (s) => {
      try {
        const q = await yahooFinance.quote(s, {}, { validateResult: false });
        results[s] = {
          price:   q.regularMarketPrice,
          prev:    q.regularMarketPreviousClose,
          change:  q.regularMarketChangePercent ? +q.regularMarketChangePercent.toFixed(2) : 0,
          high52:  q.fiftyTwoWeekHigh,
          low52:   q.fiftyTwoWeekLow,
          mktCap:  q.marketCap,
          pe:      q.trailingPE || null,
          fwdPE:   q.forwardPE || null,
          eps:     q.epsTrailingTwelveMonths || null,
          currency: q.currency || 'USD',
          fetched: new Date().toISOString(),
        };
      } catch (e) {
        errors[s] = e.message;
        results[s] = null;
      }
    })
  );

  res.status(200).json({
    prices: results,
    errors: Object.keys(errors).length ? errors : undefined,
    fetched_at: new Date().toISOString(),
  });
}
