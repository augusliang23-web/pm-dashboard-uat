import puppeteer from 'puppeteer';

export async function renderPdfBuffer(html) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
