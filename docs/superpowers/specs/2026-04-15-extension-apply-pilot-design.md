# Extension Apply Pilot Integration — Design Spec

**Date:** 2026-04-15  
**Status:** Approved

## Problem

The browser extension's form-filling engine (`fieldMatcher.js`) is designed to read `aa_*` keys from `profile.userContext` to deterministically fill ATS fields (phone, location, work auth, EEO, etc.). The Apply Pilot profile the user fills in the web app settings is stored in the DB (`ApplyPilotProfile` table) but is never served to the extension. The extension API layer (`/api/extension/*`) that the background script expects does not exist server-side. Result: the extension has no user context, falls back to LLM for every field.

## Goal

When a user fills their Apply Pilot profile in the web app settings tab, those answers flow automatically to the browser extension. The extension uses them to fill ATS fields deterministically — no LLM call needed for known fields.

---

## Data Model

### New table: `ExtensionAccessToken`

```prisma
model ExtensionAccessToken {
  id         String    @id @default(cuid())
  userId     String
  tokenHash  String    @unique   // SHA-256 of raw ald_ext_* token
  label      String?             // e.g. "Chrome Extension"
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?
  revokedAt  DateTime?
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- Raw token format: `ald_ext_<32 random hex chars>`
- Only the SHA-256 hash is stored — raw token returned once on creation
- One active (non-revoked) token per user enforced at generation time (old token auto-revoked)

---

## API Routes

All extension routes live under `/api/extension/`. PAT-authenticated routes validate via `Authorization: Bearer ald_ext_*` header using a shared `validateExtensionPat(request)` helper that hashes the token and looks up `ExtensionAccessToken`.

### Auth helper: `src/lib/extension/validate-pat.ts`

```ts
export async function validateExtensionPat(request: Request): Promise<{ userId: string } | null>
```

Hashes Bearer token → finds non-revoked `ExtensionAccessToken` → updates `lastUsedAt` → returns `{ userId }` or `null`.

### Routes

| Route | Auth | Method | Purpose |
|-------|------|--------|---------|
| `/api/extension/access-tokens` | Clerk session | POST | Generate new PAT; revokes any existing active token |
| `/api/extension/access-tokens` | PAT | DELETE | Revoke token (called on extension sign-out) |
| `/api/extension/auth` | PAT | GET | Validate PAT; return `{ userId, email, firstName }` |
| `/api/extension/profile` | PAT | GET | Full profile with Apply Pilot as `aa_*` keys |
| `/api/extension/profile` | PAT | POST | Merge learned custom answers into `User.userContext` |
| `/api/extension/answer` | PAT | POST | LLM answer for unknown field using resume + job context |
| `/api/extension/document` | PAT | GET | Resume or cover letter as base64 PDF |
| `/api/extension/application` | PAT | POST | Log completed application |

---

## Profile Response Shape

`GET /api/extension/profile` returns:

```json
{
  "user": {
    "firstName": "Alex",
    "lastName": "Smith",
    "email": "alex@example.com"
  },
  "userContext": {
    "aa_phone": "5551234567",
    "aa_phone_country_code": "+1",
    "aa_linkedin_url": "linkedin.com/in/alexsmith",
    "aa_github_url": "github.com/alexsmith",
    "aa_city": "San Francisco",
    "aa_state": "CA",
    "aa_zip": "94102",
    "aa_country": "United States",
    "aa_authorized_us": "Yes",
    "aa_sponsorship_needed": "No",
    "aa_willing_relocate": "Yes",
    "aa_open_to_remote": "Yes",
    "aa_gender": "Male",
    "aa_veteran_status": "Not a veteran",
    "aa_current_title": "Software Engineer",
    "aa_years_experience": "4-5",
    "aa_notice_period": "2 weeks",
    "... all other aa_* keys from Apply Pilot ...": "...",
    "... learned custom keys from User.userContext ...": "..."
  },
  "onboardingAnswers": [
    { "questionKey": "...", "answerText": "..." }
  ],
  "resumeSummary": "...",
  "documents": {
    "resume": { "ready": true, "filename": "resume.pdf" },
    "coverLetter": { "ready": false, "filename": "" }
  }
}
```

**Key detail:** `applyPilotPayloadToUserContext()` (already in `src/lib/apply-pilot-profile/flatten.ts`) converts the `ApplyPilotProfile` DB row → `aa_*` keys. These are merged with `User.userContext` (a new `Json` column for learned custom answers the extension saves back via `POST /api/extension/profile`), with Apply Pilot taking priority for any overlapping `aa_*` keys.

---

## Data Flow

```
User fills Apply Pilot tab (web app)
  → PUT /api/user/apply-pilot-profile
  → Saved to ApplyPilotProfile table

Extension authenticates (one-time setup)
  → User clicks "Generate Key" in web app settings
  → POST /api/extension/access-tokens (Clerk auth)
  → Returns raw ald_ext_* token (shown once, copy to clipboard)
  → User pastes into extension panel

Extension fetches profile (on connect + 1hr cache)
  → GET /api/extension/profile (PAT auth)
  → Server reads ApplyPilotProfile → applyPilotPayloadToUserContext() → aa_* keys
  → Merges with User.userContext (custom learned answers)
  → Returns combined userContext

Extension fills ATS form
  → fieldMatcher.js: field label → aa_* key lookup → deterministic value
  → formFiller.js fills field (no LLM needed for Apply Pilot fields)
  → Unknown fields → POST /api/extension/answer → LLM with resume context
  → Learned answer → POST /api/extension/profile → stored in User.userContext
```

---

## Web App: PAT Generation UI

Add a "Browser Extension" card to the Account Settings modal (same modal that hosts the Apply Pilot tab). Card contains:

- "Generate Key" button (Clerk-authenticated, calls `POST /api/extension/access-tokens`)
- Raw token displayed once with copy-to-clipboard button
- Last-used date when a token exists
- "Revoke" / "Re-generate" action (auto-revokes previous token)
- Link to extension install instructions

---

## Files to Create / Modify

### New files
- `prisma/migrations/.../add_extension_access_token.sql`
- `src/lib/extension/validate-pat.ts` — shared PAT auth helper
- `src/app/api/extension/access-tokens/route.ts` — POST (Clerk) + DELETE (PAT)
- `src/app/api/extension/auth/route.ts` — GET
- `src/app/api/extension/profile/route.ts` — GET + POST
- `src/app/api/extension/answer/route.ts` — POST
- `src/app/api/extension/document/route.ts` — GET
- `src/app/api/extension/application/route.ts` — POST

### Modified files
- `prisma/schema.prisma` — add `ExtensionAccessToken` model; add `userContext Json @default("{}")` column to `User` for storing learned custom answers from the extension
- `src/components/shared/AccountSettingsModal.tsx` (or equivalent) — add PAT generation card

---

## Error Handling

- Invalid/expired PAT → 401 with `{ error: "Unauthorized" }` — extension clears local session
- Apply Pilot not filled → empty `userContext` returned, extension falls back to LLM/manual
- Resume not uploaded → `documents.resume.ready = false`, extension skips file field
- Rate limiting: answer endpoint limited to 60 req/min per userId to prevent LLM abuse

---

## Testing

- Unit: `validate-pat.ts` with valid, revoked, and malformed tokens
- Unit: `applyPilotPayloadToUserContext()` already tested — verify aa_* keys appear in profile response
- Integration: generate PAT → fetch profile → verify Apply Pilot fields present in userContext
- Extension manual test: fill Apply Pilot in web app → open extension on Greenhouse/Lever job → verify fields auto-fill deterministically
