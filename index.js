import puppeteer from 'puppeteer';
import fs from 'fs';
import nodemailer from 'nodemailer';
import 'dotenv/config'

console.log(process.env.pass)
// return;

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'shaswat97@gmail.com',
    pass: process.env.pass
  }
});

let res = [];
let csvContent = 'Name,EPS1,EPS2,EPS3,ROCE1,ROCE2,ROCE3\n';

(async () => {
  const browser = await puppeteer.launch({ headless: true }); // Launch browser with headless mode off
  const page = await browser.newPage();

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
  const date = 15
  await page.goto(`https://www.screener.in/results/latest/?p=1&result_update_date__day=${date}&result_update_date__month=2&result_update_date__year=2024`);
  await page.waitForSelector('a.end');
  let totalPages = await page.evaluate(() => {
    const link = document.querySelector('a.end');
    return link.innerText;
  });
  totalPages = parseInt(totalPages);
  console.log(totalPages)

  // Scrape data from the page

  for (let i = 1; i <= totalPages; i++) {
    let goodData = []
    console.log("page number: ", i)
    await sleep(1500)
    let csvRow = '';
    try {
      await page.goto(`https://www.screener.in/results/latest/?p=${i}&result_update_date__day=${date}&result_update_date__month=2&result_update_date__year=2024`);
      // await page.waitForSelector('div.flex-row.margin-top-32');
      const data = await page.evaluate(async () => {

        let elements = document.querySelectorAll('div.flex-row.margin-top-32');
        // elements = null;
        const dataArr = [];

        for (let l = 0; l < elements.length; l++) {
          let element = elements[l];
          const nameSpan = element.querySelector('a > span');
          if (!nameSpan) continue; // Skip if nameSpan is null

          const name = nameSpan.textContent.trim();
          const parentAnchor = nameSpan.parentElement;
          const href = parentAnchor ? parentAnchor.href : '';

          // Get overview data
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
      for (let k = 0; k < data.length; k++) {
        csvRow += data[k].name + ","
        let newTab = await browser.newPage(); // Create a new tab for each item
        await newTab.goto(data[k].href);
        await sleep(1200)


        // Evaluate EPS data in the new tab
        let epsData = await newTab.evaluate(() => {
          const section = document.querySelector('#profit-loss table');
          const epsRow = section.querySelector('tbody tr:nth-last-child(2)');
          const lastFiveEps = epsRow.querySelectorAll('td:nth-last-child(-n+3)');
          const epsValues = Array.from(lastFiveEps).map(td => {
            const text = td.innerText.trim();
            return parseFloat(text.replace(/[^0-9.-]/g, '')).toFixed(2);
          });
          return epsValues;
        });

        let epsIncreasing = true;
        // Add eps to csv
        for (const element of epsData) {
          csvRow += element + ",";
        }
        for (let j = 1; j < epsData.length; j++) {
          if (parseFloat(epsData[j]) <= parseFloat(epsData[j - 1])) {
            epsIncreasing = false;
            break;
          }
        }

        let roceIncreasing = true;
        if (epsIncreasing) {
          // Evaluate ROCE data in the new tab
          let roceData = await newTab.evaluate(() => {
            const section = document.querySelector('#ratios');
            const roceRow = section.querySelector('tbody tr:last-child');
            const lastFiveRoce = roceRow.querySelectorAll('td:nth-last-child(-n+3)');
            const roceValues = Array.from(lastFiveRoce).map(td => {
              const text = td.innerText.trim();
              return parseFloat(text.replace(/[^0-9.-]/g, '')).toFixed(2);
            });
            return roceValues; // Get last 5 years only
          });

          // Add eps to csv
          for (const element of roceData) {
            csvRow += element + ",";
          }
          // Remove the last comma
          csvRow = csvRow.slice(0, -1);

          // Check if ROCE has been increasing
          for (let j = 1; j < roceData.length; j++) {
            if (parseFloat(roceData[j]) <= parseFloat(roceData[j - 1])) {
              roceIncreasing = false;
              break;
            }
          }
        }

        if (epsIncreasing && roceIncreasing) {
          goodData.push(data[k]);
        }

        csvRow += "\n"
        csvContent += csvRow
        csvRow = ''

        // Close the new tab
        await newTab.close();
      }
      res = res.concat(goodData)
    } catch (ex) {
      res = res.concat(goodData)
      csvContent += (csvRow + "\n")
      sleep(5000)
    }
  }

  // // Write CSV to file
  // fs.writeFileSync(`data_${Date.now()}.csv`, csvContent);
  // fs.writeFileSync(`data_${Date.now()}.json`, JSON.stringify(res, null, 2));

  // Close the browser
  await browser.close();

  const mailOptions = {
    from: 'shaswat97@gmail.com',
    to: ['shaswat97@gmail.com'],
    // 'op.sinha@sunlordinternational.com'
    subject: 'report',
    text: 'Here are the files.',
    attachments: [
      {
        filename: `all_stocks_${Date.now()}.csv`,
        content: csvContent
      },
      {
        filename: `picked_stocks${Date.now()}.json`,
        content: JSON.stringify(res, null, 2)
      }
    ]
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });

})();



function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

