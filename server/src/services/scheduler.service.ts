import cron from 'node-cron';
import { dbService } from '../db';
import { ScraperService } from './scraper.service';
import { TelegramService } from './telegram.service';

export class SchedulerService {
  private static stockTask: cron.ScheduledTask | null = null;
  private static priceTask: cron.ScheduledTask | null = null;

  static init() {
    const stockCron = dbService.getSetting('stock_cron') || process.env.STOCK_CHECK_CRON || '0 */6 * * *';
    const priceCron = dbService.getSetting('price_cron') || process.env.PRICE_CHECK_CRON || '0 * * * *';

    if (cron.validate(stockCron)) {
      this.stockTask = cron.schedule(stockCron, () => {
        this.runStockCheck();
      });
    }

    if (cron.validate(priceCron)) {
      this.priceTask = cron.schedule(priceCron, () => {
        this.runPriceCheck();
      });
    }
  }

  static restart() {
    if (this.stockTask) this.stockTask.stop();
    if (this.priceTask) this.priceTask.stop();
    this.init();
  }

  static async checkItem(itemId: string): Promise<boolean> {
    const item = dbService.getItemById(itemId);
    if (!item) return false;

    try {
      const scraped = await ScraperService.fetchItemDetails(item.shop_id, item.item_id, item.url);
      const scrapedVariantsMap = new Map(scraped.variants.map((v) => [v.model_id, v]));

      for (const variant of item.variants) {
        if (!variant.is_tracked) continue;

        const freshVariant = scrapedVariantsMap.get(variant.model_id) || scraped.variants.find((v) => v.name === variant.name);
        if (!freshVariant) continue;

        const prevStock = variant.stock;
        const newStock = freshVariant.stock;
        const prevPrice = variant.price;
        const newPrice = freshVariant.price;

        if (prevStock <= 0 && newStock > 0) {
          const sent = await TelegramService.sendStockAlert({
            itemName: item.name,
            variantName: variant.name,
            stock: newStock,
            price: newPrice || prevPrice,
            url: item.url,
            imageUrl: item.image
          });

          if (sent) {
            dbService.logAlert({
              itemId: item.id,
              itemName: item.name,
              variantName: variant.name,
              alertType: 'STOCK_RESTOCKED',
              message: `Variant "${variant.name}" is back in stock with ${newStock} units.`
            });
          }
        }

        if (prevPrice > 0 && newPrice > 0 && newPrice < prevPrice) {
          const sent = await TelegramService.sendPriceAlert({
            itemName: item.name,
            variantName: variant.name,
            oldPrice: prevPrice,
            newPrice: newPrice,
            url: item.url,
            imageUrl: item.image
          });

          if (sent) {
            dbService.logAlert({
              itemId: item.id,
              itemName: item.name,
              variantName: variant.name,
              alertType: 'PRICE_DROP',
              message: `Price dropped from ${prevPrice} to ${newPrice}`
            });
          }
        }

        if (newPrice > 0 && newPrice !== prevPrice) {
          dbService.recordPrice(item.id, variant.model_id, newPrice);
        }

        dbService.updateVariant(variant.id, newStock, newPrice, newStock > 0 ? newStock : variant.last_notified_stock);
      }

      dbService.updateItemLastChecked(item.id);
      return true;
    } catch {
      return false;
    }
  }

  static async runStockCheck() {
    const items = dbService.getAllItems().filter((item) => item.is_active === 1);
    for (const item of items) {
      await this.checkItem(item.id);
      await new Promise((resolve) => setTimeout(resolve, 3000 + Math.random() * 2000));
    }
  }

  static async runPriceCheck() {
    const items = dbService.getAllItems().filter((item) => item.is_active === 1);
    for (const item of items) {
      await this.checkItem(item.id);
      await new Promise((resolve) => setTimeout(resolve, 3000 + Math.random() * 2000));
    }
  }
}
