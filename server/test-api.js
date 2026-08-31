const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9',
};

axios.get('https://shopee.co.id/api/v4/pdp/get_pc?shop_id=192013652&item_id=53556643718', {
  headers: {
    ...HEADERS,
    'Referer': 'https://shopee.co.id/',
    'X-Api-Source': 'pc',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
  },
  timeout: 10000
}).then(r => {
  const d = r.data;
  console.log('Status:', r.status);
  console.log('Error:', d.error);
  const price = d?.data?.item?.price || d?.data?.price;
  console.log('Price:', price);
}).catch(e => {
  console.log('Failed:', e.response?.status, e.message);
});

axios.get('https://shopee.co.id/api/v4/item/get?shopid=192013652&itemid=53556643718', {
  headers: {
    ...HEADERS,
    'Referer': 'https://shopee.co.id/',
    'X-Api-Source': 'pc',
    'Accept': 'application/json',
  },
  timeout: 10000
}).then(r => {
  const d = r.data;
  console.log('v4 Status:', r.status);
  console.log('v4 Error:', d.error);
  const price = d?.item?.price || d?.item?.price_min;
  console.log('v4 Price:', price);
}).catch(e => {
  console.log('v4 Failed:', e.response?.status, e.message);
});
