/**
 * Logo.dev Integration Service
 * 
 * Uses the Logo.dev Search API to find company domains by name and 
 * provides the high-quality Image CDN URL for their logos.
 */

/**
 * Fetches a professional logo URL from Logo.dev for a given company name.
 * 
 * @param companyName - The name of the company (e.g., "Stripe", "Ford")
 * @returns A high-quality logo URL or null if not found
 */
export async function getCompanyLogo(companyName: string): Promise<{ domain: string | null; logoUrl: string | null }> {
  const LOGO_DEV_SECRET = process.env.LOGO_DEV_SECRET_KEY;
  const LOGO_DEV_PK = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

  if (!LOGO_DEV_SECRET || !LOGO_DEV_PK) {
    console.warn('[logo-dev] Missing API keys for logo.dev integration');
    return { domain: null, logoUrl: null };
  }

  try {
    // 1. Search for the company domain using the Secret Key
    // We use the 'match' strategy for better accuracy during ingestion
    const searchUrl = `https://api.logo.dev/search?q=${encodeURIComponent(companyName)}&strategy=match`;
    
    const res = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${LOGO_DEV_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`[logo-dev] Search failed for "${companyName}" (${res.status}): ${errorText}`);
      return { domain: null, logoUrl: null };
    }

    const results = await res.json();
    if (!results || !Array.isArray(results) || results.length === 0) {
      return { domain: null, logoUrl: null };
    }

    // 2. Get the primary domain from the best match
    // logo.dev search returns an array of objects with 'name' and 'domain'
    const bestMatch = results[0];
    const domain = bestMatch.domain;

    if (!domain) {
      return { domain: null, logoUrl: null };
    }

    // 3. Return the Image CDN URL using the Publishable Key
    // This URL is safe for frontend display
    const logoUrl = `https://img.logo.dev/${domain}?token=${LOGO_DEV_PK}`;

    return { domain, logoUrl };
  } catch (error) {
    console.error(`[logo-dev] Exception fetching logo for ${companyName}:`, error);
    return { domain: null, logoUrl: null };
  }
}
