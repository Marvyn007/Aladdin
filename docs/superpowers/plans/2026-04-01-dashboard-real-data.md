# Dashboard Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded dashboard KPIs and charts with real data from the Postgres database, and start collecting user activity data for future visitor tracking.

**Architecture:** Add `lastActiveAt` to the `User` Prisma model and a middleware that updates it on authenticated requests. A new `/api/admin/dashboard-stats` API route queries all aggregated KPI and chart data in one round trip. The dashboard page fetches this endpoint alongside the existing three API calls, replacing imports from `admin-data.ts`.

**Tech Stack:** Prisma 5 (PostgreSQL), Next.js 15 App Router, Clerk (`@clerk/nextjs`), TypeScript, Recharts, Tailwind

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `lastActiveAt DateTime?` to `User` model |
| `src/middleware.ts` | Create — updates `lastActiveAt` on authenticated requests |
| `src/app/api/admin/dashboard-stats/route.ts` | Create — aggregated KPI + chart data endpoint |
| `src/app/admin/[adminId]/page.tsx` | Wire new state + fetch, replace hardcoded data references |
| `src/components/admin/admin-data.ts` | Remove `leadGenKpis`, `weeklySignups`, `userPlanDistribution` exports (keep `adminSignals`, `adminUsers`, `adminJobs`, `adminInterviewRecords` types/data used by other pages) |

---

## Task 1: Add `lastActiveAt` to User model and run migration

**Files:**
- Modify: `prisma/schema.prisma` (User model, line ~41 before `@@index`)

- [ ] **Step 1: Add the field to schema.prisma**

Open `prisma/schema.prisma`. Inside the `User` model, add this line immediately before the `@@index` line:

```prisma
lastActiveAt        DateTime?              @map("last_active_at") @db.Timestamptz(6)
```

The User model's closing section should now look like:
```prisma
  userLeetCodeProgress UserLeetCodeProgress[]
  lastActiveAt        DateTime?              @map("last_active_at") @db.Timestamptz(6)

  @@index([email], map: "idx_users_email")
  @@map("users")
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add-user-last-active-at
```

Expected output ends with:
```
Your database is now in sync with your schema.
```

- [ ] **Step 3: Verify the generated client includes the new field**

```bash
npx prisma generate
```

Then check that `node_modules/.prisma/client/index.d.ts` contains `lastActiveAt`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add lastActiveAt to User model"
```

---

## Task 2: Create activity tracking middleware

**Files:**
- Create: `src/middleware.ts`

The middleware runs on every request in the Next.js edge runtime. It checks if the user is authenticated via Clerk, then fires a DB update (rate-limited: only if `lastActiveAt` is older than 5 minutes) without blocking the response.

**Important:** Next.js middleware runs in the Edge Runtime, which does not support the Prisma client directly. We solve this by calling an internal API endpoint (`/api/user/touch`) from middleware using `fetch`, fire-and-forget.

- [ ] **Step 1: Create the internal touch endpoint**

Create `src/app/api/user/touch/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [
        { lastActiveAt: null },
        { lastActiveAt: { lt: fiveMinutesAgo } },
      ],
    },
    data: { lastActiveAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create the middleware**

Create `src/middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId } = await auth()

  // Fire-and-forget activity tracking for authenticated users
  // Skip tracking the touch endpoint itself to avoid loops
  if (userId && !req.nextUrl.pathname.startsWith('/api/user/touch')) {
    fetch(new URL('/api/user/touch', req.url), {
      method: 'POST',
      headers: { cookie: req.headers.get('cookie') ?? '' },
    }).catch(() => {
      // Intentionally fire-and-forget — never block the response
    })
  }

  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

- [ ] **Step 3: Verify the app still starts**

```bash
npx next dev
```

Expected: no TypeScript errors, server starts on port 3000.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts src/app/api/user/touch/route.ts
git commit -m "feat: add activity tracking middleware and touch endpoint"
```

---

## Task 3: Create `/api/admin/dashboard-stats` endpoint

**Files:**
- Create: `src/app/api/admin/dashboard-stats/route.ts`

This endpoint returns all dashboard KPI and chart data in one request. All DB queries run in parallel via `Promise.all`.

- [ ] **Step 1: Create the route file**

Create `src/app/api/admin/dashboard-stats/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin/rbac'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const [totalUsers, newThisWeek, dormantCount, allUsersForCharts] = await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),

      prisma.user.count({
        where: {
          OR: [
            { lastActiveAt: { lt: fourteenDaysAgo } },
            {
              lastActiveAt: null,
              createdAt: { lt: fourteenDaysAgo },
            },
          ],
        },
      }),

      // Fetch createdAt for all users within 90 days for chart aggregation
      prisma.user.findMany({
        where: { createdAt: { gte: ninetyDaysAgo } },
        select: { createdAt: true },
      }),
    ])

    // Aggregate daily signups (last 90 days)
    const dailyMap: Record<string, number> = {}
    for (const user of allUsersForCharts) {
      if (!user.createdAt) continue
      const date = user.createdAt.toISOString().slice(0, 10) // YYYY-MM-DD
      dailyMap[date] = (dailyMap[date] ?? 0) + 1
    }
    // Fill in zeros for days with no signups so the chart is continuous
    const dailySignups: { date: string; count: number }[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dailySignups.push({ date: key, count: dailyMap[key] ?? 0 })
    }

    // Aggregate weekly signups (last 9 weeks)
    // Week label: "Apr 1" = Monday of that ISO week
    const weeklyMap: Record<string, number> = {}
    for (const user of allUsersForCharts) {
      if (!user.createdAt) continue
      const weekStart = getWeekStart(user.createdAt)
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      weeklyMap[key] = (weeklyMap[key] ?? 0) + 1
    }
    // Build ordered 9-week array
    const weeklySignups: { week: string; count: number }[] = []
    for (let i = 8; i >= 0; i--) {
      const weekStart = getWeekStart(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000))
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      weeklySignups.push({ week: key, count: weeklyMap[key] ?? 0 })
    }

    return NextResponse.json({
      totalUsers,
      newThisWeek,
      dormantCount,
      avgHealthScore: null,
      weeklySignups,
      dailySignups,
    })
  } catch (err) {
    console.error('[dashboard-stats] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/** Returns the Monday (week start) for a given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0 = Sunday
  const diff = (day === 0 ? -6 : 1 - day) // adjust to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
```

- [ ] **Step 2: Test the endpoint manually**

Start the dev server (`npx next dev`) and in a new terminal:

```bash
curl -s http://localhost:3000/api/admin/dashboard-stats | npx json
```

Expected (shape, not exact values):
```json
{
  "totalUsers": 42,
  "newThisWeek": 3,
  "dormantCount": 10,
  "avgHealthScore": null,
  "weeklySignups": [
    { "week": "Feb 3", "count": 0 },
    ...
    { "week": "Mar 31", "count": 3 }
  ],
  "dailySignups": [
    { "date": "2026-01-01", "count": 0 },
    ...
  ]
}
```

If you get a 401 or 403, you're not signed in as a moderator/admin — that's expected. Sign in and retry, or check the RBAC logic in `src/lib/admin/rbac.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/dashboard-stats/route.ts
git commit -m "feat: add dashboard-stats API endpoint"
```

---

## Task 4: Wire the dashboard page to real data

**Files:**
- Modify: `src/app/admin/[adminId]/page.tsx`

Replace the three hardcoded data imports (`leadGenKpis`, `weeklySignups`, `userPlanDistribution`) with state from the new API endpoint. The existing `loadAdminData` function already does `Promise.all` for 3 fetches — we add the 4th alongside.

- [ ] **Step 1: Add the DashboardStats type and state**

At the top of the file, after the existing type definitions (around line 82), add:

```typescript
type DashboardStats = {
    totalUsers: number;
    newThisWeek: number;
    dormantCount: number;
    avgHealthScore: number | null;
    weeklySignups: { week: string; count: number }[];
    dailySignups: { date: string; count: number }[];
};
```

Inside `AdminDashboardPage`, add new state after the existing state declarations (around line 144):

```typescript
const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
```

- [ ] **Step 2: Add the fetch to `loadAdminData`**

Replace the existing `loadAdminData` function body so the `Promise.all` includes the new endpoint:

```typescript
async function loadAdminData() {
    setIsLoading(true);
    try {
        const [queueRes, sourceRes, companyRes, statsRes] = await Promise.all([
            fetch('/api/admin/queue-stats', { cache: 'no-store' }),
            fetch('/api/admin/source-health', { cache: 'no-store' }),
            fetch('/api/admin/companies', { cache: 'no-store' }),
            fetch('/api/admin/dashboard-stats', { cache: 'no-store' }),
        ]);

        const queueJson = await queueRes.json();
        const sourceJson = await sourceRes.json();
        const companyJson = await companyRes.json();
        const statsJson = await statsRes.json();

        setQueueStats(queueRes.ok ? queueJson : null);
        setSources(sourceRes.ok ? sourceJson.sources ?? [] : []);
        setCompanies(companyRes.ok ? companyJson.companies ?? [] : []);
        setDashboardStats(statsRes.ok ? statsJson : null);
    } finally {
        setIsLoading(false);
    }
}
```

- [ ] **Step 3: Replace the import line for admin-data**

Find this line near the top of the file:
```typescript
import { adminSignals, leadGenKpis, userPlanDistribution, weeklySignups } from '@/components/admin/admin-data';
```

Replace it with:
```typescript
import { adminSignals } from '@/components/admin/admin-data';
```

- [ ] **Step 4: Remove the hardcoded `activitySeries` constant**

Delete the `activitySeries` constant (lines ~95–127 in the original file, the `const activitySeries: Record<RangeKey, ...>` block).

Add a derived variable in its place, just before `const activeCompanies`:

```typescript
const chartData: { label: string; count: number }[] = (() => {
    if (!dashboardStats) return [];
    const days = selectedRange === '90d' ? 90 : selectedRange === '30d' ? 30 : 7;
    return dashboardStats.dailySignups
        .slice(-days)
        .map((d) => ({ label: d.date.slice(5), count: d.count })); // "MM-DD"
})();
```

- [ ] **Step 5: Wire the Lead Gen KPI strip**

Find the section that renders the 5 KPI cards (around line 423). Replace all five hardcoded values:

```typescript
// BEFORE (five items):
{ label: 'Total users', value: leadGenKpis.totalUsers.toLocaleString(), ... }
{ label: 'Activated this week', value: leadGenKpis.activatedThisWeek.toLocaleString(), ... }
{ label: 'Free → Pro conversion', value: `${leadGenKpis.freeToProConversion}%`, ... }
{ label: 'Avg health score', value: String(leadGenKpis.avgHealthScore), ... }
{ label: 'Dormant users', value: leadGenKpis.dormantCount.toLocaleString(), ... }

// AFTER:
{ label: 'Total users', value: dashboardStats ? dashboardStats.totalUsers.toLocaleString() : '—', sub: 'All-time signups', ... }
{ label: 'Activated this week', value: dashboardStats ? dashboardStats.newThisWeek.toLocaleString() : '—', sub: 'New users in last 7 days', ... }
{ label: 'Free → Pro conversion', value: '—', sub: 'Billing not yet live', ... }
{ label: 'Avg health score', value: '—', sub: 'Coming soon', ... }
{ label: 'Dormant users', value: dashboardStats ? dashboardStats.dormantCount.toLocaleString() : '—', sub: 'No activity in 14+ days', ... }
```

The full replacement block for the five KPI items array (find the array literal that starts with `icon: Users` and ends with `icon: AlertTriangle`):

```typescript
{
    icon: Users,
    label: 'Total users',
    value: dashboardStats ? dashboardStats.totalUsers.toLocaleString() : '—',
    sub: 'All-time signups',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
},
{
    icon: TrendingUp,
    label: 'Activated this week',
    value: dashboardStats ? dashboardStats.newThisWeek.toLocaleString() : '—',
    sub: 'New users in last 7 days',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
},
{
    icon: Zap,
    label: 'Free → Pro conversion',
    value: '—',
    sub: 'Billing not yet live',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
},
{
    icon: Activity,
    label: 'Avg health score',
    value: '—',
    sub: 'Coming soon',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
},
{
    icon: AlertTriangle,
    label: 'Dormant users',
    value: dashboardStats ? dashboardStats.dormantCount.toLocaleString() : '—',
    sub: 'No activity in 14+ days',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
},
```

- [ ] **Step 6: Wire the activity area chart to real data**

Find the `<AreaChart data={chartData}` section. The `chartData` variable now holds `{ label, count }` objects instead of `{ label, visitors, qualified }`.

Find the ChartContainer config for the area chart. It currently has `visitors` and `qualified` keys. Replace the entire ChartContainer for the area chart with:

```typescript
<ChartContainer
    className="h-48 w-full"
    config={{
        count: { label: 'New signups', color: 'var(--color-chart-1)' },
    }}
>
    <AreaChart data={chartData} margin={{ left: 2, right: 8, top: 12, bottom: 0 }}>
        <defs>
            <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.38} />
                <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.04} />
            </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
            dataKey="count"
            type="monotone"
            stroke="var(--color-chart-1)"
            strokeWidth={1.8}
            fill="url(#signupsFill)"
        />
    </AreaChart>
</ChartContainer>
```

Also find the area chart's title/label — change it from "Visitor activity" (or similar) to "New signups over time".

- [ ] **Step 7: Wire the weekly signups line chart**

Find `<LineChart data={weeklySignups}` (around line 917). Replace `weeklySignups` with `dashboardStats?.weeklySignups ?? []`:

```typescript
<LineChart data={dashboardStats?.weeklySignups ?? []} margin={{ left: 2, right: 8, top: 8, bottom: 0 }}>
```

The data shape is identical (`{ week, count }`/`{ week, signups }`) — confirm the `dataKey` on the `<Line>` component matches. If the existing `<Line>` has `dataKey="signups"`, update it to `dataKey="count"` since our API returns `count`.

- [ ] **Step 8: Wire the plan distribution pie chart**

Find the `<PieChart>` section. Replace `data={userPlanDistribution}` with a single-item array showing all users as Free:

```typescript
const planData = [{ plan: 'Free', count: dashboardStats?.totalUsers ?? 0 }]
```

Add this derived variable near the other derived variables (before `return (`).

Then replace:
- `data={userPlanDistribution}` → `data={planData}`
- The three `<Cell>` elements → a single `<Cell fill="hsl(217, 91%, 60%)" />`
- The legend map below: replace `{userPlanDistribution.map(...)}` with a static row showing "Free — 100%"

The legend replacement:
```typescript
<div className="w-full space-y-2">
    <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full" style={{ background: 'hsl(217, 91%, 60%)' }} />
            Free
        </span>
        <span className="font-medium tabular-nums">{(dashboardStats?.totalUsers ?? 0).toLocaleString()}</span>
        <span className="text-muted-foreground">100%</span>
    </div>
    <p className="text-xs text-muted-foreground mt-2">Billing not yet live — all users are on the free tier.</p>
</div>
```

- [ ] **Step 9: Verify the page compiles and renders**

```bash
npx next build 2>&1 | tail -20
```

Expected: no TypeScript errors. Then run `npx next dev` and visit the admin dashboard. KPI numbers should reflect real DB counts.

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/[adminId]/page.tsx src/components/admin/admin-data.ts
git commit -m "feat: wire dashboard to real database data"
```

---

## Task 5: Clean up unused exports from admin-data.ts

**Files:**
- Modify: `src/components/admin/admin-data.ts`

- [ ] **Step 1: Check which exports are still used**

```bash
grep -rn "leadGenKpis\|userPlanDistribution\|weeklySignups" src/ --include="*.ts" --include="*.tsx"
```

Expected: zero results after the page.tsx changes in Task 4.

- [ ] **Step 2: Remove the unused exports**

In `src/components/admin/admin-data.ts`, delete:
- The `leadGenKpis` export object
- The `userPlanDistribution` export array
- The `weeklySignups` export array

Keep: `AdminUserRecord`, `AdminJobRecord`, `AdminInterviewRecord`, `adminUsers`, `adminJobs`, `adminInterviews`, `adminSignals` — these are used by the users/jobs/interviews sub-pages.

- [ ] **Step 3: Verify no import errors**

```bash
npx next build 2>&1 | grep -i "error\|cannot find"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/admin-data.ts
git commit -m "chore: remove unused mock data exports from admin-data.ts"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `lastActiveAt` field added to User — Task 1
- ✅ Middleware updates `lastActiveAt` on authenticated requests — Task 2
- ✅ Rate-limited (5 min) via SQL WHERE clause — Task 2 Step 1
- ✅ `/api/admin/dashboard-stats` endpoint — Task 3
- ✅ totalUsers, newThisWeek, dormantCount wired — Task 4 Step 5
- ✅ Free→Pro and health score show `"—"` with explanation — Task 4 Step 5
- ✅ Weekly signups chart uses real DB data — Task 4 Step 7
- ✅ Activity chart repurposed to daily signups — Task 4 Step 6
- ✅ Plan pie chart shows single Free slice — Task 4 Step 8
- ✅ Error handling (null state → "—") — Task 4 Steps 5–8
- ✅ Unused mock data cleaned up — Task 5

**Type consistency check:**
- `DashboardStats.weeklySignups` → `{ week: string; count: number }[]` — matches API response shape and `dataKey="count"` in chart
- `DashboardStats.dailySignups` → `{ date: string; count: number }[]` — `chartData` maps to `{ label, count }` — matches `dataKey="count"` in AreaChart
- `planData` → `{ plan: string; count: number }[]` — matches legend rendering

**Placeholder scan:** None found.
