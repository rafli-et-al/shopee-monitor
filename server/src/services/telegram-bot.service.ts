import axios from 'axios';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { dbService } from '../db';
import { TelegramService } from './telegram.service';

export class TelegramBotListener {
  private static isRunning = false;
  private static shouldStop = false;
  private static lastUpdateId = 0;
  private static pollTimer: NodeJS.Timeout | null = null;

  static start(): void {
    if (process.env.ENABLE_TELEGRAM_BOT_POLLING === 'false') {
      return;
    }
    if (this.isRunning) return;
    this.shouldStop = false;
    this.isRunning = true;
    this.pollLoop();
  }

  static stop(): void {
    this.shouldStop = true;
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  static restart(): void {
    this.stop();
    setTimeout(() => {
      this.start();
    }, 500);
  }

  private static async pollLoop(): Promise<void> {
    if (this.shouldStop) {
      this.isRunning = false;
      return;
    }

    const token = TelegramService.getBotToken();
    if (!token) {
      this.pollTimer = setTimeout(() => this.pollLoop(), 10000);
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates`;
      const params: Record<string, any> = {
        timeout: 10,
        allowed_updates: ['message']
      };

      if (this.lastUpdateId > 0) {
        params.offset = this.lastUpdateId;
      }

      const response = await axios.get(url, { params, timeout: 15000 });

      if (response.data && response.data.ok && Array.isArray(response.data.result)) {
        for (const update of response.data.result) {
          this.lastUpdateId = update.update_id + 1;
          await this.handleUpdate(update);
        }
      }

      if (!this.shouldStop) {
        this.pollTimer = setTimeout(() => this.pollLoop(), 1000);
      }
    } catch (err: any) {
      const waitTime = err.response?.status === 409 ? 60000 : (err.response?.status === 401 || err.response?.status === 404 ? 30000 : 5000);
      if (!this.shouldStop) {
        this.pollTimer = setTimeout(() => this.pollLoop(), waitTime);
      }
    }
  }

  private static async handleUpdate(update: any): Promise<void> {
    const message = update.message;
    if (!message || !message.text) return;

    const text = message.text.trim();
    const chatId = String(message.chat.id);

    let token = '';
    if (text.startsWith('/start') || text.startsWith('/link')) {
      const cleaned = text.replace(/^(\/start|\/link)[=\s]*/i, '').trim();
      token = cleaned.split(/\s+/)[0] || '';
    } else if (/^[a-zA-Z0-9_-]{4,32}$/.test(text)) {
      token = text;
    } else {
      const match = text.match(/\b\d{6}\b/);
      if (match) {
        token = match[0];
      }
    }

    if (!token) {
      if (text.startsWith('/start')) {
        await TelegramService.sendMessage(
          chatId,
          `👋 <b>Shopee Monitor Bot</b>\n\nTo link your Telegram chat to Shopee Monitor, please send your 6-digit code from your dashboard settings (e.g. <code>123456</code>).`
        );
      }
      return;
    }

    dbService.deleteExpiredTelegramLinkTokens();
    let linkRecord = dbService.findTelegramLinkToken(token) || dbService.findTelegramLinkToken('link_' + token);
    let updateUserChatId = (uid: string, cid: string) => dbService.updateUserTelegramChatId(uid, cid);
    let findUser = (uid: string) => dbService.findUserById(uid);
    let deleteToken = (tok: string) => dbService.deleteTelegramLinkToken(tok);

    if (!linkRecord) {
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
      const candidatePaths = [
        path.join(dataDir, 'qa/shopee_monitor.db'),
        path.join(dataDir, '../shopee_monitor.db'),
        path.join(dataDir, 'shopee_monitor.db')
      ];

      for (const candPath of candidatePaths) {
        if (fs.existsSync(candPath)) {
          let extDb: any = null;
          try {
            extDb = new Database(candPath);
            const row = extDb.prepare('SELECT * FROM telegram_link_tokens WHERE token = ? OR token = ?').get(token, 'link_' + token) as any;
            if (row) {
              linkRecord = row;
              findUser = (uid: string) => {
                const d = new Database(candPath);
                try { return d.prepare('SELECT * FROM users WHERE id = ?').get(uid) as any; }
                finally { d.close(); }
              };
              updateUserChatId = (uid: string, cid: string) => {
                const d = new Database(candPath);
                try { d.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(cid, uid); }
                finally { d.close(); }
              };
              deleteToken = (tok: string) => {
                const d = new Database(candPath);
                try { d.prepare('DELETE FROM telegram_link_tokens WHERE token = ?').run(tok); }
                finally { d.close(); }
              };
              break;
            }
          } catch {
          } finally {
            if (extDb) {
              try { extDb.close(); } catch {}
            }
          }
        }
      }
    }

    if (!linkRecord) {
      await TelegramService.sendMessage(
        chatId,
        `⚠️ <b>Code not found or expired.</b>\n\nPlease check the pairing code on your dashboard and try again.`
      );
      return;
    }

    if (linkRecord.expires_at < Date.now()) {
      deleteToken(token);
      await TelegramService.sendMessage(
        chatId,
        `⌛ <b>Pairing code expired.</b>\n\nPlease generate a new code from your dashboard.`
      );
      return;
    }

    const user = findUser(linkRecord.user_id);
    if (!user) {
      deleteToken(token);
      return;
    }

    updateUserChatId(user.id, chatId);
    deleteToken(token);
    deleteToken(linkRecord.token);

    await TelegramService.sendMessage(
      chatId,
      `🎉 <b>Shopee Monitor Connected!</b>\n\nYour Telegram chat has been successfully linked to account <b>@${user.username}</b>.\nYou will now receive instant stock replenishment alerts here.`
    );
  }
}
