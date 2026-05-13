const express = require('express');
const router = express.Router();
const signalService = require('../services/signalService');

// GET /api/optionchain — full OI data
router.get('/', async (req, res) => {
  try {
    const data = await signalService.getSignal();
    if (!data?.oi) return res.status(503).json({ error: 'OI data not ready' });
    // Return top 20 strikes around spot
    const spot = data.oi.spotPrice;
    const filtered = (data.oi.strikeData || [])
      .filter(s => Math.abs(s.strike - spot) <= 500)
      .sort((a, b) => a.strike - b.strike);
    res.json({ ...data.oi, strikeData: filtered });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
