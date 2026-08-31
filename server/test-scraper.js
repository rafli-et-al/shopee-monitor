const { ScraperService } = require('./dist/services/scraper.service');

ScraperService.fetchItemDetails('192013652', '53556643718').then(r => {
  console.log(JSON.stringify(r, null, 2));
}).catch(e => {
  console.error('Error:', e.message);
});
