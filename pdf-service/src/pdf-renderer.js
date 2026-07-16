import puppeteer from 'puppeteer';

const LAUNCH_OPTIONS = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

export function createPdfRenderer({ launch = options => puppeteer.launch(options) } = {}) {
  let browserPromise;

  async function getBrowser() {
    const current = browserPromise ? await browserPromise.catch(() => null) : null;
    if (current?.isConnected?.()) return current;
    browserPromise = Promise.resolve().then(() => launch(LAUNCH_OPTIONS));
    return browserPromise;
  }

  async function openPage() {
    let browser = await getBrowser();
    try {
      return await browser.newPage();
    } catch (error) {
      if (browser?.isConnected?.() !== false) throw error;
      browserPromise = undefined;
      browser = await getBrowser();
      return browser.newPage();
    }
  }

  return async function renderPdf(html) {
    const page = await openPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      return await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true
      });
    } finally {
      await page.close().catch(() => {});
    }
  };
}

export const renderPdfBuffer = createPdfRenderer();
