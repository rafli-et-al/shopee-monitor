const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9',
};

async function run() {
  const r = await axios.get('https://shopee.co.id/product/192013652/53556643718', { headers: HEADERS, timeout: 15000 });
  const html = r.data;

  // Look for any number near 202
  const ctx = html.match(/.{0,60}202[\.,]?000.{0,60}/g);
  console.log('202000 context:', ctx ? ctx.slice(0, 5) : 'NONE');

  // Look for any JSON structure that might have price as key with numeric value
  const jsonPrices = html.match(/"(?:price|harga|final_price|discounted_price|original_price)"\s*:\s*(\d+\.?\d*)/g);
  console.log('JSON price variants:', jsonPrices ? jsonPrices.slice(0, 15) : 'NONE');

  // Try seo_info script
  const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  console.log('LD+JSON scripts found:', scripts.length);
  for (const s of scripts) {
    console.log('LD+JSON:', s[1].slice(0, 300));
  }
}
run().catch(e => console.error(e.message));
