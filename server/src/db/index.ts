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

const itemColumns = db.prepare("PRAGMA table_info(items)").all() as { name: string }[];
const hasUserId = itemColumns.some((c) => c.name === 'user_id');
if (itemColumns.length > 0 && !hasUserId) {
  db.exec(`
    DROP TABLE IF EXISTS variants;
    DROP TABLE IF EXISTS alerts;
    DROP TABLE IF EXISTS items;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    telegram_chat_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image TEXT,
    url TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_checked_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    user_id TEXT,
    item_id TEXT,
    item_name TEXT,
    variant_name TEXT,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  telegram_chat_id: string | null;
  created_at: string;
}

export interface ItemRecord {
  id: string;
  user_id: string;
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
  user_id: string | null;
  item_id: string | null;
  item_name: string | null;
  variant_name: string | null;
  alert_type: string;
  message: string;
  sent_at: string;
}

export const dbService = {
  createUser(user: { id: string; username: string; password_hash: string; telegram_chat_id?: string | null }): UserRecord {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, telegram_chat_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.username.toLowerCase().trim(), user.password_hash, user.telegram_chat_id || null, now);

    return this.findUserById(user.id)!;
  },

  findUserByUsername(username: string): UserRecord | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim()) as UserRecord | undefined;
  },

  findUserById(id: string): UserRecord | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | undefined;
  },

  updateUserTelegramChatId(userId: string, chatId: string | null) {
    db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(chatId ? chatId.trim() : null, userId);
  },

  getItemsByUserId(userId: string): (ItemRecord & { variants: VariantRecord[] })[] {
    const items = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC').all(userId) as ItemRecord[];
    const getVariants = db.prepare('SELECT id, item_id, model_id, name, stock, is_tracked, last_notified_stock, updated_at FROM variants WHERE item_id = ?');

    return items.map((item) => ({
      ...item,
      variants: getVariants.all(item.id) as VariantRecord[],
    }));
  },

  getItemByIdForUser(id: string, userId: string): (ItemRecord & { variants: VariantRecord[] }) | null {
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, userId) as ItemRecord | undefined;
    if (!item) return null;

    const variants = db.prepare('SELECT id, item_id, model_id, name, stock, is_tracked, last_notified_stock, updated_at FROM variants WHERE item_id = ?').all(id) as VariantRecord[];
    return {
      ...item,
      variants,
    };
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

  getItemOwner(itemId: string): { user_id: string; telegram_chat_id: string | null } | null {
    const row = db.prepare(`
      SELECT i.user_id, u.telegram_chat_id
      FROM items i
      JOIN users u ON i.user_id = u.id
      WHERE i.id = ?
    `).get(itemId) as { user_id: string; telegram_chat_id: string | null } | undefined;
    return row || null;
  },

  getAllActiveItems(): (ItemRecord & { variants: VariantRecord[]; owner_telegram_chat_id: string | null })[] {
    const items = db.prepare(`
      SELECT i.*, u.telegram_chat_id as owner_telegram_chat_id
      FROM items i
      JOIN users u ON i.user_id = u.id
      WHERE i.is_active = 1
      ORDER BY i.created_at DESC
    `).all() as (ItemRecord & { owner_telegram_chat_id: string | null })[];

    const getVariants = db.prepare('SELECT id, item_id, model_id, name, stock, is_tracked, last_notified_stock, updated_at FROM variants WHERE item_id = ?');

    return items.map((item) => ({
      ...item,
      variants: getVariants.all(item.id) as VariantRecord[],
    }));
  },

  findItemByShopAndItemForUser(userId: string, shopId: string, itemId: string): ItemRecord | undefined {
    return db.prepare('SELECT * FROM items WHERE user_id = ? AND shop_id = ? AND item_id = ?').get(userId, shopId, itemId) as ItemRecord | undefined;
  },

  createItem(
    userId: string,
    item: { id: string; shop_id: string; item_id: string; name: string; image: string | null; url: string },
    variants: Array<{ id: string; model_id: string; name: string; stock: number; is_tracked: number }>
  ) {
    const now = new Date().toISOString();
    const insertItem = db.prepare(`
      INSERT INTO items (id, user_id, shop_id, item_id, name, image, url, is_active, created_at, last_checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const insertVariant = db.prepare(`
      INSERT INTO variants (id, item_id, model_id, name, stock, is_tracked, last_notified_stock, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertItem.run(item.id, userId, item.shop_id, item.item_id, item.name, item.image, item.url, now, now);

      for (const v of variants) {
        insertVariant.run(v.id, item.id, v.model_id, v.name, v.stock, v.is_tracked, v.stock, now);
      }
    });

    transaction();
  },

  updateItemStatusForUser(id: string, userId: string, isActive: boolean) {
    db.prepare('UPDATE items SET is_active = ? WHERE id = ? AND user_id = ?').run(isActive ? 1 : 0, id, userId);
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

  deleteItemForUser(id: string, userId: string) {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM variants WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(id, userId);
    });
    transaction();
  },

  logAlert(alert: { userId?: string | null; itemId?: string; itemName?: string; variantName?: string; alertType: string; message: string }) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO alerts (user_id, item_id, item_name, variant_name, alert_type, message, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(alert.userId || null, alert.itemId || null, alert.itemName || null, alert.variantName || null, alert.alertType, alert.message, now);
  },

  getAlertsByUserId(userId: string, limit = 50): AlertRecord[] {
    return db.prepare('SELECT * FROM alerts WHERE user_id = ? ORDER BY sent_at DESC LIMIT ?').all(userId, limit) as AlertRecord[];
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
  },

  createTelegramLinkToken(token: string, userId: string, expiresAt: number) {
    db.prepare(`
      INSERT INTO telegram_link_tokens (token, user_id, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, expires_at = excluded.expires_at
    `).run(token, userId, expiresAt);
  },

  findTelegramLinkToken(token: string): { token: string; user_id: string; expires_at: number } | undefined {
    return db.prepare('SELECT * FROM telegram_link_tokens WHERE token = ?').get(token) as { token: string; user_id: string; expires_at: number } | undefined;
  },

  deleteTelegramLinkToken(token: string) {
    db.prepare('DELETE FROM telegram_link_tokens WHERE token = ?').run(token);
  },

  deleteExpiredTelegramLinkTokens() {
    const now = Date.now();
    db.prepare('DELETE FROM telegram_link_tokens WHERE expires_at < ?').run(now);
  }
};

export default db;

