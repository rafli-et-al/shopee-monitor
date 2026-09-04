import axios from 'axios';
import { dbService } from '../db';
import { TelegramService } from './telegram.service';

export class TelegramBotListener {
  private static isRunning = false;
  private static shouldStop = false;
  private static lastUpdateId = 0;
  private static pollTimer: NodeJS.Timeout | null = null;

  static start(): void {
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
      const waitTime = err.response?.status === 401 || err.response?.status === 404 ? 30000 : 5000;
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
      const parts = text.split(/\s+/);
      token = parts[1] || '';
    } else if (/^[a-zA-Z0-9_-]{4,32}$/.test(text)) {
      token = text;
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
    const linkRecord = dbService.findTelegramLinkToken(token) || dbService.findTelegramLinkToken('link_' + token);

    if (!linkRecord) {
      await TelegramService.sendMessage(
        chatId,
        `⚠️ <b>Code not found or expired.</b>\n\nPlease check the pairing code on your dashboard and try again.`
      );
      return;
    }

    if (linkRecord.expires_at < Date.now()) {
      dbService.deleteTelegramLinkToken(token);
      await TelegramService.sendMessage(
        chatId,
        `⌛ <b>Pairing code expired.</b>\n\nPlease generate a new code from your dashboard.`
      );
      return;
    }

    const user = dbService.findUserById(linkRecord.user_id);
    if (!user) {
      dbService.deleteTelegramLinkToken(token);
      return;
    }

    dbService.updateUserTelegramChatId(user.id, chatId);
    dbService.deleteTelegramLinkToken(token);
    dbService.deleteTelegramLinkToken(linkRecord.token);

    await TelegramService.sendMessage(
      chatId,
      `🎉 <b>Shopee Monitor Connected!</b>\n\nYour Telegram chat has been successfully linked to account <b>@${user.username}</b>.\nYou will now receive instant stock replenishment alerts here.`
    );
  }
}
