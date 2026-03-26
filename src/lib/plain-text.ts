import he from 'he';

export function toPlainText(input: string | null | undefined): string {
    if (!input) return '';

    const withBreaks = input
        .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, ' ')
        .replace(/<\s*style[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(/<\s*\/\s*(p|div|section|article|h1|h2|h3|h4|h5|h6)\s*>/gi, '\n')
        .replace(/<\s*\/\s*li\s*>/gi, '\n')
        .replace(/<\s*li[^>]*>/gi, '- ');

    const stripped = withBreaks.replace(/<[^>]+>/g, ' ');
    const decoded = he.decode(stripped);

    return decoded
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

