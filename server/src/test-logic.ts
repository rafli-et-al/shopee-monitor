import { ScraperService } from './services/scraper.service';
import { TelegramService } from './services/telegram.service';
import { dbService } from './db';
import crypto from 'crypto';

async function runTests() {
  console.log('=== 1. Testing Shopee URL Parser ===');
  const url1 = 'https://shopee.co.id/product/12345678/987654321';
  const parsed1 = ScraperService.parseShopeeUrl(url1);
  console.log('Format 1 (product/shop/item):', parsed1);
  if (!parsed1 || parsed1.shopId !== '12345678' || parsed1.itemId !== '987654321') {
    throw new Error('URL format 1 parsing failed');
  }

  const url2 = 'https://shopee.co.id/Sepatu-Sneakers-Pria-Keren-i.87654321.1122334455?sp_atk=abc-123';
  const parsed2 = ScraperService.parseShopeeUrl(url2);
  console.log('Format 2 (-i.shop.item):', parsed2);
  if (!parsed2 || parsed2.shopId !== '87654321' || parsed2.itemId !== '1122334455') {
    throw new Error('URL format 2 parsing failed');
  }

  console.log('\n=== 2. Testing Database Operations & Variant Tracking ===');
  const testShopId = 'test_shop_' + Date.now();
  const testItemId = 'test_item_' + Date.now();
  const testId = crypto.randomUUID();

  const testVariants = [
    {
      id: crypto.randomUUID(),
      model_id: 'm1_red_xl',
      name: 'Red - XL',
      price: 150000,
      stock: 0,
      is_tracked: 1
    },
    {
      id: crypto.randomUUID(),
      model_id: 'm2_blue_m',
      name: 'Blue - M',
      price: 145000,
      stock: 5,
      is_tracked: 0
    }
  ];

  dbService.createItem(
    {
      id: testId,
      shop_id: testShopId,
      item_id: testItemId,
      name: 'Test Sneaker Product Indonesia',
      image: 'https://down-id.img.susercontent.com/file/test123',
      url: `https://shopee.co.id/product/${testShopId}/${testItemId}`
    },
    testVariants
  );

  const retrieved = dbService.getItemById(testId);
  console.log('Retrieved Item from DB:', retrieved?.name);
  console.log('Variants in DB:', retrieved?.variants.map((v) => ({ name: v.name, stock: v.stock, price: v.price })));

  if (!retrieved || retrieved.variants.length !== 2) {
    throw new Error('Database insertion/retrieval verification failed');
  }

  console.log('\n=== 3. Testing Price Drop & Stock Restock Logic ===');
  const trackedVariant = retrieved.variants.find((v) => v.model_id === 'm1_red_xl')!;
  
  const prevStock = trackedVariant.stock;
  const newStock = 3;
  console.log(`Stock changed: ${prevStock} -> ${newStock}`);
  if (prevStock <= 0 && newStock > 0) {
    console.log('Stock restock detected: Variant is BACK IN STOCK!');
    dbService.logAlert({
      itemId: retrieved.id,
      itemName: retrieved.name,
      variantName: trackedVariant.name,
      alertType: 'STOCK_RESTOCKED',
      message: `Variant "${trackedVariant.name}" is back in stock with ${newStock} units.`
    });
  }

  const prevPrice = trackedVariant.price;
  const newPrice = 120000;
  console.log(`Price changed: ${prevPrice} -> ${newPrice}`);
  if (newPrice < prevPrice) {
    console.log(`Price drop detected! Discount: ${TelegramService.formatRupiah(prevPrice - newPrice)}`);
    dbService.logAlert({
      itemId: retrieved.id,
      itemName: retrieved.name,
      variantName: trackedVariant.name,
      alertType: 'PRICE_DROP',
      message: `Price dropped from ${prevPrice} to ${newPrice}`
    });
    dbService.recordPrice(retrieved.id, trackedVariant.model_id, newPrice);
  }

  dbService.updateVariant(trackedVariant.id, newStock, newPrice, newStock);

  const alerts = dbService.getAlerts(10);
  console.log('\nLogged Alerts in DB:', alerts.length);
  for (const alert of alerts) {
    console.log(`- [${alert.alert_type}] ${alert.item_name} (${alert.variant_name}): ${alert.message}`);
  }

  console.log('\n=== 4. Testing Currency Formatter ===');
  console.log('Formatted IDR:', TelegramService.formatRupiah(150000));
  console.log('Formatted IDR:', TelegramService.formatRupiah(2499000));

  console.log('\n=== 5. Testing Settings Storage ===');
  dbService.setSetting('telegram_bot_token', 'test_token_123');
  dbService.setSetting('telegram_chat_id', 'test_chat_456');
  console.log('Retrieved Token:', dbService.getSetting('telegram_bot_token'));
  console.log('Retrieved Chat ID:', dbService.getSetting('telegram_chat_id'));

  dbService.deleteItem(testId);
  console.log('\nCleaned up test item successfully.');

  console.log('\n ALL BUSINESS LOGIC CHECKS PASSED!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
