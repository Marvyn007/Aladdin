# PDF Export Design Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the downloaded PDF match exactly what the user sees in the resume preview, including font family, accent color, and page margins.

**Architecture:** Three root causes are fixed in sequence: (1) Classic template CSS variables are wired up so font/color design settings actually apply; (2) `pdf-renderer.ts` gets a new `generatePdfBufferFromHtml` function with zero Puppeteer margin override; (3) the export route accepts pre-rendered HTML from the client; (4) `FullPageResumeEditor` renders HTML client-side (same call the preview uses), injects Google Fonts, POSTs to the route, and falls back to `html2canvas` on error.

**Tech Stack:** Next.js 14 App Router, TypeScript, Puppeteer, html2canvas, jsPDF, Clerk auth

---

## File Map

| File | Change |
|------|--------|
| `src/lib/resume-templates.ts` | Fix Classic CSS: font-family, h1 color, header border, h2 color + border |
| `src/lib/pdf-renderer.ts` | Add `generatePdfBufferFromHtml`; zero margins in `generatePdfBuffer` too |
| `src/app/api/resume-export/route.ts` | Accept `{ html, jobTitle, contactName }`; call `generatePdfBufferFromHtml` |
| `src/components/resume-editor/FullPageResumeEditor.tsx` | Rewrite `handleDownloadPdf` + add `injectFontsForPdf` helper + new imports |

---

## Task 1: Fix Classic Template CSS Variables

**Files:**
- Modify: `src/lib/resume-templates.ts` lines 17, 35, 45, 80, 83

The Classic template hardcodes `font-family`, heading colors, and border colors instead of reading the CSS custom properties that `renderClassicTemplate` already sets as inline styles (e.g. `--resume-font-family: Inter`).

- [ ] **Step 1: Open `src/lib/resume-templates.ts` and locate `CLASSIC_TEMPLATE_CSS`**

The constant starts at line 9. Find these five lines and replace them:

**Line 17** — change:
```css
  font-family: 'Aptos', 'Aptos Body', 'Open Sans', 'Segoe UI', sans-serif;
```
to:
```css
  font-family: var(--resume-font-family, 'Aptos', 'Aptos Body', 'Open Sans', 'Segoe UI', sans-serif);
```

**Line 35** — change:
```css
  border-bottom: 1px solid #000;
```
to:
```css
  border-bottom: 1px solid var(--resume-accent, #000);
```
(This is inside `.resume-classic header` — the horizontal rule under the name block.)

**Line 45** — change:
```css
  color: #000;
```
to:
```css
  color: var(--resume-accent, #000);
```
(This is inside `.resume-classic header h1`.)

**Line 80** — change:
```css
  border-bottom: 1px solid #000;
```
to:
```css
  border-bottom: 1px solid var(--resume-accent, #000);
```
(This is inside `.resume-classic section h2`.)

**Line 83** — change:
```css
  color: #000;
```
to:
```css
  color: var(--resume-accent, #000);
```
(This is inside `.resume-classic section h2`.)

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/lib/resume-templates.ts
git commit -m "fix: classic template CSS uses font-family and accent-color variables"
```

---

## Task 2: Add `generatePdfBufferFromHtml` to pdf-renderer

**Files:**
- Modify: `src/lib/pdf-renderer.ts`

Add a new exported function that accepts a pre-rendered HTML string. Also zero out the hardcoded margins in the existing `generatePdfBuffer` so any leftover callers are also fixed.

- [ ] **Step 1: Open `src/lib/pdf-renderer.ts`**

The full current file is 57 lines. Make two changes:

**Change A** — in `generatePdfBuffer` (existing function), replace the hardcoded Puppeteer margin block at lines 35–40:

```typescript
            margin: {
                top: '0.5in',
                right: '0.5in',
                bottom: '0.5in',
                left: '0.5in',
            },
```
with:
```typescript
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
```

**Change B** — add the new function after `generatePdfBuffer` ends (after line 47, before the `buildResumeFilename` JSDoc comment):

```typescript
/**
 * Generate a PDF buffer from a pre-rendered HTML string.
 * The client sends exactly the HTML the preview rendered, with fonts injected.
 * Puppeteer margins are zeroed — all spacing comes from CSS.
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

After both changes the full file should look like:

```typescript
/**
 * Shared PDF Renderer
 * Uses Puppeteer to render a TailoredResumeData into a PDF buffer.
 */

import { renderResumeHtml } from '@/lib/resume-templates';
import type { TailoredResumeData } from '@/types';
import puppeteer from 'puppeteer';

/**
 * Generate a PDF buffer from a TailoredResumeData object.
 * Uses Puppeteer to render the resume HTML into a letter-sized PDF.
 * Supports multi-page output - content can flow to additional pages naturally.
 */
export async function generatePdfBuffer(resume: TailoredResumeData): Promise<Buffer> {
    const html = renderResumeHtml(resume);

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
            pageRanges: '',
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

/**
 * Generate a PDF buffer from a pre-rendered HTML string.
 * The client sends exactly the HTML the preview rendered, with fonts injected.
 * Puppeteer margins are zeroed — all spacing comes from CSS.
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

/**
 * Build a safe filename from contact name + job title.
 * e.g. "Jane Smith" + "Software Engineer" → "jane_smith_software_engineer.pdf"
 */
export function buildResumeFilename(contactName: string | undefined, jobTitle: string | undefined): string {
    const safeName = (contactName || 'resume').trim().replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const safeTitle = (jobTitle || 'tailored').trim().replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');
    return `${safeName}_${safeTitle}.pdf`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/lib/pdf-renderer.ts
git commit -m "feat: add generatePdfBufferFromHtml with zero margin override"
```

---

## Task 3: Update `/api/resume-export` to accept HTML

**Files:**
- Modify: `src/app/api/resume-export/route.ts`

The route currently receives `{ resume, jobTitle }` and calls `generatePdfBuffer(resume)`. Change it to accept `{ html, jobTitle, contactName }` and call `generatePdfBufferFromHtml(html)`.

- [ ] **Step 1: Replace the full content of `src/app/api/resume-export/route.ts`**

```typescript
/**
 * Resume PDF Export API Route
 * POST /api/resume-export
 *
 * Accepts pre-rendered HTML from the client (same HTML the preview displays).
 * Returns application/pdf with dynamic filename.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePdfBufferFromHtml, buildResumeFilename } from '@/lib/pdf-renderer';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/app/api/resume-export/route.ts
git commit -m "feat: resume-export route accepts pre-rendered HTML from client"
```

---

## Task 4: Update `FullPageResumeEditor` to send HTML

**Files:**
- Modify: `src/components/resume-editor/FullPageResumeEditor.tsx` — imports (lines 3–9) and `handleDownloadPdf` (lines 368–397)

The editor currently POSTs `{ resume, jobTitle }`. This task replaces it with: render HTML client-side → inject Google Fonts → POST `{ html, jobTitle, contactName }` → fall back to `generatePDFFromElement` on server error.

- [ ] **Step 1: Update the imports block**

Find the current imports at the top of the file (lines 1–9):

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Home, Download, Save, Loader2, FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripHorizontal } from 'lucide-react';
import type { TailoredResumeData, KeywordAnalysis } from '@/types';
import { ContentPanel } from '@/components/resume-editor/ContentPanel';
import { DesignPanel } from '@/components/resume-editor/DesignPanel';
import { ResumePreview } from '@/components/resume-editor/ResumePreview';
```

Replace with (add two new imports at the bottom of the import block):

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Home, Download, Save, Loader2, FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripHorizontal } from 'lucide-react';
import type { TailoredResumeData, KeywordAnalysis } from '@/types';
import { ContentPanel } from '@/components/resume-editor/ContentPanel';
import { DesignPanel } from '@/components/resume-editor/DesignPanel';
import { ResumePreview } from '@/components/resume-editor/ResumePreview';
import { renderResumeHtml } from '@/lib/resume-templates';
import { generatePDFFromElement } from '@/lib/client-pdf';
```

- [ ] **Step 2: Add the `GOOGLE_FONTS_MAP` constant and `injectFontsForPdf` helper**

These go immediately after the imports, before the interface declaration. Add them after line 9 (after the last import, before `interface FullPageResumeEditorProps`):

```typescript
const GOOGLE_FONTS_MAP: Record<string, string> = {
    'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap',
};

function injectFontsForPdf(html: string, fontFamily: string): string {
    const url = GOOGLE_FONTS_MAP[fontFamily];
    if (!url) return html; // system font (Times New Roman, Georgia, Arial, Helvetica) — no injection needed
    const linkTag = `<link rel="stylesheet" href="${url}">`;
    return html.replace('</head>', `${linkTag}</head>`);
}
```

- [ ] **Step 3: Replace `handleDownloadPdf`**

Find the current `handleDownloadPdf` function (currently lines 368–397 after previous fixes):

```typescript
    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        try {
            const response = await fetch('/api/resume-export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume, jobTitle }),
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
            console.error('PDF error:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };
```

Replace it with:

```typescript
    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        const companyStr = company ? `${company.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
        const downloadFilename = `Tailored_Resume_${companyStr}${jobId.substring(0, 4)}.pdf`;

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

            if (!response.ok) throw new Error('Server PDF generation failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Server PDF failed, falling back to client-side:', error);
            // Fallback: render into a hidden off-screen container and use html2canvas
            try {
                const baseHtml = renderResumeHtml(resume);
                const parser = new DOMParser();
                const doc = parser.parseFromString(baseHtml, 'text/html');

                const container = document.createElement('div');
                container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:8.5in;background:white;';

                // Copy <style> tags from the parsed document's <head>
                doc.head.querySelectorAll('style').forEach((s) => {
                    container.appendChild(s.cloneNode(true));
                });
                // Copy the resume body element
                if (doc.body.firstElementChild) {
                    container.appendChild(doc.body.firstElementChild.cloneNode(true));
                }

                document.body.appendChild(container);
                try {
                    await generatePDFFromElement(container, { filename: downloadFilename, format: 'letter' });
                } finally {
                    document.body.removeChild(container);
                }
            } catch {
                alert('Failed to generate PDF. Please try again.');
            }
        } finally {
            setIsDownloading(false);
        }
    };
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/components/resume-editor/FullPageResumeEditor.tsx
git commit -m "feat: export sends client-rendered HTML with font injection and html2canvas fallback"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|------------|
| Remove Puppeteer hardcoded `0.5in` margins | Task 2 — zeroed in both `generatePdfBuffer` and `generatePdfBufferFromHtml` |
| Classic template uses `--resume-font-family` | Task 1 — line 17 fix |
| Classic template uses `--resume-accent` for h1, h2, borders | Task 1 — lines 35, 45, 80, 83 |
| New `generatePdfBufferFromHtml(html)` function | Task 2 |
| Route accepts `{ html, jobTitle, contactName }` | Task 3 |
| Client renders HTML + injects fonts before POST | Task 4 |
| Fallback to `generatePDFFromElement` on server error | Task 4 |

**Placeholder scan:** No TBDs, no "implement later", all code blocks complete.

**Type consistency:** `generatePdfBufferFromHtml(html: string)` defined in Task 2, imported in Task 3. `injectFontsForPdf(html, fontFamily)` defined and used in Task 4. `generatePDFFromElement(container, { filename, format })` matches `PDFGenerationOptions` in `src/lib/client-pdf.ts` which requires `filename` and accepts optional `format`.
