const express = require('express');
const router = express.Router();
const signalService = require('../services/signalService');
const analysisService = require('../services/analysisService');

// GET /api/signals/latest — latest signal
router.get('/latest', async (req, res) => {
  try {
    const data = await signalService.getSignal();
    if (!data) return res.status(503).json({ error: 'Signal not ready yet. NSE may be closed.' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/signals/refresh — force refresh
router.get('/refresh', async (req, res) => {
  try {
    const data = await signalService.getSignal(true);
    res.json({ ...data, refreshed: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/signals/lots — capital-based lot recommender
router.post('/lots', async (req, res) => {
  try {
    const { capital, riskPercent = 2 } = req.body;
    if (!capital || capital < 1000) return res.status(400).json({ error: 'Minimum capital ₹1000' });

    const data = await signalService.getSignal();
    if (!data || !data.signal) return res.status(503).json({ error: 'No signal available' });

    const { recommendation } = data.signal;
    const strikeData = data.oi?.strikeData || [];
    const lots = analysisService.recommendLots(capital, strikeData, recommendation, riskPercent);
    res.json({ capital, riskPercent, lots, signal: data.signal.bias, confidence: data.signal.confidence });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
