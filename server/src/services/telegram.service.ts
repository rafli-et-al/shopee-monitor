import axios from 'axios';
import { dbService } from '../db';

export class TelegramService {
  private static getCredentials(): { botToken: string; chatId: string } {
    const dbToken = dbService.getSetting('telegram_bot_token');
    const dbChatId = dbService.getSetting('telegram_chat_id');

    const botToken = (dbToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = (dbChatId || process.env.TELEGRAM_CHAT_ID || '').trim();

    return { botToken, chatId };
  }

  static getBotToken(): string {
    return this.getCredentials().botToken;
  }

  static async getBotInfo(): Promise<{ username: string; firstName: string } | null> {
    const token = this.getBotToken();
    if (!token) return null;
    try {
      const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 8000 });
      if (res.data && res.data.ok && res.data.result) {
        return {
          username: res.data.result.username,
          firstName: res.data.result.first_name
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  static async sendMessage(chatId: string, text: string, parseMode: string = 'HTML'): Promise<boolean> {
    const token = this.getBotToken();
    if (!token || !chatId) return false;
    try {
      const res = await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: chatId,
          text,
          parse_mode: parseMode
        },
        { timeout: 8000 }
      );
      return !!(res.data && res.data.ok);
    } catch {
      return false;
    }
  }

  static async testConnection(botToken?: string, chatId?: string): Promise<{ success: boolean; message: string }> {
    const creds = this.getCredentials();
    const token = (botToken || creds.botToken).trim();
    const chat = (chatId || creds.chatId).trim();

    if (!token || !chat) {
      return {
        success: false,
        message: 'Telegram Bot Token and Chat ID are required.'
      };
    }

    try {
      const text = `🎉 <b>Shopee Stock Monitor Connected!</b>\n\nYour Telegram Bot is successfully configured.\nYou will receive real-time notifications when out-of-stock items and variants are replenished.`;

      const response = await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: chat,
          text,
          parse_mode: 'HTML'
        },
        { timeout: 8000 }
      );

      if (response.data && response.data.ok) {
        return {
          success: true,
          message: 'Test notification sent successfully!'
        };
      }

      return {
        success: false,
        message: response.data.description || 'Failed to send message to Telegram.'
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.description || error.message || 'Telegram API request failed.';
      return {
        success: false,
        message: errorMsg
      };
    }
  }

  static async sendStockAlert(params: {
    itemName: string;
    variantName: string;
    stock: number;
    url: string;
    imageUrl?: string | null;
    chatId?: string | null;
  }): Promise<boolean> {
    const { botToken, chatId: defaultChatId } = this.getCredentials();
    const targetChat = (params.chatId || defaultChatId || '').trim();
    if (!botToken || !targetChat) return false;

    const caption = `🚨 <b>ITEM BACK IN STOCK!</b>\n\n` +
      `📦 <b>Product:</b> ${escapeHtml(params.itemName)}\n` +
      `🏷️ <b>Variant:</b> ${escapeHtml(params.variantName)}\n` +
      `📊 <b>Status:</b> <b>In Stock / Available</b>\n\n` +
      `🔗 <a href="${params.url}">👉 Click here to buy on Shopee</a>`;

    try {
      if (params.imageUrl) {
        await axios.post(
          `https://api.telegram.org/bot${botToken}/sendPhoto`,
          {
            chat_id: targetChat,
            photo: params.imageUrl,
            caption,
            parse_mode: 'HTML'
          },
          { timeout: 10000 }
        );
      } else {
        await axios.post(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            chat_id: targetChat,
            text: caption,
            parse_mode: 'HTML',
            disable_web_page_preview: false
          },
          { timeout: 10000 }
        );
      }
      return true;
    } catch {
      try {
        await axios.post(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            chat_id: targetChat,
            text: caption,
            parse_mode: 'HTML'
          },
          { timeout: 10000 }
        );
        return true;
      } catch {
        return false;
      }
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
