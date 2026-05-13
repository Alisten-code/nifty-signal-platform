const express = require('express');
const router = express.Router();
const nseService = require('../services/nseService');

// GET /api/market/status
router.get('/status', async (req, res) => {
  try {
    const data = await nseService.getMarketStatus();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
