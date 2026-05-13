const axios = require('axios');

// NSE requires browser-like headers to avoid 403
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.nseindia.com',
  'Connection': 'keep-alive',
};

const nseClient = axios.create({
  baseURL: 'https://www.nseindia.com/api',
  headers: NSE_HEADERS,
  timeout: 15000,
  withCredentials: false,
});

// ── Helper: get NSE cookies first, then fetch data (NSE requires this)
let nse_cookies = '';
async function getNSECookies() {
  try {
    const resp = await axios.get('https://www.nseindia.com', { headers: NSE_HEADERS, timeout: 10000 });
    const setCookie = resp.headers['set-cookie'];
    if (setCookie) nse_cookies = setCookie.map(c => c.split(';')[0]).join('; ');
  } catch (e) {
    console.warn('[NSE] Cookie fetch failed:', e.message);
  }
}

async function fetchNSE(path) {
  if (!nse_cookies) await getNSECookies();
  try {
    const resp = await nseClient.get(path, {
      headers: { ...NSE_HEADERS, 'Cookie': nse_cookies }
    });
    return resp.data;
  } catch (err) {
    console.error('[NSE] Fetch error:', path, err.message);
    throw err;
  }
}

// ── Option Chain (Nifty)
async function getOptionChain(symbol = 'NIFTY') {
  return fetchNSE(`/option-chain-indices?symbol=${symbol}`);
}

// ── All Indices (Nifty spot price)
async function getAllIndices() {
  return fetchNSE('/allIndices');
}

// ── Market Status
async function getMarketStatus() {
  return fetchNSE('/marketStatus');
}

// ── Nifty historical data from stooq (free, no key needed)
async function getNiftyHistory(days = 60) {
  try {
    const url = `https://stooq.com/q/d/l/?s=%5ENSEI&i=d`;
    const resp = await axios.get(url, { timeout: 10000 });
    const lines = resp.data.trim().split('\n').slice(1); // skip header
    return lines.slice(-days).map(line => {
      const [date, open, high, low, close, volume] = line.split(',');
      return { date, open: +open, high: +high, low: +low, close: +close, volume: +volume };
    }).filter(d => d.close > 0);
  } catch (e) {
    console.error('[STOOQ] Error:', e.message);
    return [];
  }
}

module.exports = { getOptionChain, getAllIndices, getMarketStatus, getNiftyHistory };
