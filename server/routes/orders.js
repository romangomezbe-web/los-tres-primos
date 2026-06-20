const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

let io;
function setIo(socketIo) { io = socketIo; }

function stripPrices(order) {
  const { total_price, ...rest } = order;
  if (rest.items) rest.items = rest.items.map(({ unit_price, ...i }) => i);
  return rest;
}

function buildOrder(row) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(row.id);
  return { ...row, items };
}

// Cocina nunca ve precios. Cajero y Admin sí.
function sanitizeForRole(order, role) {
  if (role === 'cocina') return stripPrices(order);
  return order;
}

// GET /api/orders/active
router.get('/active', verifyToken, (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM orders WHERE status IN ('PENDING','IN_PROGRESS') ORDER BY created_at ASC"
  ).all();
  const orders = rows.map(r => sanitizeForRole(buildOrder(r), req.user.role));
  res.json(orders);
});

// GET /api/orders/today
router.get('/today', verifyToken, (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM orders WHERE date(created_at) = date('now') ORDER BY created_at DESC"
  ).all();
  const orders = rows.map(r => sanitizeForRole(buildOrder(r), req.user.role));
  res.json(orders);
});

// POST /api/orders — crear nuevo pedido (table_number=0 = para llevar)
router.post('/', verifyToken, (req, res) => {
  const { table_number, items } = req.body;
  if (table_number == null || !items?.length) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // Para llevar: asignar número del día
  let llevar_number = null;
  if (table_number === 0) {
    const count = db.prepare(
      "SELECT COUNT(*) as cnt FROM orders WHERE date(created_at) = date('now') AND table_number = 0"
    ).get();
    llevar_number = (count.cnt || 0) + 1;
  }

  let total = 0;
  const resolvedItems = items.map(item => {
    const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.menu_item_id);
    if (!menuItem) throw new Error(`Item ${item.menu_item_id} not found`);
    total += menuItem.price * item.quantity;
    return { ...item, unit_price: menuItem.price, name: menuItem.name, category: menuItem.category };
  });

  const order_number = table_number === 0 ? `LLEVAR-${llevar_number}` : `TP-${Date.now()}`;
  const insertOrder = db.prepare('INSERT INTO orders (order_number, table_number, total_price) VALUES (?, ?, ?)');
  const insertItem = db.prepare('INSERT INTO order_items (order_id, item_name, category, quantity, unit_price, item_notes) VALUES (?, ?, ?, ?, ?, ?)');

  const create = db.transaction(() => {
    const result = insertOrder.run(order_number, table_number, total);
    const orderId = result.lastInsertRowid;
    for (const item of resolvedItems) {
      insertItem.run(orderId, item.name, item.category, item.quantity, item.unit_price, item.notes || null);
    }
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  });

  const order = create();
  const full = buildOrder(order);
  if (io) io.emit('order:new', stripPrices(full));
  res.status(201).json(sanitizeForRole(full, req.user.role));
});

// PATCH /api/orders/:id/items — editar ítems de orden existente
router.patch('/:id/items', verifyToken, (req, res) => {
  const { items } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });

  let total = 0;
  const resolvedItems = items.map(item => {
    const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.menu_item_id);
    if (!menuItem) throw new Error(`Item ${item.menu_item_id} not found`);
    total += menuItem.price * item.quantity;
    return { ...item, unit_price: menuItem.price, name: menuItem.name, category: menuItem.category };
  });

  const update = db.transaction(() => {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
    const insertItem = db.prepare('INSERT INTO order_items (order_id, item_name, category, quantity, unit_price, item_notes) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of resolvedItems) {
      insertItem.run(req.params.id, item.name, item.category, item.quantity, item.unit_price, item.notes || null);
    }
    db.prepare('UPDATE orders SET total_price = ? WHERE id = ?').run(total, req.params.id);
  });
  update();

  const full = buildOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  if (io) io.emit('order:updated', stripPrices(full));
  res.json(sanitizeForRole(full, req.user.role));
});

// PATCH /api/orders/:id/start
router.patch('/:id/start', verifyToken, (req, res) => {
  db.prepare("UPDATE orders SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  const order = buildOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  if (io) io.emit('order:started', stripPrices(order));
  res.json(stripPrices(order));
});

// PATCH /api/orders/:id/complete
router.patch('/:id/complete', verifyToken, (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const createdAt = new Date(row.created_at + 'Z');
  const prepSeconds = Math.floor((Date.now() - createdAt) / 1000);

  db.prepare("UPDATE orders SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, prep_time_seconds = ? WHERE id = ?").run(prepSeconds, req.params.id);
  updateDailySummary();

  const order = buildOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  if (io) io.emit('order:completed', stripPrices(order));
  res.json(stripPrices(order));
});

// PATCH /api/orders/:id/cancel
router.patch('/:id/cancel', verifyToken, (req, res) => {
  const { cancel_reason } = req.body || {};
  db.prepare("UPDATE orders SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, cancel_reason = ? WHERE id = ?")
    .run(cancel_reason || null, req.params.id);
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Pedido no encontrado' });
  const order = buildOrder(row);
  if (io) io.emit('order:cancelled', stripPrices(order));
  res.json(stripPrices(order));
});

function updateDailySummary() {
  const today = new Date().toISOString().slice(0, 10);
  const stats = db.prepare(`
    SELECT COUNT(*) as total_orders, COALESCE(SUM(total_price),0) as total_revenue,
      COALESCE(AVG(prep_time_seconds),0) as avg_prep,
      MIN(prep_time_seconds) as fastest, MAX(prep_time_seconds) as slowest
    FROM orders WHERE date(created_at) = ? AND status = 'COMPLETED'
  `).get(today);
  db.prepare(`
    INSERT INTO daily_summary (date, total_orders, total_revenue, avg_prep_time_seconds, fastest_order_seconds, slowest_order_seconds)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_orders = excluded.total_orders, total_revenue = excluded.total_revenue,
      avg_prep_time_seconds = excluded.avg_prep_time_seconds,
      fastest_order_seconds = excluded.fastest_order_seconds,
      slowest_order_seconds = excluded.slowest_order_seconds
  `).run(today, stats.total_orders, stats.total_revenue, Math.round(stats.avg_prep), stats.fastest, stats.slowest);
}

module.exports = { router, setIo };
