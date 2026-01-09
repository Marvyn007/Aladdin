/**
 * Text Cleaner Utility
 * 
 * Converts HTML to clean, readable plain text while preserving structure.
 * Used for job descriptions from all sources (import, RSS, ATS APIs).
 */

/**
 * HTML entity map for decoding common entities
 */
const HTML_ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&#x2F;': '/',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&bull;': '\u2022',
    '&middot;': '\u00B7',
    '&hellip;': '\u2026',
    '&trade;': '\u2122',
    '&reg;': '\u00AE',
    '&copy;': '\u00A9',
    '&laquo;': '\u00AB',
    '&raquo;': '\u00BB',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&times;': '\u00D7',
    '&divide;': '\u00F7',
    '&plusmn;': '\u00B1',
    '&frac12;': '\u00BD',
    '&frac14;': '\u00BC',
    '&frac34;': '\u00BE',
};

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
    // First pass: named entities
    let result = text.replace(/&[a-zA-Z]+;/g, match => HTML_ENTITIES[match] || match);

    // Second pass: numeric entities (decimal)
    result = result.replace(/&#(\d+);/g, (_, code) => {
        const num = parseInt(code, 10);
        return num < 65536 ? String.fromCharCode(num) : '';
    });

    // Third pass: numeric entities (hex)
    result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
        const num = parseInt(code, 16);
        return num < 65536 ? String.fromCharCode(num) : '';
    });

    return result;
}

/**
 * Convert HTML to clean, readable plain text
 * 
 * Features:
 * - Removes script/style/nav/header/footer tags
 * - Preserves structure: lists become bullets, paragraphs get newlines
 * - Decodes all HTML entities
 * - Collapses excessive whitespace
 * - NO length limit - stores entire content
 * 
 * @param html Raw HTML string
 * @returns Clean plain text (no truncation)
 */
export function cleanHtmlToText(html: string): string {
    if (!html) return '';

    let text = html;

    // 1. Remove script, style, and non-content tags entirely
    text = text.replace(/<(script|style|noscript|nav|header|footer|aside|iframe|form)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // 2. Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // 3. Convert block elements to newlines (before stripping tags)
    // Headers
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<h[1-6][^>]*>/gi, '\n');

    // Paragraphs and divs
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<div[^>]*>/gi, '');

    // Line breaks
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Lists
    text = text.replace(/<li[^>]*>/gi, '\n• ');
    text = text.replace(/<\/li>/gi, '');
    text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n');

    // Tables - convert cells to spaces, rows to newlines
    text = text.replace(/<\/td>/gi, '\t');
    text = text.replace(/<\/tr>/gi, '\n');
    text = text.replace(/<\/?table[^>]*>/gi, '\n');
    text = text.replace(/<\/?t[hdr][^>]*>/gi, '');
    text = text.replace(/<\/?thead[^>]*>/gi, '');
    text = text.replace(/<\/?tbody[^>]*>/gi, '');

    // Horizontal rules
    text = text.replace(/<hr[^>]*>/gi, '\n---\n');

    // 4. Strip all remaining tags
    text = text.replace(/<[^>]+>/g, ' ');

    // 5. Decode HTML entities
    text = decodeHtmlEntities(text);

    // 6. Clean up whitespace
    // Replace multiple spaces/tabs with single space
    text = text.replace(/[ \t]+/g, ' ');

    // Replace more than 2 consecutive newlines with 2
    text = text.replace(/\n{3,}/g, '\n\n');

    // Remove leading/trailing whitespace from each line
    text = text.split('\n').map(line => line.trim()).join('\n');

    // 7. Final trim (NO LENGTH LIMIT)
    return text.trim();
}

/**
 * Extract the best description from multiple potential sources
 * 
 * @param sources Array of potential description strings (in priority order)
 * @returns The best non-empty description after cleaning
 */
export function getBestDescription(sources: (string | null | undefined)[]): string {
    for (const source of sources) {
        if (!source) continue;

        const cleaned = cleanHtmlToText(source);

        // Require minimum length to be considered valid
        if (cleaned.length >= 100) {
            return cleaned;
        }
    }

    // If all sources are too short, return whatever we have
    for (const source of sources) {
        if (source) {
            return cleanHtmlToText(source);
        }
    }

    return '';
}

/**
 * Check if a description appears complete (not truncated)
 */
export function isDescriptionComplete(text: string): boolean {
    if (!text || text.length < 200) return false;

    // Check for common truncation indicators
    const truncationPatterns = [
        /\.{3,}$/,  // Ends with ...
        /…$/,       // Ends with ellipsis
        /\S$/,      // Ends without punctuation (mid-word)
        /read more$/i,
        /see full description$/i,
        /click to expand$/i,
    ];

    for (const pattern of truncationPatterns) {
        if (pattern.test(text.trim())) {
            return false;
        }
    }

    // Should end with proper punctuation or newline
    const lastChar = text.trim().slice(-1);
    return ['.', '!', '?', ':', '\n'].includes(lastChar);
}
