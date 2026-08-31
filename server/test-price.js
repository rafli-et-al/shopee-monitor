const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9',
};

axios.get('https://shopee.co.id/product/192013652/53556643718', { headers: HEADERS, timeout: 15000 })
  .then(r => {
    const html = r.data;

    const priceRp = html.match(/Rp[\s\S]{0,5}202[,.]?000/g);
    console.log('Rp price matches:', priceRp ? priceRp.slice(0,5) : 'NONE');

    const priceNum = html.match(/"price"\s*:\s*(\d+)/g);
    console.log('JSON price fields:', priceNum ? priceNum.slice(0,10) : 'NONE');

    const priceMin = html.match(/"price_min"\s*:\s*(\d+)/g);
    console.log('JSON price_min fields:', priceMin ? priceMin.slice(0,10) : 'NONE');

    const storeMatch = html.match(/window\.__STORE__\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/s);
    console.log('Has __STORE__:', !!storeMatch);

    const removed = html.match(/removed_fields.*?]/);
    console.log('removed_fields:', removed ? removed[0].slice(0, 200) : 'NONE');
  });
