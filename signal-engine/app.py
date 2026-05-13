import os, json, requests, feedparser
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import ta
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(title="Nifty Signal Engine")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com",
}

# ── Fetch Nifty OHLCV from stooq (free)
def fetch_nifty_candles(days=90):
    try:
        url = "https://stooq.com/q/d/l/?s=%5ENSEI&i=d"
        r = requests.get(url, timeout=15)
        lines = r.text.strip().split("\n")[1:]
        data = []
        for line in lines[-days:]:
            parts = line.split(",")
            if len(parts) >= 5:
                data.append({"date": parts[0], "open": float(parts[1]),
                              "high": float(parts[2]), "low": float(parts[3]),
                              "close": float(parts[4])})
        return data
    except Exception as e:
        return []

# ── Deep technical analysis with 'ta' library
def compute_technicals(candles):
    if len(candles) < 30:
        return {}
    df = pd.DataFrame(candles)
    df['close'] = df['close'].astype(float)
    df['high'] = df['high'].astype(float)
    df['low'] = df['low'].astype(float)

    # Trend indicators
    df['ema9'] = ta.trend.EMAIndicator(df['close'], window=9).ema_indicator()
    df['ema21'] = ta.trend.EMAIndicator(df['close'], window=21).ema_indicator()
    df['ema50'] = ta.trend.EMAIndicator(df['close'], window=50).ema_indicator()
    df['adx'] = ta.trend.ADXIndicator(df['high'], df['low'], df['close']).adx()

    # Momentum
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
    df['macd'] = ta.trend.MACD(df['close']).macd_diff()

    # Volatility
    bb = ta.volatility.BollingerBands(df['close'], window=20)
    df['bb_upper'] = bb.bollinger_hband()
    df['bb_lower'] = bb.bollinger_lband()
    df['bb_width'] = bb.bollinger_wband()
    df['atr'] = ta.volatility.AverageTrueRange(df['high'], df['low'], df['close']).average_true_range()

    last = df.iloc[-1]
    prev = df.iloc[-2]

    return {
        "close": float(last['close']),
        "ema9": round(float(last['ema9']), 2),
        "ema21": round(float(last['ema21']), 2),
        "ema50": round(float(last['ema50']), 2),
        "rsi": round(float(last['rsi']), 2),
        "macd_hist": round(float(last['macd']), 2),
        "adx": round(float(last['adx']), 2),
        "bb_upper": round(float(last['bb_upper']), 2),
        "bb_lower": round(float(last['bb_lower']), 2),
        "atr": round(float(last['atr']), 2),
        "price_vs_ema9": "above" if last['close'] > last['ema9'] else "below",
        "price_vs_ema50": "above" if last['close'] > last['ema50'] else "below",
        "macd_signal": "bullish" if last['macd'] > 0 and last['macd'] > prev['macd'] else "bearish",
        "rsi_zone": "overbought" if last['rsi'] > 70 else ("oversold" if last['rsi'] < 30 else "neutral"),
        "adx_strength": "strong_trend" if last['adx'] > 25 else "weak_trend",
        "volatility_pct": round(float(last['atr']) / float(last['close']) * 100, 2),
    }

# ── Sentiment from free RSS
def compute_sentiment():
    bullish_words = ['rally', 'surge', 'gain', 'high', 'bull', 'positive', 'strong', 'recover', 'up', 'rise']
    bearish_words = ['fall', 'drop', 'crash', 'bear', 'weak', 'sell', 'negative', 'down', 'loss', 'decline']
    feeds = [
        'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^NSEI&region=IN&lang=en-US',
        'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms',
    ]
    score = 0
    count = 0
    headlines = []
    for url in feeds:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:8]:
                text = (entry.get('title', '') + ' ' + entry.get('summary', '')).lower()
                s = sum(1 for w in bullish_words if w in text) - sum(1 for w in bearish_words if w in text)
                score += s
                count += 1
                headlines.append({"title": entry.get('title', ''), "score": s})
        except:
            pass
    avg = score / count if count else 0
    return {"score": round(avg, 2), "bias": "BULLISH" if avg > 0.3 else ("BEARISH" if avg < -0.3 else "NEUTRAL"), "headlines": headlines[:10]}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/technicals")
def get_technicals():
    candles = fetch_nifty_candles(90)
    if not candles:
        return {"error": "Could not fetch candle data"}
    return compute_technicals(candles)

@app.get("/sentiment")
def get_sentiment():
    return compute_sentiment()

@app.get("/full-analysis")
def full_analysis():
    candles = fetch_nifty_candles(90)
    tech = compute_technicals(candles)
    sent = compute_sentiment()
    return {"technicals": tech, "sentiment": sent, "candle_count": len(candles)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SIGNAL_ENGINE_PORT", 5001))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
