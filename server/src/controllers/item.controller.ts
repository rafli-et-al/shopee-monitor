import { Request, Response } from 'express';
import { dbService } from '../db';
import { ScraperService } from '../services/scraper.service';
import { TelegramService } from '../services/telegram.service';
import { SchedulerService } from '../services/scheduler.service';
import crypto from 'crypto';

export class ItemController {
  static async previewItem(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Valid Shopee URL is required.' });
        return;
      }

      const parsed = ScraperService.parseShopeeUrl(url);
      if (!parsed) {
        res.status(400).json({
          error: 'Could not extract Shop ID and Item ID from URL. Please provide a standard Shopee Indonesia product link (e.g., https://shopee.co.id/product/123/456 or ...-i.123.456).'
        });
        return;
      }

      const itemDetails = await ScraperService.fetchItemDetails(parsed.shopId, parsed.itemId, url);
      if (!itemDetails.image && itemDetails.name.startsWith('Shopee Product (')) {
        res.status(502).json({
          error: 'Shopee temporarily blocked the request or the product could not be fetched. Please try clicking Fetch again.'
        });
        return;
      }

      res.json({
        success: true,
        data: itemDetails
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to preview item.' });
    }
  }

  static async createItem(req: Request, res: Response): Promise<void> {
    try {
      const { shop_id, item_id, name, image, url, variants } = req.body;

      if (!shop_id || !item_id || !name || !url) {
        res.status(400).json({ error: 'Missing required item properties.' });
        return;
      }

      const existing = dbService.findItemByShopAndItem(shop_id, item_id);
      if (existing) {
        res.status(409).json({ error: 'This item is already being tracked.', itemId: existing.id });
        return;
      }

      const itemId = crypto.randomUUID();
      const variantList = Array.isArray(variants) ? variants : [];

      const formattedVariants = variantList.map((v: any) => ({
        id: crypto.randomUUID(),
        model_id: String(v.model_id || v.name),
        name: v.name || 'Default',
        stock: Number(v.stock) || 0,
        is_tracked: v.is_tracked !== undefined ? (v.is_tracked ? 1 : 0) : 1
      }));

      dbService.createItem(
        {
          id: itemId,
          shop_id,
          item_id,
          name,
          image: image || null,
          url
        },
        formattedVariants
      );

      const created = dbService.getItemById(itemId);
      res.status(201).json({ success: true, data: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save item.' });
    }
  }

  static async getItems(_req: Request, res: Response): Promise<void> {
    try {
      const items = dbService.getAllItems();
      res.json({ success: true, data: items });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to retrieve items.' });
    }
  }

  static async toggleItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const item = dbService.getItemById(id);
      if (!item) {
        res.status(404).json({ error: 'Item not found.' });
        return;
      }

      const nextStatus = item.is_active === 1 ? false : true;
      dbService.updateItemStatus(id, nextStatus);
      res.json({ success: true, is_active: nextStatus ? 1 : 0 });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update item status.' });
    }
  }

  static async deleteItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      dbService.deleteItem(id);
      res.json({ success: true, message: 'Item deleted successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete item.' });
    }
  }

  static async checkItemNow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await SchedulerService.checkItem(id);
      const updated = dbService.getItemById(id);
      res.json({ success: !result.error, data: updated, stockAlerts: result.stockAlerts, error: result.error });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to execute immediate check.' });
    }
  }

  static async getSettings(_req: Request, res: Response): Promise<void> {
    try {
      const settings = dbService.getAllSettings();
      const botToken = settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || '';
      const chatId = settings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';
      const checkCron = settings.check_cron || process.env.STOCK_CHECK_CRON || '0 * * * *';

      res.json({
        success: true,
        data: {
          telegram_bot_token: botToken,
          telegram_chat_id: chatId,
          check_cron: checkCron
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load settings.' });
    }
  }

  static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { telegram_bot_token, telegram_chat_id, check_cron } = req.body;

      if (telegram_bot_token !== undefined) {
        dbService.setSetting('telegram_bot_token', String(telegram_bot_token).trim());
      }
      if (telegram_chat_id !== undefined) {
        dbService.setSetting('telegram_chat_id', String(telegram_chat_id).trim());
      }
      if (check_cron !== undefined) {
        dbService.setSetting('check_cron', String(check_cron).trim());
      }

      SchedulerService.restart();

      res.json({ success: true, message: 'Settings updated and scheduler restarted.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save settings.' });
    }
  }

  static async testTelegram(req: Request, res: Response): Promise<void> {
    try {
      const { bot_token, chat_id } = req.body;
      const result = await TelegramService.testConnection(bot_token, chat_id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Telegram test failed.' });
    }
  }

  static async getAlerts(_req: Request, res: Response): Promise<void> {
    try {
      const alerts = dbService.getAlerts(100);
      res.json({ success: true, data: alerts });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load alerts.' });
    }
  }
}
