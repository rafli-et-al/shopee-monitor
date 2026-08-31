import axios from 'axios';

export interface ScrapedVariant {
  model_id: string;
  name: string;
  price: number;
  stock: number;
  available: boolean;
}

export interface ScrapedItem {
  shop_id: string;
  item_id: string;
  name: string;
  image: string | null;
  url: string;
  price: number;
  variants: ScrapedVariant[];
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1'
};

function extractPdpData(html: string): any | null {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];

  for (const match of scripts) {
    const content = match[1];
    if (!content.includes('PDP_BFF_DATA') || !content.includes('initialState')) continue;

    try {
      const parsed = JSON.parse(content);
      const cachedMap = parsed?.initialState?.DOMAIN_PDP?.data?.PDP_BFF_DATA?.cachedMap;
      if (!cachedMap) continue;

      const pdpKey = Object.keys(cachedMap)[0];
      const pdpData = cachedMap[pdpKey];
      if (pdpData?.item) return pdpData;
    } catch {}
  }
  return null;
}

export class ScraperService {
  static parseShopeeUrl(url: string): { shopId: string; itemId: string } | null {
    try {
      const clean = url.trim().split('?')[0];

      const fmt1 = clean.match(/-i\.?(\d+)\.(\d+)/);
      if (fmt1) return { shopId: fmt1[1], itemId: fmt1[2] };

      const fmt2 = clean.match(/product\/(\d+)\/(\d+)/);
      if (fmt2) return { shopId: fmt2[1], itemId: fmt2[2] };

      return null;
    } catch {
      return null;
    }
  }

  static async fetchItemDetails(shopId: string, itemId: string, _originalUrl?: string): Promise<ScrapedItem> {
    const cleanUrl = `https://shopee.co.id/product/${shopId}/${itemId}`;

    try {
      const response = await axios.get(cleanUrl, {
        headers: BROWSER_HEADERS,
        timeout: 15000,
        validateStatus: () => true
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = String(response.data);
      const pdpData = extractPdpData(html);

      if (!pdpData) throw new Error('Could not parse product page data');

      const item = pdpData.item;
      const title = item.title || item.name || `Shopee Product (${shopId}/${itemId})`;
      const imageId = item.image || item.images?.[0];
      const image = imageId ? `https://down-id.img.susercontent.com/file/${imageId}` : null;

      const variants: ScrapedVariant[] = [];

      if (Array.isArray(item.models) && item.models.length > 0) {
        for (const m of item.models) {
          const modelId = String(m.model_id ?? m.modelid ?? m.id ?? m.name);
          const name = m.name || 'Default';
          const available = m.is_clickable !== false && m.is_grayout !== true && m.status !== 0;
          const stock = available ? Number(m.stock ?? m.normal_stock ?? 10) : 0;

          variants.push({ model_id: modelId, name, price: 0, stock, available });
        }
      } else {
        const available = item.status !== 0;
        variants.push({ model_id: 'default', name: 'Default', price: 0, stock: available ? 10 : 0, available });
      }

      return { shop_id: shopId, item_id: itemId, name: title, image, url: cleanUrl, price: 0, variants };
    } catch (err: any) {
      console.error(`[Scraper] Failed for ${shopId}/${itemId}:`, err.message);
      return this.fallback(shopId, itemId, cleanUrl);
    }
  }

  private static fallback(shopId: string, itemId: string, url: string): ScrapedItem {
    return {
      shop_id: shopId,
      item_id: itemId,
      name: `Shopee Product (${shopId}/${itemId})`,
      image: null,
      url,
      price: 0,
      variants: [{ model_id: 'default', name: 'Main Variant', price: 0, stock: 0, available: false }]
    };
  }
}
