export const A4_HEIGHT_PX = 1123;
export const A4_WIDTH_PX = 794;

/**
 * Renders html in headless Chromium at A4 dimensions and returns
 * document.body.scrollHeight in pixels, or null if rendering fails.
 */
export async function measureResumeHeightPx(html: string): Promise<number | null> {
  let browser: import('puppeteer-core').Browser | null = null;
  try {
    let puppeteer: typeof import('puppeteer-core');
    let executablePath: string;
    let args: string[];

    try {
      // Production path: @sparticuz/chromium for Vercel/Lambda
      const chromium = (await import('@sparticuz/chromium')).default;
      puppeteer = (await import('puppeteer-core')).default as unknown as typeof import('puppeteer-core');
      executablePath = await chromium.executablePath();
      args = chromium.args;
    } catch {
      // Local dev fallback: use puppeteer's bundled browser
      const localPuppeteer = await import('puppeteer');
      executablePath = localPuppeteer.executablePath();
      puppeteer = (await import('puppeteer-core')).default as unknown as typeof import('puppeteer-core');
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }

    browser = await (puppeteer as unknown as { launch: (opts: unknown) => Promise<import('puppeteer-core').Browser> }).launch({
      args,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const height = await page.evaluate(() => document.body.scrollHeight);
    return height;
  } catch (err) {
    console.error('[measure-height] measureResumeHeightPx failed:', err);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
