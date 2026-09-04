import cron from 'node-cron';
import { dbService } from '../db';
import { ScraperService } from './scraper.service';
import { TelegramService } from './telegram.service';

export class SchedulerService {
  private static task: cron.ScheduledTask | null = null;

  static init() {
    const interval = dbService.getSetting('check_cron') || process.env.STOCK_CHECK_CRON || '0 * * * *';

    if (!cron.validate(interval)) {
      console.warn(`Invalid cron expression: ${interval}. Defaulting to hourly.`);
    }

    const cronExpr = cron.validate(interval) ? interval : '0 * * * *';

    this.task = cron.schedule(cronExpr, () => {
      this.runCheck().catch(console.error);
    });

    console.log(`Scheduler initialized with cron: ${cronExpr}`);
  }

  static restart() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.init();
  }

  static async checkItem(itemId: string): Promise<{ stockAlerts: number; error?: string }> {
    const item = dbService.getItemById(itemId);
    if (!item) return { stockAlerts: 0, error: 'Item not found' };

    const owner = dbService.getItemOwner(itemId);
    let stockAlerts = 0;

    try {
      const scraped = await ScraperService.fetchItemDetails(item.shop_id, item.item_id, item.url);
      const scrapedMap = new Map(scraped.variants.map((v) => [v.model_id, v]));

      for (const variant of item.variants) {
        if (!variant.is_tracked) continue;

        const fresh = scrapedMap.get(variant.model_id) || scraped.variants.find((v) => v.name === variant.name);
        if (!fresh) continue;

        const wasOut = variant.stock === 0;
        const nowIn = fresh.available && fresh.stock > 0;

        if (wasOut && nowIn) {
          const sent = await TelegramService.sendStockAlert({
            itemName: item.name,
            variantName: variant.name,
            stock: fresh.stock,
            url: item.url,
            imageUrl: item.image,
            chatId: owner?.telegram_chat_id
          });

          dbService.logAlert({
            userId: owner?.user_id || null,
            itemId: item.id,
            itemName: item.name,
            variantName: variant.name,
            alertType: 'STOCK_RESTOCKED',
            message: `Variant "${variant.name}" is back in stock!`
          });

          if (sent) stockAlerts++;
        }

        dbService.updateVariant(
          variant.id,
          nowIn ? fresh.stock : 0
        );
      }

      dbService.updateItemLastChecked(item.id);
      return { stockAlerts };
    } catch (err: any) {
      console.error(`Check failed for item ${itemId}:`, err.message);
      return { stockAlerts: 0, error: err.message };
    }
  }

  static async runCheck() {
    const items = dbService.getAllActiveItems();
    console.log(`Running scheduled check for ${items.length} item(s)...`);

    for (const item of items) {
      const result = await this.checkItem(item.id);
      console.log(`Checked "${item.name}": ${result.stockAlerts} stock alerts`);
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));
    }
  }
}
