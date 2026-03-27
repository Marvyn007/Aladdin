# PDF Export Design Fidelity

**Date:** 2026-03-27
**Status:** Approved

---

## Overview

The resume PDF export uses Puppeteer but produces output that doesn't match the user's design customizations. Three root causes: (1) Puppeteer hardcodes `0.5in` margins on top of the CSS margins already set by `design.margins`, doubling whitespace; (2) the Classic template CSS hardcodes `font-family` and `color` instead of using the `--resume-font-family` and `--resume-accent` CSS variables that are already set inline; (3) the server-side render path re-runs `renderResumeHtml()` without fonts available on the Lambda environment.

The fix: render HTML client-side (same call the preview uses), inject Google Fonts `<link>` tags for the selected font, POST the finalized HTML string to the server, and have Puppeteer render that string with zero hardcoded margins. If the server fails, fall back to client-side `generatePDFFromElement` via `html2canvas`.

---

## Root Causes

| # | Bug | Location | Fix |
|---|-----|----------|-----|
| 1 | Puppeteer adds `0.5in` margin on all sides on top of CSS `padding` from `design.margins` | `pdf-renderer.ts` lines 35–40 | Set Puppeteer margins to `{ top: '0', right: '0', bottom: '0', left: '0' }` |
| 2 | Classic template CSS hardcodes `font-family` (ignores `--resume-font-family`) | `resume-templates.ts` Classic CSS | Change to `var(--resume-font-family, 'Aptos', ...)` |
| 3 | Classic template CSS hardcodes `color: #000` for headings and borders (ignores `--resume-accent`) | `resume-templates.ts` Classic CSS | Change to `var(--resume-accent, #000)` |
| 4 | Server-side render calls `renderResumeHtml()` again — fonts not available on Vercel Lambda | `pdf-renderer.ts` / `route.ts` | Client sends pre-rendered HTML with font `<link>` tags injected |

---

## Data Flow (After Fix)

```
FullPageResumeEditor.handleDownloadPdf()
  1. renderResumeHtml(resume)          ← same function preview uses, client-side
  2. injectFontsForPdf(html, fontFamily) ← adds <link> for Google Fonts if needed
  3. POST /api/resume-export  { html, jobTitle, contactName }
       └─ generatePdfBufferFromHtml(html)   ← new Puppeteer fn, zero hardcoded margins
       └─ returns PDF blob
  4. Trigger browser download

  [on error] → generatePDFFromElement(container)  ← html2canvas fallback
```

---

## 1. `src/lib/pdf-renderer.ts`

### New function

```typescript
/**
 * Generate a PDF buffer from a pre-rendered HTML string.
 * Used when the client sends the exact HTML from the preview.
 * Margins are controlled entirely by CSS — no Puppeteer margin override.
 */
export async function generatePdfBufferFromHtml(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: 'networkidle0',
        });

        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: false,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}
```

### Also fix existing `generatePdfBuffer`

Zero out its hardcoded margins too (keeps the old path consistent for any other callers):

```typescript
margin: { top: '0', right: '0', bottom: '0', left: '0' },
```

---

## 2. `src/app/api/resume-export/route.ts`

Change request body from `{ resume, jobTitle }` to `{ html, jobTitle, contactName }`. Call `generatePdfBufferFromHtml`. Keep auth check unchanged.

```typescript
import { generatePdfBufferFromHtml, buildResumeFilename } from '@/lib/pdf-renderer';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { html, jobTitle, contactName } = body as {
            html: string;
            jobTitle?: string;
            contactName?: string;
        };

        if (!html) {
            return NextResponse.json({ error: 'HTML is required' }, { status: 400 });
        }

        const pdfBuffer = await generatePdfBufferFromHtml(html);
        const filename = buildResumeFilename(contactName, jobTitle);

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error: any) {
        console.error('Resume export error:', error);
        return NextResponse.json(
            { error: 'Failed to export resume', details: error.message },
            { status: 500 }
        );
    }
}
```

---

## 3. `src/lib/resume-templates.ts` — Classic Template CSS

Three targeted changes to `CLASSIC_TEMPLATE_CSS`:

**a) Font family** (currently `font-family: 'Aptos', 'Aptos Body', 'Open Sans', 'Segoe UI', sans-serif;`):
```css
font-family: var(--resume-font-family, 'Aptos', 'Aptos Body', 'Open Sans', 'Segoe UI', sans-serif);
```

**b) Section heading color + border** (currently `color: #000` and `border-bottom: 1px solid #000`):
```css
color: var(--resume-accent, #000);
border-bottom: 1px solid var(--resume-accent, #000);
```

**c) Name / `h1` color** (currently `color: #000`):
```css
color: var(--resume-accent, #000);
```

No changes to modern, executive, professional, or minimal templates — they already use the variables.

---

## 4. `src/components/resume-editor/FullPageResumeEditor.tsx`

### Font injection helper

```typescript
const GOOGLE_FONTS_MAP: Record<string, string> = {
    'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap',
};

function injectFontsForPdf(html: string, fontFamily: string): string {
    const url = GOOGLE_FONTS_MAP[fontFamily];
    if (!url) return html; // system font — no injection needed
    const linkTag = `<link rel="stylesheet" href="${url}">`;
    return html.replace('</head>', `${linkTag}</head>`);
}
```

System fonts (Times New Roman, Georgia, Arial, Helvetica) are natively available in Puppeteer's bundled Chromium — no injection needed.

### Updated `handleDownloadPdf`

```typescript
const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
        const baseHtml = renderResumeHtml(resume);
        const html = injectFontsForPdf(baseHtml, resume.design?.fontFamily ?? '');

        const response = await fetch('/api/resume-export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html,
                jobTitle,
                contactName: resume.contact?.name,
            }),
        });

        if (!response.ok) throw new Error('PDF generation failed');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const companyStr = company ? `${company.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
        a.download = `Tailored_Resume_${companyStr}${jobId.substring(0, 4)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('PDF error, falling back to client-side:', error);
        // Fallback: render into a hidden container and use html2canvas
        try {
            const baseHtml = renderResumeHtml(resume);
            const container = document.createElement('div');
            container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:8.5in;background:white;';
            // Use DOMParser to inject the full HTML (styles + body) into the container
            const parser = new DOMParser();
            const doc = parser.parseFromString(baseHtml, 'text/html');
            // Copy head styles
            doc.head.querySelectorAll('style').forEach(s => {
                container.appendChild(s.cloneNode(true));
            });
            container.appendChild(doc.body.firstElementChild!.cloneNode(true));
            document.body.appendChild(container);
            const companyStr = company ? `${company.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
            await generatePDFFromElement(container, {
                filename: `Tailored_Resume_${companyStr}${jobId.substring(0, 4)}.pdf`,
                format: 'letter',
            });
            document.body.removeChild(container);
        } catch {
            alert('Failed to generate PDF. Please try again.');
        }
    } finally {
        setIsDownloading(false);
    }
};
```

### New imports in `FullPageResumeEditor.tsx`

```typescript
import { renderResumeHtml } from '@/lib/resume-templates';
import { generatePDFFromElement } from '@/lib/client-pdf';
```

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/lib/pdf-renderer.ts` | Add `generatePdfBufferFromHtml`; zero margins in both functions |
| `src/app/api/resume-export/route.ts` | Accept `{ html, jobTitle, contactName }`; call `generatePdfBufferFromHtml` |
| `src/lib/resume-templates.ts` | Classic CSS: font-family, h1 color, h2 color + border use CSS vars |
| `src/components/resume-editor/FullPageResumeEditor.tsx` | `handleDownloadPdf` renders+injects+POSTs; fallback to `generatePDFFromElement` |

---

## 6. What Is NOT Changing

- The SSE generation pipeline — untouched
- `ResumePreview.tsx` — untouched; still calls `renderResumeHtml` and writes to iframe
- Modern, executive, professional, minimal template CSS — already correct, no changes
- `buildResumeFilename` — unchanged
- Auth logic in the route — unchanged
