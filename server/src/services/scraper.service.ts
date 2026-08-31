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
      const parts = pathname.split('/').filter(Boolean);

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
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ];
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    const headers = {
      'User-Agent': randomUserAgent,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': `https://shopee.co.id/product/${shopId}/${itemId}`,
      'X-Requested-With': 'XMLHttpRequest',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };

    const apiUrl = `https://shopee.co.id/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;

    try {
      const response = await axios.get(apiUrl, {
        headers,
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status === 200 && response.data && response.data.data) {
        const itemData = response.data.data;
        const name = itemData.name || 'Shopee Product';
        const imageId = itemData.image || (itemData.images && itemData.images[0]) || null;
        const image = imageId ? `https://down-id.img.susercontent.com/file/${imageId}` : null;

        let models: ScrapedVariant[] = [];
        if (Array.isArray(itemData.models) && itemData.models.length > 0) {
          models = itemData.models.map((m: any) => ({
            model_id: String(m.modelid || m.itemid || m.name),
            name: m.name || 'Default Variant',
            price: m.price ? (m.price > 100000000 ? Math.round(m.price / 100000) : m.price) : 0,
            stock: Number(m.stock ?? m.normal_stock ?? 0)
          }));
        } else {
          const rawPrice = itemData.price || itemData.price_min || 0;
          const normalPrice = rawPrice > 100000000 ? Math.round(rawPrice / 100000) : rawPrice;
          models = [
            {
              model_id: 'default',
              name: 'Default',
              price: normalPrice,
              stock: Number(itemData.stock ?? itemData.normal_stock ?? 0)
            }
          ];
        }

        const rawMainPrice = itemData.price || itemData.price_min || 0;
        const mainPrice = rawMainPrice > 100000000 ? Math.round(rawMainPrice / 100000) : rawMainPrice;

        return {
          shop_id: shopId,
          item_id: itemId,
          name,
          image,
          url: originalUrl || `https://shopee.co.id/product/${shopId}/${itemId}`,
          price: mainPrice,
          variants: models
        };
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
