import puppeteer from 'puppeteer-core';
// chromium-min is the lightweight variant (~2MB) of @sparticuz/chromium.
// It excludes the pre-bundled binary and instead downloads it at runtime
// from a remote URL, which is required to stay within Vercel's 50MB limit.
import chromium from '@sparticuz/chromium-min';
import fs from 'fs';

// Disable SwiftShader/WebGL graphics stack — resumes are pure HTML/CSS text,
// so the 3D GPU emulator is unnecessary. This saves ~80MB of RAM and avoids
// OOM kills on Vercel's 1024MB Hobby-tier limit.
chromium.setGraphicsMode = false;

// The remote Chromium binary for Vercel (AL2023 + Node 20 compatible).
// This must match the installed @sparticuz/chromium-min version (133.0.0).
const CHROMIUM_REMOTE_URL =
    'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar';

export async function generateServerlessPdfBufferFromHtml(
    html: string,
    margins?: { top: number; right: number; bottom: number; left: number }
): Promise<Buffer> {
    const isLocalDev = process.env.NODE_ENV === 'development';

    // Fallback paths for local Windows development
    const windowsChromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];

    let executablePath: string | null = null;

    if (isLocalDev) {
        // Find an existing Chrome/Edge installation locally — no download needed
        executablePath = windowsChromePaths.find(path => fs.existsSync(path)) || null;
        if (!executablePath) {
            console.warn(
                'Could not find local Chrome/Edge. Falling back to sparticuz remote download (may be slow).'
            );
            executablePath = await chromium.executablePath(CHROMIUM_REMOTE_URL);
        }
    } else {
        // Production Vercel/serverless: always download the binary from the
        // pinned remote URL so we never bundle the 130MB binary in the deploy.
        executablePath = await chromium.executablePath(CHROMIUM_REMOTE_URL);
    }

    // Filter out args that cause segfaults on Vercel Node 20 + puppeteer-core v24
    const safeArgs = isLocalDev
        ? []
        : chromium.args.filter((arg: string) =>
              arg !== '--single-process' && arg !== '--font-render-hinting=none'
          );

    const browser = await puppeteer.launch({
        args: [...safeArgs, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: chromium.defaultViewport,
        executablePath: executablePath as string,
        headless: isLocalDev ? true : chromium.headless,
    });

    try {
        const page = await browser.newPage();

        // A4 at 96 CSS px/in ≈ 794×1123 — match resume preview constants.
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

        // waitUntil 'networkidle0' ensures fonts and stylesheets have fully loaded.
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: margins
                ? {
                      top: `${margins.top}in`,
                      right: '0in',
                      bottom: `${margins.bottom}in`,
                      left: '0in',
                  }
                : { top: '0', right: '0', bottom: '0', left: '0' },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}
