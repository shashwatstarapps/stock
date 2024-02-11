import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: false }); // Launch browser with headless mode off
  const page = await browser.newPage();
  console.log("page", page)

  // Navigate to the login page
  await page.goto('https://www.screener.in/login/?');

  // Check if the page contains the password input
  const passwordInput = await page.$('input[name="password"]');
  if (passwordInput) {

    // Fill and submit the login form
    await page.type('input[name="username"]', 'shaswatsat@gmail.com');
    await page.type('input[name="password"]', 'sriram2009');
    await page.click('button[type="submit"]');

    // Wait for navigation after logging in
    // await page.waitForNavigation();
  }

  // Access the desired page after login
  await page.goto('https://www.screener.in/results/latest/?p=1&result_update_date__day=11&result_update_date__month=2&result_update_date__year=2024');

  await page.waitForSelector('div.flex-row.margin-top-32');

  // Scrape data from the page
  const data = await page.evaluate(async () => {

    const elements = document.querySelectorAll('div.flex-row.margin-top-32');
    const dataArr = [];

    for (let i = 0; i < elements.length; i++) {
      let element = elements[i];
      const nameSpan = element.querySelector('a > span');
      if (!nameSpan) continue; // Skip if nameSpan is null

      const name = nameSpan.textContent.trim();
      const parentAnchor = nameSpan.parentElement;
      const href = parentAnchor ? parentAnchor.href : '';

      const spans = element.querySelectorAll('div > span.sub');
      let price = '', mcap = '', pe = '';
      spans.forEach(span => {
        const text = span.textContent.trim();
        if (text.includes('Price')) {
          price = span.querySelector('.strong').textContent.trim();
        } else if (text.includes('M.Cap')) {
          mcap = span.querySelector('.strong').textContent.trim();
        } else if (text.includes('PE')) {
          pe = span.querySelector('.strong').textContent.trim();
        }
      });

      const dataElement = element.nextElementSibling.querySelector('table.data-table');
      const dataRows = Array.from(dataElement.querySelectorAll('tbody tr')).map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim()));

      // Check if any cell in dataRows contains a down arrow
      let hasDownArrow = false;
      dataRows.forEach(row => {
        row.forEach(cell => {
          if (cell.includes('⇣')) {
            hasDownArrow = true;
          }
        });
      });

      if (!hasDownArrow) {
        dataArr.push({
          name,
          overview: { price, mcap, pe },
          href
        });
      }
    }

    return dataArr;
  });

  for (let i = 0; i < data.length; i++) {
    let newTab = await browser.newPage(); // Create a new tab for each item
    await newTab.goto(data[i].href);
    await sleep(1000)


    // Evaluate EPS data in the new tab
    const epsData = await newTab.evaluate(() => {
      const section = document.querySelector('#profit-loss table');
      const epsRow = section.querySelector('tbody tr:nth-last-child(2)');
      const lastFiveEps = epsRow.querySelectorAll('td:nth-last-child(-n+5)');
      const epsValues = Array.from(lastFiveEps).map(td => {
        const text = td.innerText.trim();
        return parseFloat(text.replace(/[^0-9.-]/g, '')).toFixed(2);
      });
      return epsValues;
    });

    let epsIncreasing = true;
    for (let i = 1; i < epsData.length; i++) {
      if (parseFloat(epsData[i]) <= parseFloat(epsData[i - 1])) {
        epsIncreasing = false;
        break;
      }
    }

    let roceIncreasing = true;
    if (epsIncreasing) {
      // Evaluate ROCE data in the new tab
      const roceData = await newTab.evaluate(() => {
        const section = document.querySelector('#ratios');
        const roceRow = section.querySelector('tbody tr:last-child');
        const lastFiveRoce = roceRow.querySelectorAll('td:nth-last-child(-n+5)');
        const roceValues = Array.from(lastFiveRoce).map(td => {
          const text = td.innerText.trim();
          return parseFloat(text.replace(/[^0-9.-]/g, '')).toFixed(2);
        });
        return roceValues; // Get last 5 years only
      });

      // Check if ROCE has been increasing
      for (let i = 1; i < roceData.length; i++) {
        if (parseFloat(roceData[i]) <= parseFloat(roceData[i - 1])) {
          roceIncreasing = false;
          break;
        }
      }
    }

    if (!(epsIncreasing && roceIncreasing)) {
      // If EPS or ROCE is not increasing, remove the current item from the array
      data.splice(i, 1);
      i--; // Decrement i as the array length has been reduced by one due to splice
    }

    // Close the new tab
    await newTab.close();
  }

  page.

  console.log("----dataArr---", data)
  // Convert data to CSV
  let csvContent = 'Name,Price,M.Cap,PE,Link\n';
  data.forEach(({ name, overview: { price, mcap, pe }, href }) => {
    csvContent += `${name},${price},${mcap},${pe},${href}\n`;
  });

  // Write CSV to file
  fs.writeFileSync('data.csv', csvContent);
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

  // Close the browser
  await browser.close();
})();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

