const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/stats/today — admin only
router.get('/today', verifyToken, requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(total_price), 0) as total_revenue,
      COALESCE(AVG(total_price), 0) as avg_ticket,
      COALESCE(AVG(prep_time_seconds), 0) as avg_prep_seconds,
      MIN(prep_time_seconds) as fastest_seconds,
      MAX(prep_time_seconds) as slowest_seconds
    FROM orders
    WHERE date(created_at) = ? AND status = 'COMPLETED'
  `).get(today);

  const countByStatus = db.prepare(`
    SELECT status, COUNT(*) as cnt
    FROM orders WHERE date(created_at) = ?
    GROUP BY status
  `).all(today);

  const byHour = db.prepare(`
    SELECT
      strftime('%H', created_at) as hour,
      COUNT(*) as order_count,
      COALESCE(SUM(total_price), 0) as revenue
    FROM orders
    WHERE date(created_at) = ? AND status = 'COMPLETED'
    GROUP BY hour ORDER BY hour
  `).all(today);

  const topItems = db.prepare(`
    SELECT oi.item_name, oi.category,
      SUM(oi.quantity) as total_qty,
      SUM(oi.quantity * oi.unit_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE date(o.created_at) = ? AND o.status = 'COMPLETED'
    GROUP BY oi.item_name, oi.category
    ORDER BY total_qty DESC
  `).all(today);

  const byCategory = db.prepare(`
    SELECT oi.category,
      SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE date(o.created_at) = ? AND o.status = 'COMPLETED'
    GROUP BY oi.category
  `).all(today);

  // Historical accumulated revenue (including pre-loaded day 1)
  const historical = db.prepare(`
    SELECT COALESCE(SUM(total_revenue), 0) as accumulated
    FROM daily_summary
  `).get();

  const statusMap = {};
  for (const s of countByStatus) statusMap[s.status] = s.cnt;

  res.json({
    summary,
    statusMap,
    byHour,
    topItems,
    byCategory,
    accumulated: historical.accumulated,
  });
});

// GET /api/stats/cajero-today — no money, just counts
router.get('/cajero-today', verifyToken, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const counts = db.prepare(`
    SELECT status, COUNT(*) as cnt
    FROM orders WHERE date(created_at) = ?
    GROUP BY status
  `).all(today);

  const times = db.prepare(`
    SELECT MIN(prep_time_seconds) as fastest, MAX(prep_time_seconds) as slowest
    FROM orders WHERE date(created_at) = ? AND status = 'COMPLETED'
  `).get(today);

  const statusMap = {};
  for (const s of counts) statusMap[s.status] = s.cnt;

  res.json({ statusMap, fastest: times?.fastest, slowest: times?.slowest });
});

// GET /api/stats/calendar — admin only
router.get('/calendar', verifyToken, requireAdmin, (req, res) => {
  const { year, month } = req.query;
  const rows = db.prepare(`
    SELECT * FROM daily_summary
    WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
    ORDER BY date ASC
  `).all(year, month.padStart(2, '0'));
  res.json(rows);
});

// GET /api/stats/calendar/:date — admin only
router.get('/calendar/:date', verifyToken, requireAdmin, (req, res) => {
  const { date } = req.params;
  const summary = db.prepare('SELECT * FROM daily_summary WHERE date = ?').get(date);
  const orders = db.prepare(`
    SELECT o.*, GROUP_CONCAT(oi.item_name || ' x' || oi.quantity) as items_summary
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE date(o.created_at) = ? AND o.status = 'COMPLETED'
    GROUP BY o.id
    ORDER BY o.created_at ASC
  `).all(date);
  res.json({ summary, orders });
});

// GET /api/stats/week — admin only
router.get('/week', verifyToken, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM daily_summary
    ORDER BY date DESC LIMIT 7
  `).all().reverse();
  res.json(rows);
});

module.exports = router;
