const express = require('express');
const router = express.Router();
const newsService = require('../services/newsService');
let cache = null, cacheTime = 0;

// GET /api/news — market news + sentiment
router.get('/', async (req, res) => {
  try {
    if (!cache || (Date.now() - cacheTime > 10 * 60 * 1000)) {
      cache = await newsService.fetchMarketNews();
      cacheTime = Date.now();
    }
    res.json(cache);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
