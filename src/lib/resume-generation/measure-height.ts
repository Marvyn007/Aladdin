export const A4_HEIGHT_PX = 1123;
export const A4_WIDTH_PX = 794;

const MEASURE_TIMEOUT_MS = 20_000;

/**
 * Renders html in headless Chromium at A4 dimensions and returns
 * document.body.scrollHeight in pixels, or null if rendering fails or times out.
 */
export async function measureResumeHeightPx(html: string): Promise<number | null> {
  return Promise.race([
    _measure(html),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS)),
  ]);
}

async function _measure(html: string): Promise<number | null> {
  let browser: import('puppeteer-core').Browser | null = null;
  try {
    type Launcher = { launch: (opts: unknown) => Promise<import('puppeteer-core').Browser> };

    let launcher: Launcher;
    let executablePath: string;
    let args: string[];

    try {
      // Production: @sparticuz/chromium for Vercel/Lambda
      const chromium = (await import('@sparticuz/chromium')).default;
      launcher = (await import('puppeteer-core')).default as unknown as Launcher;
      executablePath = await chromium.executablePath();
      args = [...chromium.args, '--disable-dev-shm-usage'];
    } catch {
      // Local dev fallback: puppeteer's bundled browser
      const localPuppeteer = await import('puppeteer');
      launcher = (await import('puppeteer-core')).default as unknown as Launcher;
      executablePath = localPuppeteer.executablePath();
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }

    browser = await launcher.launch({ args, executablePath, headless: true });
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
