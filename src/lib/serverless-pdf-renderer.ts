import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';

// Disable SwiftShader/WebGL graphics stack — resumes are pure HTML/CSS text,
// so the 3D GPU emulator is unnecessary. This saves ~80MB of RAM and avoids
// OOM kills on Vercel's 1024MB Hobby-tier limit.
chromium.setGraphicsMode = false;

export async function generateServerlessPdfBufferFromHtml(
    html: string,
    margins?: { top: number; right: number; bottom: number; left: number }
): Promise<Buffer> {
    const isLocalDev = process.env.NODE_ENV === 'development';
    
    // Fallback paths for local Windows development
    const windowsChromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' 
    ];

    let executablePath = null;
    
    if (isLocalDev) {
        // Find an existing Chrome/Edge installation locally
        executablePath = windowsChromePaths.find(path => fs.existsSync(path)) || null;
        if (!executablePath) {
            console.warn('Could not find local Chrome executable, using sparticuz executablePath (which may fail on Windows).');
            executablePath = await chromium.executablePath();
        }
    } else {
        // Production Vercel environment: Download Chromium on the fly to bypass 50MB function limits.
        executablePath = await chromium.executablePath(
            "https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar"
        );
    }

    // Filter out args that cause segfaults on Vercel Node 20 with puppeteer-core v22+
    const safeArgs = isLocalDev
        ? []
        : chromium.args.filter((arg: string) =>
            arg !== '--single-process' &&
            arg !== '--font-render-hinting=none'
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
            margin: margins ? {
                top: `${margins.top}in`,
                right: '0in',
                bottom: `${margins.bottom}in`,
                left: '0in'
            } : { top: '0', right: '0', bottom: '0', left: '0' },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}
