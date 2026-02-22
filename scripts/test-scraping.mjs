import fetch from 'node-fetch';

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

function resolveUrl(baseUrl, relativeUrl) {
    try {
        return new URL(relativeUrl, baseUrl).toString();
    } catch (e) {
        return relativeUrl;
    }
}

async function scrapeLogoFromWebsite(domain) {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    console.log(`Scraping ${url}...`);
    try {
        const response = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 5000);
        if (!response.ok) {
            console.error(`Response not OK: ${response.status}`);
            return null;
        }
        const html = await response.text();

        // 1. Look for apple-touch-icon
        const appleIconMatch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i) ||
            html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
        if (appleIconMatch && appleIconMatch[1]) {
            console.log(`Found apple-touch-icon: ${appleIconMatch[1]}`);
            return resolveUrl(url, appleIconMatch[1]);
        }

        // 2. Look for og:image
        const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogImageMatch && ogImageMatch[1]) {
            console.log(`Found og:image: ${ogImageMatch[1]}`);
            return resolveUrl(url, ogImageMatch[1]);
        }

        // 3. Look for shortcut icon or icon
        const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
        if (iconMatch && iconMatch[1]) {
            console.log(`Found icon: ${iconMatch[1]}`);
            return resolveUrl(url, iconMatch[1]);
        }

        console.log("No logo found in meta tags.");
        return null;
    } catch (e) {
        console.error(`Scraping failed: ${e.message}`);
        return null;
    }
}

async function run() {
    const domains = ["vercel.com", "stripe.com", "apple.com"];
    for (const domain of domains) {
        const logo = await scrapeLogoFromWebsite(domain);
        console.log(`Final Logo for ${domain}: ${logo}\n`);
    }
}

run();
