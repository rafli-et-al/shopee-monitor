import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'shopee_monitor.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image TEXT,
    url TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_checked_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS variants (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    name TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    is_tracked INTEGER NOT NULL DEFAULT 1,
    last_notified_stock INTEGER DEFAULT -1,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT,
    item_name TEXT,
    variant_name TEXT,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export interface ItemRecord {
  id: string;
  shop_id: string;
  item_id: string;
  name: string;
  image: string | null;
  url: string;
  is_active: number;
  last_checked_at: string | null;
  created_at: string;
}

export interface VariantRecord {
  id: string;
  item_id: string;
  model_id: string;
  name: string;
  stock: number;
  is_tracked: number;
  last_notified_stock: number;
  updated_at: string;
}

export interface AlertRecord {
  id: number;
  item_id: string | null;
  item_name: string | null;
  variant_name: string | null;
  alert_type: string;
  message: string;
  sent_at: string;
}

export const dbService = {
  getAllItems(): (ItemRecord & { variants: VariantRecord[] })[] {
    const items = db.prepare('SELECT * FROM items ORDER BY created_at DESC').all() as ItemRecord[];
    const getVariants = db.prepare('SELECT id, item_id, model_id, name, stock, is_tracked, last_notified_stock, updated_at FROM variants WHERE item_id = ?');

    return items.map((item) => ({
      ...item,
      variants: getVariants.all(item.id) as VariantRecord[],
    }));
  },

  getItemById(id: string): (ItemRecord & { variants: VariantRecord[] }) | null {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRecord | undefined;
    if (!item) return null;

    const variants = db.prepare('SELECT id, item_id, model_id, name, stock, is_tracked, last_notified_stock, updated_at FROM variants WHERE item_id = ?').all(id) as VariantRecord[];
    return {
      ...item,
      variants,
    };
  },

  findItemByShopAndItem(shopId: string, itemId: string): ItemRecord | undefined {
    return db.prepare('SELECT * FROM items WHERE shop_id = ? AND item_id = ?').get(shopId, itemId) as ItemRecord | undefined;
  },

  createItem(
    item: { id: string; shop_id: string; item_id: string; name: string; image: string | null; url: string },
    variants: Array<{ id: string; model_id: string; name: string; stock: number; is_tracked: number }>
  ) {
    const now = new Date().toISOString();
    const insertItem = db.prepare(`
      INSERT INTO items (id, shop_id, item_id, name, image, url, is_active, created_at, last_checked_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const insertVariant = db.prepare(`
      INSERT INTO variants (id, item_id, model_id, name, stock, is_tracked, last_notified_stock, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertItem.run(item.id, item.shop_id, item.item_id, item.name, item.image, item.url, now, now);

      for (const v of variants) {
        insertVariant.run(v.id, item.id, v.model_id, v.name, v.stock, v.is_tracked, v.stock, now);
      }
    });

    transaction();
  },

  updateItemStatus(id: string, isActive: boolean) {
    db.prepare('UPDATE items SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  },

  updateItemLastChecked(id: string) {
    const now = new Date().toISOString();
    db.prepare('UPDATE items SET last_checked_at = ? WHERE id = ?').run(now, id);
  },

  updateVariant(variantId: string, stock: number, lastNotifiedStock?: number) {
    const now = new Date().toISOString();
    if (lastNotifiedStock !== undefined) {
      db.prepare(`
        UPDATE variants
        SET stock = ?, last_notified_stock = ?, updated_at = ?
        WHERE id = ?
      `).run(stock, lastNotifiedStock, now, variantId);
    } else {
      db.prepare(`
        UPDATE variants
        SET stock = ?, updated_at = ?
        WHERE id = ?
      `).run(stock, now, variantId);
    }
  },

  deleteItem(id: string) {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM variants WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
    });
    transaction();
  },

  logAlert(alert: { itemId?: string; itemName?: string; variantName?: string; alertType: string; message: string }) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO alerts (item_id, item_name, variant_name, alert_type, message, sent_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(alert.itemId || null, alert.itemName || null, alert.variantName || null, alert.alertType, alert.message, now);
  },

  getAlerts(limit = 50): AlertRecord[] {
    return db.prepare('SELECT * FROM alerts ORDER BY sent_at DESC LIMIT ?').all(limit) as AlertRecord[];
  },

  getSetting(key: string): string | null {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  },

  setSetting(key: string, value: string) {
    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  },

  getAllSettings(): Record<string, string> {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }
};

export default db;
