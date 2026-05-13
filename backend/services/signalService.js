const nseService = require('./nseService');
const analysisService = require('./analysisService');
const newsService = require('./newsService');

let cachedSignal = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshSignal() {
  try {
    const [chainData, allIndices, candles, news] = await Promise.allSettled([
      nseService.getOptionChain('NIFTY'),
      nseService.getAllIndices(),
      nseService.getNiftyHistory(60),
      newsService.fetchMarketNews(),
    ]);

    const oi = chainData.status === 'fulfilled'
      ? analysisService.analyzeOptionChain(chainData.value) : null;
    const historicalCandles = candles.status === 'fulfilled' ? candles.value : [];
    const sentiment = news.status === 'fulfilled' ? news.value : { score: 0 };

    if (!oi || historicalCandles.length < 20) {
      console.warn('[Signal] Insufficient data');
      return cachedSignal;
    }

    const signal = analysisService.generateSignal({
      oi, candles: historicalCandles, sentiment
    });

    cachedSignal = {
      signal,
      oi: oi ? { pcr: oi.pcr, support: oi.support, resistance: oi.resistance, maxPain: oi.maxPain, spotPrice: oi.spotPrice, nearestExpiry: oi.nearestExpiry, expiryDates: oi.expiryDates, strikeData: oi.strikeData } : null,
      news: sentiment,
      lastUpdated: new Date().toISOString()
    };
    lastFetch = Date.now();
    console.log('[Signal] Refreshed:', signal?.bias, signal?.confidence + '%');
    return cachedSignal;
  } catch (e) {
    console.error('[Signal] Refresh error:', e.message);
    return cachedSignal;
  }
}

async function getSignal(forceRefresh = false) {
  if (forceRefresh || !cachedSignal || (Date.now() - lastFetch > CACHE_TTL)) {
    return refreshSignal();
  }
  return cachedSignal;
}

module.exports = { getSignal, refreshSignal };
