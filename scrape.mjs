import cheerio from 'cheerio';
import fs from 'fs'

const test = ($) => {
  print()
  const title = $('title').text();
  return title;
}

function extractData(html) {
  fs.writeFile('extracted_data.html', html, (err) => {
    if (err) {
        console.error('Error writing file:', err);
    } else {
        console.log('HTML file created successfully!');
    }
});
  const $ = cheerio.load(html);
  console.log($('flex-row.margin-top-32').length);
  const result = [];

  // console.log("test", $('div.flex-row.flex-space-between.flex-align-center.margin-top-32.margin-bottom-16.margin-left-4.margin-right-4'));

  // Select all divs with the specified class
  $('div.flex-row.margin-top-32').each((index, element) => {
    console.log("index: ", index)
      const div = $(element);
      // console.log(div)

      // Extract name from the span inside the 'a' tag
      const name = div.find('a > span').text().trim();

      // Extract price, mcap, and pe from the spans inside the div
      const priceText = div.find('div > span.sub:nth-child(1) > .strong').text().replace('₹', '').replace(/,/g, '').trim();
      const price = parseFloat(priceText);

      const mcapText = div.find('div > span.sub:nth-child(2) > .strong').text().replace('₹', '').replace('Cr', '').replace(/,/g, '').trim();
      const mcap = parseFloat(mcapText) * 100; // Convert Crore to Millions

      const peText = div.find('div > span.sub:nth-child(3) > .strong').text().trim();
      const pe = parseFloat(peText);

      result.push({ name, price, mcap, pe });
  });

  return result;
}



export { test, extractData };