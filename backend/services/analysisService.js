// ── Core Analysis Engine (pure JS, no paid deps)

// ────────────────────────────────────────────
// OPTION CHAIN ANALYSIS
// ────────────────────────────────────────────
function analyzeOptionChain(chainData) {
  if (!chainData || !chainData.records) return null;

  const records = chainData.records.data || [];
  const expiryDates = chainData.records.expiryDates || [];
  const spotPrice = chainData.records.underlyingValue;
  const nearestExpiry = expiryDates[0];

  let totalCE_OI = 0, totalPE_OI = 0;
  let totalCE_OI_Change = 0, totalPE_OI_Change = 0;
  let maxCE_OI = 0, maxPE_OI = 0;
  let maxCE_Strike = 0, maxPE_Strike = 0;
  const strikeData = [];

  records.filter(r => r.expiryDate === nearestExpiry).forEach(r => {
    const strike = r.strikePrice;
    const ce = r.CE || {};
    const pe = r.PE || {};

    totalCE_OI += ce.openInterest || 0;
    totalPE_OI += pe.openInterest || 0;
    totalCE_OI_Change += ce.changeinOpenInterest || 0;
    totalPE_OI_Change += pe.changeinOpenInterest || 0;

    if ((ce.openInterest || 0) > maxCE_OI) { maxCE_OI = ce.openInterest; maxCE_Strike = strike; }
    if ((pe.openInterest || 0) > maxPE_OI) { maxPE_OI = pe.openInterest; maxPE_Strike = strike; }

    strikeData.push({
      strike, expiryDate: r.expiryDate,
      ce_oi: ce.openInterest || 0, ce_oi_change: ce.changeinOpenInterest || 0,
      ce_ltp: ce.lastPrice || 0, ce_iv: ce.impliedVolatility || 0,
      pe_oi: pe.openInterest || 0, pe_oi_change: pe.changeinOpenInterest || 0,
      pe_ltp: pe.lastPrice || 0, pe_iv: pe.impliedVolatility || 0,
    });
  });

  // PCR (Put-Call Ratio) — > 1.2 bullish, < 0.8 bearish
  const pcr = totalCE_OI > 0 ? totalPE_OI / totalCE_OI : 1;
  const pcrChange = totalCE_OI_Change !== 0 ? totalPE_OI_Change / Math.abs(totalCE_OI_Change) : 1;

  // Max Pain — strike where total option buyers lose most money
  const maxPain = computeMaxPain(strikeData);

  // Support = max PE OI strike (put writers defend this level)
  // Resistance = max CE OI strike (call writers defend this level)
  return {
    spotPrice, nearestExpiry, expiryDates,
    pcr: +pcr.toFixed(3), pcrChange: +pcrChange.toFixed(3),
    totalCE_OI, totalPE_OI,
    support: maxPE_Strike, resistance: maxCE_Strike,
    maxPain, strikeData
  };
}

function computeMaxPain(strikeData) {
  if (!strikeData.length) return 0;
  let minLoss = Infinity, maxPainStrike = 0;
  const strikes = strikeData.map(s => s.strike);

  strikes.forEach(expiry => {
    let totalLoss = 0;
    strikeData.forEach(s => {
      if (expiry > s.strike) totalLoss += (expiry - s.strike) * s.ce_oi;
      if (expiry < s.strike) totalLoss += (s.strike - expiry) * s.pe_oi;
    });
    if (totalLoss < minLoss) { minLoss = totalLoss; maxPainStrike = expiry; }
  });
  return maxPainStrike;
}

// ────────────────────────────────────────────
// TECHNICAL ANALYSIS (EMA, RSI, VWAP)
// ────────────────────────────────────────────
function ema(prices, period) {
  const k = 2 / (period + 1);
  let emaVal = prices[0];
  return prices.map((p, i) => {
    if (i === 0) return emaVal;
    emaVal = p * k + emaVal * (1 - k);
    return +emaVal.toFixed(2);
  });
}

function rsi(prices, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  const rsiArr = new Array(period + 1).fill(null);
  rsiArr.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    rsiArr.push(avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
  }
  return rsiArr;
}

function supertrend(candles, period = 10, multiplier = 3) {
  if (candles.length < period + 1) return { trend: 'neutral', value: 0 };
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  // ATR
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    return Math.max(c.high - c.low, Math.abs(c.high - closes[i-1]), Math.abs(c.low - closes[i-1]));
  });
  const atrArr = ema(tr, period);

  let upBand = 0, dnBand = 0, trend = 1;
  candles.forEach((c, i) => {
    const mid = (highs[i] + lows[i]) / 2;
    const up = mid + multiplier * atrArr[i];
    const dn = mid - multiplier * atrArr[i];
    if (i === 0) { upBand = up; dnBand = dn; return; }
    upBand = (up < upBand || closes[i-1] > upBand) ? up : upBand;
    dnBand = (dn > dnBand || closes[i-1] < dnBand) ? dn : dnBand;
    if (closes[i] > upBand) trend = -1;
    else if (closes[i] < dnBand) trend = 1;
  });

  return { trend: trend === -1 ? 'bullish' : 'bearish', value: trend === -1 ? dnBand : upBand };
}

// ────────────────────────────────────────────
// SIGNAL AGGREGATOR
// ────────────────────────────────────────────
function generateSignal({ oi, technical, sentiment, candles }) {
  if (!oi || !candles || candles.length < 20) return null;
  const closes = candles.map(c => c.close);

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const rsiArr = rsi(closes, 14);
  const st = supertrend(candles, 10, 3);
  const lastClose = closes[closes.length - 1];
  const lastRSI = rsiArr[rsiArr.length - 1] || 50;
  const lastEMA9 = ema9[ema9.length - 1];
  const lastEMA21 = ema21[ema21.length - 1];
  const lastEMA50 = ema50[ema50.length - 1];

  // Scoring system: +1 bullish, -1 bearish each signal
  let score = 0;
  const signals = [];

  // 1. EMA cross
  if (lastEMA9 > lastEMA21) { score += 1; signals.push({ label: 'EMA 9>21', bias: 'bullish' }); }
  else { score -= 1; signals.push({ label: 'EMA 9<21', bias: 'bearish' }); }

  if (lastClose > lastEMA50) { score += 1; signals.push({ label: 'Price > EMA50', bias: 'bullish' }); }
  else { score -= 1; signals.push({ label: 'Price < EMA50', bias: 'bearish' }); }

  // 2. RSI
  if (lastRSI > 55) { score += 1; signals.push({ label: `RSI ${lastRSI.toFixed(1)} Bullish`, bias: 'bullish' }); }
  else if (lastRSI < 45) { score -= 1; signals.push({ label: `RSI ${lastRSI.toFixed(1)} Bearish`, bias: 'bearish' }); }
  else signals.push({ label: `RSI ${lastRSI.toFixed(1)} Neutral`, bias: 'neutral' });

  // 3. Supertrend
  if (st.trend === 'bullish') { score += 1.5; signals.push({ label: 'Supertrend Bullish', bias: 'bullish' }); }
  else { score -= 1.5; signals.push({ label: 'Supertrend Bearish', bias: 'bearish' }); }

  // 4. PCR
  if (oi.pcr > 1.2) { score += 1; signals.push({ label: `PCR ${oi.pcr} → Bullish`, bias: 'bullish' }); }
  else if (oi.pcr < 0.8) { score -= 1; signals.push({ label: `PCR ${oi.pcr} → Bearish`, bias: 'bearish' }); }
  else signals.push({ label: `PCR ${oi.pcr} Neutral`, bias: 'neutral' });

  // 5. Price vs MaxPain
  const spotVsMaxPain = oi.spotPrice - oi.maxPain;
  if (spotVsMaxPain < -100) { score += 0.5; signals.push({ label: 'Below MaxPain → Pull Up', bias: 'bullish' }); }
  else if (spotVsMaxPain > 100) { score -= 0.5; signals.push({ label: 'Above MaxPain → Pull Down', bias: 'bearish' }); }

  // 6. Sentiment
  if (sentiment && sentiment.score > 0.1) { score += 0.5; signals.push({ label: 'News Positive', bias: 'bullish' }); }
  else if (sentiment && sentiment.score < -0.1) { score -= 0.5; signals.push({ label: 'News Negative', bias: 'bearish' }); }

  // ── Final bias
  const maxScore = 6.5;
  const confidence = Math.min(100, Math.round((Math.abs(score) / maxScore) * 100));
  const bias = score > 0.5 ? 'BULLISH' : score < -0.5 ? 'BEARISH' : 'SIDEWAYS';

  // ── Option recommendation
  const { recommendation, target, stopLoss } = getOptionRec(bias, oi, lastClose);

  return {
    bias, confidence, score: +score.toFixed(2),
    spotPrice: oi.spotPrice, maxPain: oi.maxPain,
    support: oi.support, resistance: oi.resistance,
    pcr: oi.pcr, expiry: oi.nearestExpiry,
    rsi: +lastRSI.toFixed(2), ema9: lastEMA9, ema21: lastEMA21, ema50: lastEMA50,
    supertrendBias: st.trend, supertrendValue: +st.value.toFixed(2),
    signals, recommendation, target, stopLoss,
    timestamp: new Date().toISOString()
  };
}

function getOptionRec(bias, oi, spotPrice) {
  const { support, resistance, maxPain, spotPrice: sp } = oi;
  const atmStrike = Math.round(sp / 50) * 50;

  if (bias === 'BULLISH') {
    const strike = atmStrike; // ATM CE
    return {
      recommendation: { type: 'BUY CE', strike, expiry: oi.nearestExpiry },
      target: +(sp * 1.005).toFixed(2),
      stopLoss: +(sp * 0.993).toFixed(2),
    };
  } else if (bias === 'BEARISH') {
    const strike = atmStrike; // ATM PE
    return {
      recommendation: { type: 'BUY PE', strike, expiry: oi.nearestExpiry },
      target: +(sp * 0.995).toFixed(2),
      stopLoss: +(sp * 1.007).toFixed(2),
    };
  } else {
    return {
      recommendation: { type: 'NO TRADE / STRADDLE', strike: atmStrike, expiry: oi.nearestExpiry },
      target: null, stopLoss: null,
    };
  }
}

// ────────────────────────────────────────────
// CAPITAL OPTIMIZER
// ────────────────────────────────────────────
function recommendLots(capital, strikeData, rec, riskPercent = 2) {
  if (!rec || !strikeData || !strikeData.length) return null;
  const NIFTY_LOT = 75; // Nifty lot size
  const riskAmount = capital * (riskPercent / 100);
  const isCE = rec.type.includes('CE');
  const targetStrike = rec.strike;

  // Find LTP of recommended strike
  const strikeRow = strikeData.find(s => s.strike === targetStrike);
  if (!strikeRow) return null;
  const premiumLTP = isCE ? strikeRow.ce_ltp : strikeRow.pe_ltp;
  if (!premiumLTP) return null;

  const costPerLot = premiumLTP * NIFTY_LOT;
  const maxLots = Math.floor(capital / costPerLot);
  const riskedLots = Math.floor(riskAmount / (premiumLTP * 0.3 * NIFTY_LOT)); // 30% stop on premium
  const recommendedLots = Math.max(1, Math.min(maxLots, riskedLots));

  return {
    strike: targetStrike, type: rec.type, expiry: rec.expiry,
    premiumLTP, lotSize: NIFTY_LOT,
    costPerLot: +costPerLot.toFixed(2),
    recommendedLots,
    totalCost: +(recommendedLots * costPerLot).toFixed(2),
    maxLoss: +(recommendedLots * premiumLTP * 0.3 * NIFTY_LOT).toFixed(2),
    riskPercent
  };
}

module.exports = { analyzeOptionChain, generateSignal, recommendLots };
