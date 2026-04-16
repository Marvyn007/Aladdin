# Extension Apply Pilot Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Apply Pilot profile from the web app settings into the browser extension so the extension fills ATS fields deterministically using the user's saved answers.

**Architecture:** Add an `ExtensionAccessToken` table for PAT auth, build 8 Next.js API routes under `/api/extension/`, and add an "Extension" tab in Account Settings for generating PATs. The extension's existing `fieldMatcher.js` already consumes `aa_*` keys — the routes simply expose them via `applyPilotPayloadToUserContext()`.

**Tech Stack:** Next.js App Router (TypeScript), Prisma + PostgreSQL, Vitest, Node.js `crypto` for hashing, AWS S3 (`@aws-sdk/client-s3`), `callLLM` from `src/lib/resume-generation/utils.ts`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/extension/validate-pat.ts` | Hash Bearer token → look up `ExtensionAccessToken` → return `{ userId }` or null |
| `src/lib/extension/__tests__/validate-pat.test.ts` | Unit tests for PAT validation |
| `src/app/api/extension/access-tokens/route.ts` | GET (Clerk) token status; POST (Clerk) generate; DELETE (PAT) revoke |
| `src/app/api/extension/auth/route.ts` | GET (PAT) validate token, return user info |
| `src/app/api/extension/profile/route.ts` | GET (PAT) full profile + Apply Pilot aa_* keys; POST (PAT) save learned answers |
| `src/app/api/extension/answer/route.ts` | POST (PAT) LLM answer for unknown field |
| `src/app/api/extension/document/route.ts` | GET (PAT) resume or cover letter as base64 PDF |
| `src/app/api/extension/application/route.ts` | POST (PAT) log completed application |
| `src/components/settings/ExtensionKeyTab.tsx` | PAT generation UI: generate key, copy, last-used date, revoke |

### Modified files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ExtensionAccessToken` model; add `userContext Json?` and `extensionAccessTokens` relation to `User` |
| `src/components/layout/AccountSettingsModal.tsx` | Add `'extension'` tab type; render `<ExtensionKeyTab />` |

---

## Task 1: Prisma Schema — ExtensionAccessToken + User.userContext

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to User model**

Open `prisma/schema.prisma`. Inside `model User { ... }`, after the `applyPilotProfile` line, add:

```prisma
  userContext           Json?                  @default("{}") @map("user_context")
  extensionAccessTokens ExtensionAccessToken[]
```

- [ ] **Step 2: Add ExtensionAccessToken model**

After the closing `}` of the `ApplyPilotProfile` model, add:

```prisma
model ExtensionAccessToken {
  id         String    @id @default(cuid())
  userId     String    @map("user_id")
  tokenHash  String    @unique @map("token_hash")
  label      String?
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  lastUsedAt DateTime? @map("last_used_at") @db.Timestamptz(6)
  revokedAt  DateTime? @map("revoked_at") @db.Timestamptz(6)
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("extension_access_tokens")
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add_extension_access_token
```

Expected output: `✔  Your database is now in sync with your schema.`

If it asks for a migration name and you haven't provided one via `--name`, type `add_extension_access_token`.

- [ ] **Step 4: Verify generated client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add ExtensionAccessToken model and User.userContext field"
```

---

## Task 2: PAT Auth Helper + Tests

**Files:**
- Create: `src/lib/extension/validate-pat.ts`
- Create: `src/lib/extension/__tests__/validate-pat.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/extension/__tests__/validate-pat.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the module under test
vi.mock('@/lib/prisma', () => ({
  prisma: {
    extensionAccessToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { validateExtensionPat } from '../validate-pat';
import { prisma } from '@/lib/prisma';

function makeRequest(token: string) {
  return new Request('http://localhost/api/extension/auth', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateExtensionPat', () => {
  it('returns null for missing Authorization header', async () => {
    const req = new Request('http://localhost/api/extension/auth');
    expect(await validateExtensionPat(req)).toBeNull();
  });

  it('returns null for non-ald_ext_ token', async () => {
    expect(await validateExtensionPat(makeRequest('Bearer sk-abc123'))).toBeNull();
  });

  it('returns null when token not found in DB', async () => {
    vi.mocked(prisma.extensionAccessToken.findUnique).mockResolvedValue(null);
    expect(await validateExtensionPat(makeRequest('ald_ext_abc123'))).toBeNull();
  });

  it('returns null for revoked token', async () => {
    vi.mocked(prisma.extensionAccessToken.findUnique).mockResolvedValue({
      userId: 'user_1',
      revokedAt: new Date(),
    } as any);
    expect(await validateExtensionPat(makeRequest('ald_ext_abc123'))).toBeNull();
  });

  it('returns { userId } for valid token and updates lastUsedAt', async () => {
    vi.mocked(prisma.extensionAccessToken.findUnique).mockResolvedValue({
      id: 'tok_1',
      userId: 'user_1',
      revokedAt: null,
    } as any);
    vi.mocked(prisma.extensionAccessToken.update).mockResolvedValue({} as any);

    const result = await validateExtensionPat(makeRequest('ald_ext_abc123'));
    expect(result).toEqual({ userId: 'user_1' });
    expect(prisma.extensionAccessToken.update).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String) },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run src/lib/extension/__tests__/validate-pat.test.ts
```

Expected: FAIL — `Cannot find module '../validate-pat'`

- [ ] **Step 3: Implement validate-pat.ts**

Create `src/lib/extension/validate-pat.ts`:

```ts
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function extractBearer(request: Request): string | null {
  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function validateExtensionPat(
  request: Request
): Promise<{ userId: string } | null> {
  const raw = extractBearer(request);
  if (!raw || !raw.startsWith('ald_ext_')) return null;

  const tokenHash = hashToken(raw);

  const row = await prisma.extensionAccessToken.findUnique({
    where:  { tokenHash },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (!row || row.revokedAt) return null;

  // Fire-and-forget lastUsedAt update
  prisma.extensionAccessToken.update({
    where: { tokenHash },
    data:  { lastUsedAt: new Date() },
  }).catch(() => {});

  return { userId: row.userId };
}

export function generateRawToken(): string {
  const { randomBytes } = require('crypto') as typeof import('crypto');
  return `ald_ext_${randomBytes(16).toString('hex')}`;
}

export { hashToken };
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run src/lib/extension/__tests__/validate-pat.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/extension/validate-pat.ts src/lib/extension/__tests__/validate-pat.test.ts
git commit -m "feat(extension): add PAT auth helper with tests"
```

---

## Task 3: Access Tokens Route (GET / POST / DELETE)

**Files:**
- Create: `src/app/api/extension/access-tokens/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/extension/access-tokens/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateRawToken, hashToken, validateExtensionPat } from '@/lib/extension/validate-pat';

export const dynamic = 'force-dynamic';

/** GET (Clerk auth): check whether the user has an active PAT */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await prisma.extensionAccessToken.findFirst({
    where:   { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select:  { createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json({
    hasToken:   !!row,
    createdAt:  row?.createdAt?.toISOString() ?? null,
    lastUsedAt: row?.lastUsedAt?.toISOString() ?? null,
  });
}

/** POST (Clerk auth): generate a new PAT — revokes any existing active token */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Revoke all existing active tokens for this user
  await prisma.extensionAccessToken.updateMany({
    where: { userId, revokedAt: null },
    data:  { revokedAt: new Date() },
  });

  const raw = generateRawToken();

  await prisma.extensionAccessToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      label: 'Chrome Extension',
    },
  });

  return NextResponse.json({ token: raw });
}

/** DELETE (PAT auth): revoke the current token (called on extension sign-out) */
export async function DELETE(request: NextRequest) {
  const result = await validateExtensionPat(request);
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = request.headers.get('Authorization')?.slice(7).trim() ?? '';
  const { createHash } = await import('crypto');
  const tokenHash = createHash('sha256').update(raw).digest('hex');

  await prisma.extensionAccessToken.updateMany({
    where: { userId: result.userId, tokenHash, revokedAt: null },
    data:  { revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/extension/access-tokens/route.ts
git commit -m "feat(extension): add access-tokens route (generate/revoke PAT)"
```

---

## Task 4: Auth Route

**Files:**
- Create: `src/app/api/extension/auth/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/extension/auth/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';

export const dynamic = 'force-dynamic';

/** GET (PAT auth): validate token and return basic user info */
export async function GET(request: NextRequest) {
  const result = await validateExtensionPat(request);
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: result.userId },
    select: { firstName: true, lastName: true, email: true },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    userId:    result.userId,
    firstName: user.firstName ?? null,
    lastName:  user.lastName  ?? null,
    email:     user.email     ?? null,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/extension/auth/route.ts
git commit -m "feat(extension): add auth route (validate PAT)"
```

---

## Task 5: Profile Route (GET + POST)

**Files:**
- Create: `src/app/api/extension/profile/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/extension/profile/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';
import { applyPilotPayloadToUserContext } from '@/lib/apply-pilot-profile/flatten';
import { parseApplyPilotPayload } from '@/lib/apply-pilot-profile/types';
import { parsedResumeJsonToAgentText } from '@/lib/auto-apply/parsed-resume-for-agent';

export const dynamic = 'force-dynamic';

/** GET (PAT auth): full profile with Apply Pilot aa_* keys in userContext */
export async function GET(request: NextRequest) {
  const auth = await validateExtensionPat(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = auth;

  const [user, onboardingAnswers, resume, applyPilot, resumeMeta] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { firstName: true, lastName: true, email: true, userContext: true },
    }),
    prisma.onboardingAnswer.findMany({
      where:  { userId },
      select: { questionKey: true, answerText: true },
    }),
    prisma.resume.findFirst({
      where:   { userId, archivedAt: null },
      orderBy: { uploadAt: 'desc' },
      select:  { parsedJson: true, filename: true, s3Key: true, fileData: true },
    }),
    prisma.applyPilotProfile.findUnique({
      where:  { userId },
      select: { payload: true },
    }),
    prisma.resume.findFirst({
      where:   { userId, archivedAt: null },
      orderBy: { uploadAt: 'desc' },
      select:  { filename: true },
    }),
  ]);

  const payload = parseApplyPilotPayload(applyPilot?.payload);
  const applyPilotContext = applyPilotPayloadToUserContext(payload);

  // Learned custom answers from User.userContext — Apply Pilot keys win on conflict
  const learnedContext: Record<string, string> =
    user?.userContext && typeof user.userContext === 'object'
      ? (user.userContext as Record<string, string>)
      : {};

  const userContext: Record<string, string> = { ...learnedContext, ...applyPilotContext };

  let resumeSummary = '';
  if (resume?.parsedJson && typeof resume.parsedJson === 'object') {
    resumeSummary = parsedResumeJsonToAgentText(resume.parsedJson);
  }

  const coverLetterRow = await prisma.coverLetter.findFirst({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
    select:  { s3Key: true, status: true },
  });

  return NextResponse.json({
    user: {
      firstName: user?.firstName ?? null,
      lastName:  user?.lastName  ?? null,
      email:     user?.email     ?? null,
    },
    userContext,
    onboardingAnswers: onboardingAnswers.map(a => ({
      questionKey: a.questionKey,
      answerText:  a.answerText,
    })),
    resumeSummary,
    documents: {
      resume: {
        ready:    !!(resume?.s3Key || resume?.fileData),
        filename: resume?.filename ?? '',
      },
      coverLetter: {
        ready:    !!(coverLetterRow?.s3Key),
        filename: '',
      },
    },
  });
}

/** POST (PAT auth): merge learned answers into User.userContext */
export async function POST(request: NextRequest) {
  const auth = await validateExtensionPat(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = auth;
  const body = await request.json().catch(() => ({}));

  const incomingContext: Record<string, string> =
    body?.context && typeof body.context === 'object' ? body.context : {};

  if (body?.replace) {
    // Full replacement of learned context
    await prisma.user.update({
      where: { id: userId },
      data:  { userContext: incomingContext },
    });
  } else {
    // Merge: read existing → merge → write
    const existing = await prisma.user.findUnique({
      where:  { id: userId },
      select: { userContext: true },
    });
    const prev: Record<string, string> =
      existing?.userContext && typeof existing.userContext === 'object'
        ? (existing.userContext as Record<string, string>)
        : {};
    await prisma.user.update({
      where: { id: userId },
      data:  { userContext: { ...prev, ...incomingContext } },
    });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Write a smoke test to confirm Apply Pilot keys appear**

Create `src/app/api/extension/__tests__/profile.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { applyPilotPayloadToUserContext } from '@/lib/apply-pilot-profile/flatten';
import { EMPTY_APPLY_PILOT_PAYLOAD } from '@/lib/apply-pilot-profile/types';

describe('applyPilotPayloadToUserContext — profile route integration', () => {
  it('converts a filled Apply Pilot payload into aa_* keys', () => {
    const payload = {
      ...EMPTY_APPLY_PILOT_PAYLOAD,
      phoneNational:       '5551234567',
      phoneCountryCode:    '+1',
      linkedinUrl:         'linkedin.com/in/test',
      city:                'San Francisco',
      state:               'CA',
      country:             'United States',
      authorizedToWorkUs:  'yes',
      sponsorshipRequired: 'no',
      currentJobTitle:     'Engineer',
    };

    const ctx = applyPilotPayloadToUserContext(payload);

    expect(ctx['aa_phone']).toBe('5551234567');
    expect(ctx['aa_phone_country_code']).toBe('+1');
    expect(ctx['aa_linkedin_url']).toBe('linkedin.com/in/test');
    expect(ctx['aa_city']).toBe('San Francisco');
    expect(ctx['aa_state']).toBe('CA');
    expect(ctx['aa_country']).toBe('United States');
    expect(ctx['aa_authorized_us']).toBe('Yes');
    expect(ctx['aa_sponsorship_needed']).toBe('No');
    expect(ctx['aa_current_title']).toBe('Engineer');
  });

  it('omits empty fields from context', () => {
    const ctx = applyPilotPayloadToUserContext(EMPTY_APPLY_PILOT_PAYLOAD);
    expect(Object.keys(ctx).length).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/app/api/extension/__tests__/profile.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extension/profile/route.ts src/app/api/extension/__tests__/profile.test.ts
git commit -m "feat(extension): add profile route — serves Apply Pilot aa_* keys"
```

---

## Task 6: Answer Route (LLM)

**Files:**
- Create: `src/app/api/extension/answer/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/extension/answer/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';
import { callLLM } from '@/lib/resume-generation/utils';

export const dynamic = 'force-dynamic';

/**
 * POST (PAT auth): Generate an LLM answer for an unknown form field.
 *
 * Request body:
 * {
 *   fieldLabel:    string   — the form field label/question text
 *   fieldType:     string   — "text" | "select" | "radio" | "checkbox"
 *   options?:      string[] — available choices (for select/radio)
 *   jobTitle?:     string
 *   company?:      string
 *   jobDescription?: string
 * }
 *
 * Response: { answer: string, confidence: "high" | "low" }
 */
export async function POST(request: NextRequest) {
  const auth = await validateExtensionPat(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = auth;
  const body = await request.json().catch(() => ({}));

  const fieldLabel: string    = body?.fieldLabel    ?? '';
  const options:    string[]  = Array.isArray(body?.options) ? body.options : [];
  const jobTitle:   string    = body?.jobTitle       ?? '';
  const company:    string    = body?.company        ?? '';
  const jobDesc:    string    = body?.jobDescription ?? '';

  if (!fieldLabel) {
    return NextResponse.json({ error: 'fieldLabel is required' }, { status: 400 });
  }

  // Fetch resume summary for context
  const resume = await prisma.resume.findFirst({
    where:   { userId, archivedAt: null },
    orderBy: { uploadAt: 'desc' },
    select:  { parsedJson: true },
  });

  const { parsedResumeJsonToAgentText } = await import('@/lib/auto-apply/parsed-resume-for-agent');
  let resumeSummary = '';
  if (resume?.parsedJson && typeof resume.parsedJson === 'object') {
    resumeSummary = parsedResumeJsonToAgentText(resume.parsedJson).slice(0, 2000);
  }

  const optionsList = options.length
    ? `\nAvailable options:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
    : '';

  const systemPrompt =
    'You are completing a job application form on behalf of the candidate. ' +
    'Always pick the option most likely to advance the candidate. ' +
    'Reply with ONLY the exact answer text — no explanation, no quotes, no punctuation around the answer.';

  const userMessage =
    `Job: ${jobTitle || 'unknown'} at ${company || 'unknown company'}\n` +
    (jobDesc ? `Job description (excerpt): ${jobDesc.slice(0, 800)}\n` : '') +
    `\nResume summary:\n${resumeSummary}\n` +
    `\nForm field: "${fieldLabel}"${optionsList}\n` +
    `\nWhat is the best answer for this field?`;

  try {
    const answer = await callLLM(
      [
        { role: 'system',  content: systemPrompt },
        { role: 'user',    content: userMessage  },
      ],
      { max_tokens: 120, temperature: 0.1 }
    );

    return NextResponse.json({
      answer:     answer.trim(),
      confidence: options.length ? 'high' : 'low',
    });
  } catch (err) {
    console.error('[extension/answer]', err);
    return NextResponse.json(
      { error: 'Could not generate an answer. Please try again.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/extension/answer/route.ts
git commit -m "feat(extension): add answer route (LLM field completion)"
```

---

## Task 7: Document Route (S3 → base64)

**Files:**
- Create: `src/app/api/extension/document/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/extension/document/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';
import { getS3Client } from '@/lib/s3';

export const dynamic = 'force-dynamic';

async function fetchS3AsBase64(s3Key: string): Promise<string | null> {
  const client = getS3Client();
  if (!client) return null;
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  if (!bucket) return null;
  try {
    const { Body } = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: s3Key })
    );
    if (!Body) return null;
    const bytes = await Body.transformToByteArray();
    return Buffer.from(bytes).toString('base64');
  } catch {
    return null;
  }
}

/**
 * GET (PAT auth): return resume or cover letter as base64 PDF.
 * Query param: type = "resume" | "coverLetter"
 *
 * Response: { pdfBase64: string, mimeType: string, filename: string }
 */
export async function GET(request: NextRequest) {
  const auth = await validateExtensionPat(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = auth;
  const type = new URL(request.url).searchParams.get('type') ?? 'resume';

  if (type === 'resume') {
    const resume = await prisma.resume.findFirst({
      where:   { userId, archivedAt: null },
      orderBy: { uploadAt: 'desc' },
      select:  { filename: true, s3Key: true, fileData: true },
    });

    if (!resume) {
      return NextResponse.json({ error: 'No resume found.' }, { status: 404 });
    }

    let pdfBase64: string | null = null;

    if (resume.fileData) {
      pdfBase64 = Buffer.from(resume.fileData).toString('base64');
    } else if (resume.s3Key) {
      pdfBase64 = await fetchS3AsBase64(resume.s3Key);
    }

    if (!pdfBase64) {
      return NextResponse.json({ error: 'Resume file not available.' }, { status: 404 });
    }

    return NextResponse.json({
      pdfBase64,
      mimeType: 'application/pdf',
      filename: resume.filename ?? 'resume.pdf',
    });
  }

  if (type === 'coverLetter') {
    const cl = await prisma.coverLetter.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      select:  { s3Key: true },
    });

    if (!cl?.s3Key) {
      return NextResponse.json({ error: 'No cover letter found.' }, { status: 404 });
    }

    const pdfBase64 = await fetchS3AsBase64(cl.s3Key);
    if (!pdfBase64) {
      return NextResponse.json({ error: 'Cover letter file not available.' }, { status: 404 });
    }

    return NextResponse.json({
      pdfBase64,
      mimeType: 'application/pdf',
      filename: 'cover-letter.pdf',
    });
  }

  return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/extension/document/route.ts
git commit -m "feat(extension): add document route (resume/cover letter as base64)"
```

---

## Task 8: Application Log Route

**Files:**
- Create: `src/app/api/extension/application/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/extension/application/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';

export const dynamic = 'force-dynamic';

/**
 * POST (PAT auth): log a completed application from the extension.
 *
 * Request body: { jobTitle?: string, company?: string, url?: string, appliedAt?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await validateExtensionPat(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = auth;
  const body = await request.json().catch(() => ({}));

  const jobTitle:  string = body?.jobTitle  ?? '';
  const company:   string = body?.company   ?? '';
  const url:       string = body?.url       ?? '';

  // Best-effort: log to Application table if a matching job exists, else no-op
  if (jobTitle || company || url) {
    const job = url
      ? await prisma.job.findFirst({
          where: { OR: [{ applyUrl: url }, { sourceUrl: url }] },
          select: { id: true },
        })
      : null;

    if (job) {
      // Check if already applied before creating to avoid duplicates
      const existing = await prisma.application.findFirst({
        where:  { userId, jobId: job.id },
        select: { id: true },
      });
      if (!existing) {
        await prisma.application.create({
          data: { userId, jobId: job.id, columnName: 'Applied' },
        }).catch(() => {}); // non-fatal
      }
    }
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/extension/application/route.ts
git commit -m "feat(extension): add application log route"
```

---

## Task 9: Extension Key Tab UI

**Files:**
- Create: `src/components/settings/ExtensionKeyTab.tsx`
- Modify: `src/components/layout/AccountSettingsModal.tsx`

- [ ] **Step 1: Create ExtensionKeyTab component**

Create `src/components/settings/ExtensionKeyTab.tsx`:

```tsx
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Copy, Check, Loader2, RefreshCw } from 'lucide-react';

const inputStyle: CSSProperties = {
  width: '100%', padding: '5px 8px', borderRadius: '6px',
  border: '1px solid var(--border)', background: 'var(--background-secondary)',
  color: 'var(--text-primary)', fontSize: '11px', lineHeight: 1.35,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
};

const labelStyle: CSSProperties = {
  fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)',
  display: 'block', marginBottom: '3px', lineHeight: 1.25,
};

const btnStyle = (accent = false, disabled = false): CSSProperties => ({
  padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
  background: accent
    ? (disabled ? 'var(--accent-muted)' : 'var(--accent)')
    : 'var(--background-secondary)',
  color: accent ? (disabled ? 'var(--accent)' : '#fff') : 'var(--text-primary)',
  border: accent ? 'none' : '1px solid var(--border)',
});

export function ExtensionKeyTab() {
  const [hasToken,    setHasToken]    = useState(false);
  const [lastUsedAt,  setLastUsedAt]  = useState<string | null>(null);
  const [createdAt,   setCreatedAt]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [generating,  setGenerating]  = useState(false);
  const [rawToken,    setRawToken]    = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);
  const [msg,         setMsg]         = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const res  = await fetch('/api/extension/access-tokens', { cache: 'no-store' });
      const data = await res.json();
      setHasToken(!!data.hasToken);
      setLastUsedAt(data.lastUsedAt ?? null);
      setCreatedAt(data.createdAt ?? null);
    } catch {
      setMsg('Could not load extension key status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function generate() {
    setGenerating(true);
    setRawToken(null);
    setMsg(null);
    try {
      const res  = await fetch('/api/extension/access-tokens', { method: 'POST', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? 'Failed to generate key.'); return; }
      setRawToken(data.token);
      setHasToken(true);
      setCreatedAt(new Date().toISOString());
      setLastUsedAt(null);
    } catch {
      setMsg('Failed to generate key. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function copyToken() {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Browser Extension
        </h3>
        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Generate a key to connect the Aladdin Chrome extension. Your Apply Pilot answers
          will be available automatically when you fill job applications.
        </p>
      </div>

      {hasToken && !rawToken && (
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {createdAt && <div>Key created: {new Date(createdAt).toLocaleDateString()}</div>}
          {lastUsedAt
            ? <div>Last used: {new Date(lastUsedAt).toLocaleDateString()}</div>
            : <div>Not yet used by the extension.</div>}
        </div>
      )}

      {rawToken && (
        <div>
          <label style={labelStyle}>Your extension key (copy this — shown only once)</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              readOnly
              type="text"
              value={rawToken}
              style={{ ...inputStyle, flex: 1 }}
              onFocus={e => e.target.select()}
            />
            <button type="button" onClick={copyToken} style={btnStyle(false, false)}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: 4 }}>
            Paste this into the extension panel → Connect tab. It will not be shown again.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={generate} disabled={generating} style={btnStyle(true, generating)}>
          {generating && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          <RefreshCw size={13} />
          {hasToken ? 'Re-generate Key' : 'Generate Key'}
        </button>
        {msg && (
          <span style={{ fontSize: '10px', color: msg.includes('ailed') ? 'var(--error, #ef4444)' : 'var(--accent)' }}>
            {msg}
          </span>
        )}
      </div>

      {hasToken && (
        <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', margin: 0 }}>
          Re-generating a key immediately revokes the previous one. The extension will prompt
          you to connect again.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add extension tab to AccountSettingsModal**

Open `src/components/layout/AccountSettingsModal.tsx`.

**Change 1** — update the `TabType` union (line ~20):

```ts
// Before:
type TabType = 'profile' | 'preferences' | 'apply-pilot' | 'documents' | 'appearance' | 'security' | 'touch-grass' | 'reviews';

// After:
type TabType = 'profile' | 'preferences' | 'apply-pilot' | 'extension' | 'documents' | 'appearance' | 'security' | 'touch-grass' | 'reviews';
```

**Change 2** — add the import at the top of the file (after the ApplyPilotSettingsTab import):

```ts
import { ExtensionKeyTab } from '@/components/settings/ExtensionKeyTab';
```

**Change 3** — add the tab to the `tabs` array (after the `apply-pilot` entry):

```ts
// Find the line with: { id: 'apply-pilot', label: 'Apply Pilot', icon: <ApplyPilotIcon /> },
// Add after it:
{ id: 'extension', label: 'Extension', icon: <ExtensionIcon /> },
```

**Change 4** — add the `ExtensionIcon` inline SVG component. Find where `ApplyPilotIcon` is defined and add after it:

```tsx
function ExtensionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}
```

**Change 5** — render the tab content. Find the block rendering tab content (around line 449):

```tsx
// Find:
{activeTab === 'apply-pilot' && <ApplyPilotSettingsTab />}

// Add after it:
{activeTab === 'extension' && <ExtensionKeyTab />}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: all previously passing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ExtensionKeyTab.tsx src/components/layout/AccountSettingsModal.tsx
git commit -m "feat(extension): add Extension tab to Account Settings for PAT generation"
```

---

## Task 10: Smoke Test — End-to-End Flow

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open Account Settings → Extension tab**

Navigate to the app, open Account Settings, click the "Extension" tab. You should see the "Generate Key" button.

- [ ] **Step 3: Generate a PAT**

Click "Generate Key". A token starting with `ald_ext_` should appear. Copy it.

- [ ] **Step 4: Verify auth endpoint**

```bash
curl -H "Authorization: Bearer <paste-your-token>" http://localhost:3000/api/extension/auth
```

Expected response: `{ "userId": "...", "firstName": "...", "email": "..." }`

- [ ] **Step 5: Verify profile endpoint includes Apply Pilot keys**

First fill in some Apply Pilot fields in Account Settings → Apply Pilot tab and save. Then:

```bash
curl -H "Authorization: Bearer <paste-your-token>" http://localhost:3000/api/extension/profile
```

Expected: `userContext` in response contains `aa_phone`, `aa_city`, etc. matching what you filled in.

- [ ] **Step 6: Verify the extension connects**

Load the browser extension (from `extension/dist/`), paste the token in the extension panel's connect field. The extension should connect and show your profile.

- [ ] **Step 7: Test on a job application**

Open a Greenhouse or Lever job application with the extension active. Fields like phone, location, LinkedIn URL, work authorization should auto-fill from your Apply Pilot answers without any LLM call.

---

## Self-Review Checklist

- [x] PAT generation (POST `/api/extension/access-tokens`) — Task 3
- [x] PAT revocation (DELETE `/api/extension/access-tokens`) — Task 3
- [x] PAT status check (GET `/api/extension/access-tokens`) — Task 3
- [x] Auth validation (GET `/api/extension/auth`) — Task 4
- [x] Profile with Apply Pilot aa_* keys (GET `/api/extension/profile`) — Task 5
- [x] Learned answer merge (POST `/api/extension/profile`) — Task 5
- [x] LLM answer for unknown fields (POST `/api/extension/answer`) — Task 6
- [x] Document fetch as base64 (GET `/api/extension/document`) — Task 7
- [x] Application logging (POST `/api/extension/application`) — Task 8
- [x] PAT generation UI in Account Settings — Task 9
- [x] Schema migration — Task 1
- [x] validate-pat.ts with tests — Task 2
- [x] Integration smoke test — Task 10
