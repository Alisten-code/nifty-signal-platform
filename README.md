# 🔥 Nifty50 F&O Signal Platform

> Personal AI-powered Nifty50 Options signal system — 100% free APIs, Railway-ready.

## Stack
- **Frontend**: Next.js + TailwindCSS (port 3000)
- **Backend API**: Node.js + Express (port 4000)
- **Signal Engine**: Python + FastAPI (port 5001)
- **Database**: Supabase (free tier)
- **Deploy**: Railway

## Free Data Sources
| Source | What we use | Cost |
|--------|-------------|------|
| NSE India Public API | Option chain, OI, PCR, Max Pain | FREE |
| Yahoo Finance RSS | Market news, sentiment | FREE |
| Moneycontrol RSS | India-specific news | FREE |
| NSE Bhav Copy | EOD historical data | FREE |
| stooq.com | Daily OHLCV candles | FREE |

## Quick Start
```bash
# 1. Clone and setup
cp .env.example .env

# 2. Backend
cd backend && npm install && node server.js

# 3. Signal Engine
cd signal-engine && pip install -r requirements.txt && python app.py

# 4. Frontend
cd frontend && npm install && npm run dev
```

## Railway Deploy
Each service (backend, signal-engine, frontend) is a separate Railway service.
Set env vars in Railway dashboard. All services run from this monorepo.
