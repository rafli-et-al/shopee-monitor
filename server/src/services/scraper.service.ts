import axios from 'axios';

export interface ScrapedVariant {
  model_id: string;
  name: string;
  stock: number;
  available: boolean;
}

export interface ScrapedItem {
  shop_id: string;
  item_id: string;
  name: string;
  image: string | null;
  url: string;
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
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

function extractPdpData(html: string): any | null {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];

  for (const match of scripts) {
    const content = match[1];
    if (!content.includes('PDP_BFF_DATA')) continue;

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('window.__STORE__=')) {
        jsonStr = jsonStr.replace(/^window\.__STORE__=\s*/, '').replace(/;$/, '');
      }

      const parsed = JSON.parse(jsonStr);
      const cachedMap =
        parsed?.initialState?.DOMAIN_PDP?.data?.PDP_BFF_DATA?.cachedMap ||
        parsed?.DOMAIN_PDP?.data?.PDP_BFF_DATA?.cachedMap;

      if (!cachedMap) continue;

      const keys = Object.keys(cachedMap);
      if (keys.length === 0) continue;

      for (const k of keys) {
        if (cachedMap[k]?.item) {
          return cachedMap[k];
        }
      }
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
    const canonicalUrl = `https://shopee.co.id/product/${shopId}/${itemId}`;

    let lastError = 'Unknown error';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.get(canonicalUrl, {
          headers: BROWSER_HEADERS,
          timeout: 15000,
          validateStatus: () => true
        });

        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = String(response.data);
        const pdpData = extractPdpData(html);

        if (!pdpData?.item) {
          throw new Error('Could not parse product page data from HTML');
        }

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
            const stock = available ? 1 : 0;

            variants.push({ model_id: modelId, name, stock, available });
          }
        } else if (Array.isArray(item.tier_variations) && item.tier_variations.length > 0 && item.tier_variations[0].options?.length > 0) {
          for (let i = 0; i < item.tier_variations[0].options.length; i++) {
            const opt = item.tier_variations[0].options[i];
            variants.push({
              model_id: `tier_${i}`,
              name: String(opt),
              stock: 1,
              available: true
            });
          }
        } else {
          const available = item.status !== 0;
          variants.push({ model_id: 'default', name: 'Default', stock: available ? 1 : 0, available });
        }

        return {
          shop_id: shopId,
          item_id: itemId,
          name: title,
          image,
          url: canonicalUrl,
          variants
        };
      } catch (err: any) {
        lastError = err.message;
        console.warn(`[Scraper] Attempt ${attempt}/3 failed for ${shopId}/${itemId}: ${lastError}`);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }

    console.error(`[Scraper] All attempts failed for ${shopId}/${itemId}: ${lastError}`);
    return this.fallback(shopId, itemId, canonicalUrl);
  }

  private static fallback(shopId: string, itemId: string, url: string): ScrapedItem {
    return {
      shop_id: shopId,
      item_id: itemId,
      name: `Shopee Product (${shopId}/${itemId})`,
      image: null,
      url,
      variants: [{ model_id: 'default', name: 'Main Variant', stock: 0, available: false }]
    };
  }
}
