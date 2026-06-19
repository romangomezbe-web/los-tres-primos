const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/menu — strip prices for non-admin
router.get('/', verifyToken, (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items WHERE available = 1').all();
  if (req.user.role !== 'admin') {
    return res.json(items.map(({ price, ...rest }) => rest));
  }
  res.json(items);
});

module.exports = router;
