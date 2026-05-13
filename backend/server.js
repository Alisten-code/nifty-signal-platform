require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const marketRoutes = require('./routes/market');
const signalRoutes = require('./routes/signals');
const newsRoutes = require('./routes/news');
const optionChainRoutes = require('./routes/optionchain');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── Routes
app.use('/api/market', marketRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/optionchain', optionChainRoutes);

// ── Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Cron: refresh signals every 5 min during market hours (9:15–15:30 IST)
cron.schedule('*/5 9-15 * * 1-5', async () => {
  const hour = new Date().getHours();
  const min = new Date().getMinutes();
  if (hour === 9 && min < 15) return;
  if (hour === 15 && min > 30) return;
  console.log('[CRON] Refreshing signal data...');
  try {
    const signalService = require('./services/signalService');
    await signalService.refreshSignal();
  } catch (e) {
    console.error('[CRON] Error:', e.message);
  }
}, { timezone: 'Asia/Kolkata' });

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
