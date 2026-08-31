import axios from 'axios';

export interface ScrapedVariant {
  model_id: string;
  name: string;
  price: number;
  stock: number;
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

export class ScraperService {
  static parseShopeeUrl(url: string): { shopId: string; itemId: string } | null {
    try {
      const cleanUrl = url.trim();

      const format1 = cleanUrl.match(/-i\.(\d+)\.(\d+)/);
      if (format1) {
        return { shopId: format1[1], itemId: format1[2] };
      }

      const format2 = cleanUrl.match(/product\/(\d+)\/(\d+)/);
      if (format2) {
        return { shopId: format2[1], itemId: format2[2] };
      }

      const urlObj = new URL(cleanUrl);
      const pathname = urlObj.pathname;

      const dotMatch = pathname.match(/\.(\d+)\.(\d+)$/);
      if (dotMatch) {
        return { shopId: dotMatch[1], itemId: dotMatch[2] };
      }

      const redirParam = urlObj.searchParams.get('redir');
      if (redirParam) {
        return this.parseShopeeUrl(decodeURIComponent(redirParam));
      }

      return null;
    } catch {
      return null;
    }
  }

  static async fetchItemDetails(shopId: string, itemId: string, originalUrl?: string): Promise<ScrapedItem> {
    const targetUrl = originalUrl || `https://shopee.co.id/product/${shopId}/${itemId}`;

    const headers = {
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

    try {
      const response = await axios.get(targetUrl, {
        headers,
        timeout: 12000,
        validateStatus: () => true
      });

      if (response.status === 200 && response.data) {
        const html = String(response.data);
        const scriptMatches = html.matchAll(/<script\b[^>]*>(.*?)<\/script>/gs);

        let pdpItem: any = null;
        let pdpPrice: any = null;

        for (const match of scriptMatches) {
          const scriptContent = match[1];
          if (
            scriptContent.includes('PDP_BFF_DATA') ||
            (scriptContent.includes('initialState') && scriptContent.includes(itemId))
          ) {
            try {
              const json = JSON.parse(scriptContent);
              const cachedMap = json?.initialState?.DOMAIN_PDP?.data?.PDP_BFF_DATA?.cachedMap;
              const pdpKey = `${shopId}/${itemId}`;
              const pdpData = cachedMap?.[pdpKey] || Object.values(cachedMap || {})[0];

              if (pdpData) {
                pdpItem = pdpData.item || pdpData;
                pdpPrice = pdpData.product_price || pdpData.price;
                break;
              }
            } catch {}
          }
        }

        if (pdpItem) {
          const title = pdpItem.title || pdpItem.name || 'Shopee Product';
          const imageId = pdpItem.image || (pdpItem.images && pdpItem.images[0]);
          const image = imageId ? `https://down-id.img.susercontent.com/file/${imageId}` : null;

          let basePrice = 0;
          if (pdpPrice?.price) {
            basePrice = pdpPrice.price > 100000000 ? Math.round(pdpPrice.price / 100000) : pdpPrice.price;
          } else if (pdpItem.price) {
            basePrice = pdpItem.price > 100000000 ? Math.round(pdpItem.price / 100000) : pdpItem.price;
          }

          const variants: ScrapedVariant[] = [];

          if (Array.isArray(pdpItem.models) && pdpItem.models.length > 0) {
            for (const m of pdpItem.models) {
              const modelId = String(m.model_id || m.modelid || m.name);
              const name = m.name || 'Default Variant';

              const isUnavailable = m.is_clickable === false || m.is_grayout === true || m.status === 0;
              const stock = isUnavailable ? 0 : Number(m.stock ?? m.normal_stock ?? 0);

              let modelPrice = basePrice;
              if (m.price) {
                modelPrice = m.price > 100000000 ? Math.round(m.price / 100000) : m.price;
              }

              variants.push({
                model_id: modelId,
                name,
                price: modelPrice,
                stock
              });
            }
          } else {
            const isUnavailable = pdpItem.status === 0 || pdpItem.is_unavailable === true;
            const stock = isUnavailable ? 0 : Number(pdpItem.stock ?? pdpItem.normal_stock ?? 0);
            variants.push({
              model_id: 'default',
              name: 'Default',
              price: basePrice,
              stock
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
        }
      }

      return this.fetchItemFallback(shopId, itemId, originalUrl);
    } catch {
      return this.fetchItemFallback(shopId, itemId, originalUrl);
    }
  }

  private static fetchItemFallback(shopId: string, itemId: string, originalUrl?: string): ScrapedItem {
    return {
      shop_id: shopId,
      item_id: itemId,
      name: `Shopee Product (${shopId}/${itemId})`,
      image: null,
      url: originalUrl || `https://shopee.co.id/product/${shopId}/${itemId}`,
      price: 0,
      variants: [
        {
          model_id: 'default',
          name: 'Main Variant',
          price: 0,
          stock: 0
        }
      ]
    };
  }
}
