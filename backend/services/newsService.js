const Parser = require('rss-parser');
const parser = new Parser();

// Simple keyword-based sentiment (no API needed)
const BULLISH_WORDS = ['surge', 'rally', 'gain', 'record', 'high', 'rise', 'up', 'positive', 'growth', 'strong', 'buy', 'bullish', 'recovery', 'boost', 'profit'];
const BEARISH_WORDS = ['fall', 'drop', 'decline', 'low', 'sell', 'bearish', 'loss', 'crash', 'weak', 'down', 'negative', 'recession', 'fear', 'risk', 'pressure'];

function scoreSentiment(text) {
  const lower = text.toLowerCase();
  let score = 0;
  BULLISH_WORDS.forEach(w => { if (lower.includes(w)) score += 1; });
  BEARISH_WORDS.forEach(w => { if (lower.includes(w)) score -= 1; });
  return score;
}

async function fetchMarketNews() {
  const feeds = [
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^NSEI&region=IN&lang=en-US',
    'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms',
  ];

  let allItems = [];
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      allItems = allItems.concat(feed.items.slice(0, 10));
    } catch (e) {
      console.warn('[RSS] Feed error:', url, e.message);
    }
  }

  const scored = allItems.map(item => {
    const text = (item.title || '') + ' ' + (item.contentSnippet || '');
    const score = scoreSentiment(text);
    return {
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      score,
      bias: score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral',
      source: item.creator || new URL(item.link || 'https://unknown.com').hostname
    };
  });

  const totalScore = scored.reduce((s, i) => s + i.score, 0);
  const normalized = scored.length > 0 ? totalScore / scored.length : 0;

  return {
    items: scored.slice(0, 15),
    score: +normalized.toFixed(2),
    bias: normalized > 0.3 ? 'BULLISH' : normalized < -0.3 ? 'BEARISH' : 'NEUTRAL',
    timestamp: new Date().toISOString()
  };
}

module.exports = { fetchMarketNews };
