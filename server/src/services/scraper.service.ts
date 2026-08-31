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
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

function extractPriceFromStore(html: string): number {
  const storeMatch = html.match(/window\.__STORE__\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/s);
  if (storeMatch) {
    try {
      const storeJson = JSON.parse(JSON.parse(storeMatch[1]));
      const price =
        storeJson?.pdpReducer?.itemInfo?.item?.price ||
        storeJson?.pdpReducer?.itemInfo?.item?.price_min ||
        storeJson?.product?.price ||
        storeJson?.product?.price_min;
      if (price && price > 0) {
        return price > 100000000 ? Math.round(price / 100000) : price;
      }
    } catch {}
  }

  const priceInScripts = html.match(/"price"\s*:\s*(\d{7,})/g);
  if (priceInScripts) {
    for (const match of priceInScripts) {
      const val = Number(match.replace(/"price"\s*:\s*/, ''));
      if (val > 10000000) {
        return Math.round(val / 100000);
      }
    }
  }

  return 0;
}

function extractPdpData(html: string, shopId: string, itemId: string): { item: any; pdpPrice: any } | null {
  const scriptMatches = html.matchAll(/<script\b[^>]*>(.*?)<\/script>/gs);

  for (const match of scriptMatches) {
    const content = match[1];
    if (
      content.includes('PDP_BFF_DATA') ||
      (content.includes('initialState') && content.includes(itemId))
    ) {
      try {
        const json = JSON.parse(content);
        const cachedMap = json?.initialState?.DOMAIN_PDP?.data?.PDP_BFF_DATA?.cachedMap;
        const pdpKey = `${shopId}/${itemId}`;
        const pdpData = cachedMap?.[pdpKey] || Object.values(cachedMap || {})[0];
        if (pdpData?.item) {
          return { item: pdpData.item, pdpPrice: pdpData.product_price };
        }
      } catch {}
    }
  }
  return null;
}

export class ScraperService {
  static parseShopeeUrl(url: string): { shopId: string; itemId: string } | null {
    try {
      const clean = url.trim();

      const fmt1 = clean.match(/-i\.(\d+)\.(\d+)/);
      if (fmt1) return { shopId: fmt1[1], itemId: fmt1[2] };

      const fmt2 = clean.match(/product\/(\d+)\/(\d+)/);
      if (fmt2) return { shopId: fmt2[1], itemId: fmt2[2] };

      const urlObj = new URL(clean);
      const dotMatch = urlObj.pathname.match(/\.(\d+)\.(\d+)$/);
      if (dotMatch) return { shopId: dotMatch[1], itemId: dotMatch[2] };

      const redir = urlObj.searchParams.get('redir');
      if (redir) return this.parseShopeeUrl(decodeURIComponent(redir));

      return null;
    } catch {
      return null;
    }
  }

  static async fetchItemDetails(shopId: string, itemId: string, originalUrl?: string): Promise<ScrapedItem> {
    const targetUrl = originalUrl || `https://shopee.co.id/product/${shopId}/${itemId}`;

    try {
      const response = await axios.get(targetUrl, {
        headers: BROWSER_HEADERS,
        timeout: 15000,
        validateStatus: () => true
      });

      if (response.status !== 200 || !response.data) {
        return this.fallback(shopId, itemId, targetUrl);
      }

      const html = String(response.data);
      const pdpData = extractPdpData(html, shopId, itemId);

      if (!pdpData) return this.fallback(shopId, itemId, targetUrl);

      const { item } = pdpData;

      const title = item.title || item.name || 'Shopee Product';
      const imageId = item.image || (item.images?.[0]);
      const image = imageId ? `https://down-id.img.susercontent.com/file/${imageId}` : null;

      const basePrice = extractPriceFromStore(html);
      const variants: ScrapedVariant[] = [];

      if (Array.isArray(item.models) && item.models.length > 0) {
        for (const m of item.models) {
          const modelId = String(m.model_id || m.modelid || m.name);
          const name = m.name || 'Default Variant';
          const available = m.is_clickable !== false && m.is_grayout !== true && m.status !== 0;
          const stock = available ? Number(m.stock ?? m.normal_stock ?? 0) : 0;

          let modelPrice = basePrice;
          if (m.price && m.price > 0) {
            modelPrice = m.price > 100000000 ? Math.round(m.price / 100000) : m.price;
          }

          variants.push({ model_id: modelId, name, price: modelPrice, stock, available });
        }
      } else {
        const available = !item.is_unavailable && item.status !== 0;
        const stock = available ? Number(item.stock ?? item.normal_stock ?? 0) : 0;
        variants.push({
          model_id: 'default',
          name: 'Default',
          price: basePrice,
          stock,
          available
        });
      }

      return {
        shop_id: shopId,
        item_id: itemId,
        name: title,
        image,
        url: targetUrl,
        price: basePrice,
        variants
      };
    } catch {
      return this.fallback(shopId, itemId, targetUrl);
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
