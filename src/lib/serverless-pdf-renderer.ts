import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';

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

    const browser = await puppeteer.launch({
        args: isLocalDev ? [] : [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
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
