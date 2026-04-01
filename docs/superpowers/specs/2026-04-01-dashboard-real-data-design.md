# Dashboard Real Data — Design Spec

**Date:** 2026-04-01  
**Branch:** feat/admin-dashboard-overhaul  
**Approach:** Option A — Wire what's real now, stub the rest clearly

---

## Problem

The admin dashboard (`/admin/[adminId]`) displays entirely hardcoded/mocked data. Queue stats, source health, and tracked companies already have live API routes but the Lead Gen KPI strip and all charts use static values from `admin-data.ts`.

---

## Scope

Wire the dashboard to real database data for sections where data exists. Start collecting visitor activity data for future use. Be honest (not fake) about sections where data isn't available yet.

**In scope:**
- New Prisma field: `User.lastActiveAt`
- Middleware to update `lastActiveAt` on authenticated requests
- New API endpoint: `GET /api/admin/dashboard-stats`
- Dashboard page wired to the new endpoint
- Activity chart repurposed to show real daily signups

**Out of scope:**
- Plan/billing (no plan field exists yet — added to DB later)
- Real qualified lead computation (requires activity history to accumulate)
- Admin signals computation (separate project)
- Health score computation (separate project)

---

## Data Layer

### 1. Prisma Schema — `User` model

Add one field:
```prisma
lastActiveAt  DateTime?
```

Run migration: `prisma migrate dev --name add-user-last-active-at`

### 2. Activity Tracking Middleware (`src/middleware.ts`)

On every authenticated Next.js request (Clerk session present):
- Check if `lastActiveAt` was updated in the last 5 minutes (read from a short-lived cookie or just always write — acceptable since it's a single-field upsert)
- Write: `UPDATE "User" SET "lastActiveAt" = NOW() WHERE "clerkId" = $1`
- Use a raw Prisma update, fire-and-forget (don't await in middleware — use `waitUntil` or skip awaiting to not block the response)

Rate limiting: only update if `lastActiveAt IS NULL OR lastActiveAt < NOW() - INTERVAL '5 minutes'` — enforced at the SQL level to avoid write amplification.

### 3. New API Route: `GET /api/admin/dashboard-stats`

**Auth:** Clerk session + admin role check (same pattern as other `/api/admin/*` routes).

**Response shape:**
```ts
{
  totalUsers: number,
  newThisWeek: number,           // createdAt >= 7 days ago
  dormantCount: number,          // lastActiveAt < 14 days ago OR (lastActiveAt IS NULL AND createdAt < 14 days ago)
  avgHealthScore: null,          // reserved for future
  weeklySignups: { week: string; count: number }[],   // 9 weeks, ISO week label
  dailySignups: { date: string; count: number }[],    // 90 days, YYYY-MM-DD
}
```

**Queries (all Prisma):**
- `totalUsers`: `prisma.user.count()`
- `newThisWeek`: `prisma.user.count({ where: { createdAt: { gte: subDays(now, 7) } } })`
- `dormantCount`: count where `lastActiveAt < 14d ago OR (lastActiveAt null AND createdAt < 14d ago)`
- `weeklySignups`: `groupBy createdAt` aggregated into ISO weeks — last 9 weeks
- `dailySignups`: `groupBy createdAt` aggregated by date — last 90 days

All in a single parallel `Promise.all` — no sequential queries.

---

## UI Wiring (`src/app/admin/[adminId]/page.tsx`)

### Data fetching

Replace hardcoded `leadGenKpis`, `weeklySignups`, `activitySeries` imports from `admin-data.ts` with a single `useEffect` fetch to `/api/admin/dashboard-stats`. Loading state shows skeleton/spinner on affected cards.

### Lead Gen KPI Strip

| KPI | Before | After |
|-----|--------|-------|
| Total users | `1,248` (hardcoded) | `dashboardStats.totalUsers` |
| Activated this week | `84` (hardcoded) | `dashboardStats.newThisWeek` |
| Dormant users | `143` (hardcoded) | `dashboardStats.dormantCount` |
| Free → Pro conversion | `4.2%` (hardcoded) | `"—"` with tooltip `"Billing not yet live"` |
| Avg health score | `68` (hardcoded) | `"—"` with tooltip `"Coming soon"` |

### Weekly Signups Line Chart

Swap hardcoded `weeklySignups` array for `dashboardStats.weeklySignups`. Shape is identical (`{ week, count }`), no chart component changes needed.

### Activity Area Chart

- Data source: `dashboardStats.dailySignups` (single series)
- Label change: "New Signups" instead of "Visitors / Qualified Leads"
- Only one `<Area>` rendered (remove the `qualified` series)
- Range selector (90d/30d/7d) slices the returned array client-side
- When visitor tracking accumulates in the future, a second series is added back here

### Plan Distribution Pie Chart

- Renders a single slice: `{ name: "Free", value: 1, color: "var(--chart-1)" }`
- Overlay badge: `"Billing coming soon"` (small, muted, centered below chart)
- No fake Pro/Premium slices

### Unchanged

- Queue stats (already live)
- Source health (already live)
- Tracked companies (already live)
- Admin signals (stay hardcoded)

---

## Error Handling

- If `/api/admin/dashboard-stats` fails, KPI cards show `"—"` and charts show an empty state (not a crash)
- Loading state: skeleton shimmer on KPI values and chart areas while fetching

---

## Testing

- Unit test the dashboard-stats API route: mock Prisma, assert correct counts for edge cases (zero users, all dormant, etc.)
- Manual smoke test: visit the dashboard with a real DB and verify numbers match a direct `SELECT COUNT(*)` from the DB
