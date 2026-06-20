const Database = require('better-sqlite3');
const path = require('path');

const DB_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const db = new Database(path.join(DB_DIR, 'pos.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL,
    table_number INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    cancelled_at DATETIME,
    cancel_reason TEXT,
    prep_time_seconds INTEGER,
    total_price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    item_notes TEXT
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    available BOOLEAN DEFAULT TRUE
  );

  CREATE TABLE IF NOT EXISTS daily_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    total_orders INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    avg_prep_time_seconds INTEGER,
    fastest_order_seconds INTEGER,
    slowest_order_seconds INTEGER
  );
`);

// Add columns for existing DBs that predate these fields
try { db.exec("ALTER TABLE orders ADD COLUMN cancelled_at DATETIME"); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN cancel_reason TEXT"); } catch {}

// Seed menu if empty
const menuCount = db.prepare('SELECT COUNT(*) as cnt FROM menu_items').get();
if (menuCount.cnt === 0) {
  const insertItem = db.prepare(
    'INSERT INTO menu_items (name, description, category, price) VALUES (?, ?, ?, ?)'
  );
  const seedMenu = db.transaction(() => {
    insertItem.run('La Fiel', 'Pan suave, carne jugosa, queso derretido, lechuga, tomate y aderezos', 'Burgers', 130);
    insertItem.run('La Extranjera', 'Pan suave, carne jugosa, queso derretido, tocino crujiente y salsa BBQ', 'Burgers', 140);
    insertItem.run('La Suiza', 'Pan suave, carne jugosa, variedad de quesos y aderezos', 'Burgers', 150);
    insertItem.run('Las Migajas (Papas a la Francesa)', 'Crujientes y doraditas', 'Sides', 80);
    insertItem.run('Agua Fresca (1 Litro)', null, 'Bebidas', 40);
    insertItem.run('Refresco (500ml)', null, 'Bebidas', 35);
  });
  seedMenu();
}

// Pre-load Day 1 historical data
db.prepare(`
  INSERT OR IGNORE INTO daily_summary (date, total_orders, total_revenue)
  VALUES (date('now', '-1 day'), 1, 5000.00)
`).run();

module.exports = db;
