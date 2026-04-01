'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, PieChart, Pie, Cell, LineChart, Line, YAxis } from 'recharts';
import {
    Activity,
    AlertTriangle,
    Database,
    LoaderCircle,
    Plus,
    RefreshCcw,
    ShieldAlert,
    Sparkles,
    TowerControl,
    TrendingUp,
    Users,
    Workflow,
    Zap,
} from 'lucide-react';

import { adminSignals } from '@/components/admin/admin-data';
import { AdminMiniList, AdminPageIntro, AdminPanel, DashboardCard } from '@/components/admin/admin-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type QueueStats = {
    pending: number;
    processing: number;
    completed24h: number;
    failed24h: number;
    dead: number;
    avgProcessingMs: number | null;
    oldestPending: string | null;
};

type SourceHealth = {
    source: string;
    totalPolls: number;
    errorRate: number;
    avgDurationMs: number | null;
    totalJobsFound: number;
    lastPollAt: string | null;
};

type TrackedCompany = {
    id: string;
    slug: string;
    name: string;
    ats: string;
    industry: string | null;
    country: string | null;
    isActive: boolean;
};

type RangeKey = '90d' | '30d' | '7d';
type WorkspaceKey = 'companies' | 'sources' | 'notes';

type DashboardStats = {
    totalUsers: number;
    newThisWeek: number;
    dormantCount: number;
    avgHealthScore: number | null;
    weeklySignups: { week: string; count: number }[];
    dailySignups: { date: string; count: number }[];
};

const companySeed = {
    slug: '',
    name: '',
    ats: 'greenhouse',
    industry: '',
    country: '',
    websiteUrl: '',
    logoUrl: '',
};


const workspaceTabs: Array<{ key: WorkspaceKey; label: string }> = [
    { key: 'companies', label: 'Tracked companies' },
    { key: 'sources', label: 'Source health' },
    { key: 'notes', label: 'Collection notes' },
];

export default function AdminDashboardPage() {
    const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
    const [sources, setSources] = useState<SourceHealth[]>([]);
    const [companies, setCompanies] = useState<TrackedCompany[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActing, setIsActing] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [selectedRange, setSelectedRange] = useState<RangeKey>('90d');
    const [workspaceView, setWorkspaceView] = useState<WorkspaceKey>('companies');
    const [form, setForm] = useState(companySeed);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

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

    useEffect(() => {
        loadAdminData();
    }, []);

    async function runAdminAction(endpoint: string, successLabel: string) {
        setIsActing(true);
        setActionMessage(null);

        try {
            const response = await fetch(endpoint, { method: 'POST' });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error ?? 'Action failed');
            }

            const summary = Object.entries(payload)
                .filter(([key]) => key !== 'ok')
                .map(([key, value]) => `${key}: ${value}`)
                .join(' | ');

            setActionMessage(summary ? `${successLabel} | ${summary}` : successLabel);
            await loadAdminData();
        } catch (error) {
            setActionMessage(error instanceof Error ? error.message : 'Unexpected admin action failure');
        } finally {
            setIsActing(false);
        }
    }

    async function toggleCompany(company: TrackedCompany) {
        setIsActing(true);
        setActionMessage(null);

        try {
            const response = await fetch(`/api/admin/companies/${company.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !company.isActive }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error ?? 'Unable to update company');
            }

            setActionMessage(`${company.name} is now ${payload.company.isActive ? 'active' : 'paused'}.`);
            await loadAdminData();
        } catch (error) {
            setActionMessage(error instanceof Error ? error.message : 'Unable to update company');
        } finally {
            setIsActing(false);
        }
    }
    async function createCompany() {
        setIsActing(true);
        setActionMessage(null);

        try {
            const response = await fetch('/api/admin/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    industry: form.industry || null,
                    country: form.country || null,
                    websiteUrl: form.websiteUrl || null,
                    logoUrl: form.logoUrl || null,
                }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error ?? 'Unable to create tracked company');
            }

            setActionMessage(`Tracking ${payload.company.name} for ${payload.company.ats}.`);
            setForm(companySeed);
            setIsDialogOpen(false);
            await loadAdminData();
        } catch (error) {
            setActionMessage(error instanceof Error ? error.message : 'Unable to create tracked company');
        } finally {
            setIsActing(false);
        }
    }

    const chartData: { label: string; count: number }[] = (() => {
        if (!dashboardStats) return [];
        const days = selectedRange === '90d' ? 90 : selectedRange === '30d' ? 30 : 7;
        return dashboardStats.dailySignups
            .slice(-days)
            .map((d) => ({ label: d.date.slice(5), count: d.count }));
    })();

    const planData = [{ plan: 'Free', count: dashboardStats?.totalUsers ?? 0 }];

    const activeCompanies = companies.filter((company) => company.isActive).length;
    const healthySources = sources.filter((source) => source.errorRate === 0).length;

    const statCards = [
        {
            label: 'Jobs processed',
            value: (queueStats?.completed24h ?? 0).toLocaleString(),
            detail: 'Successful queue completions in the last 24 hours.',
            trend: queueStats?.failed24h ? `${queueStats.failed24h} failed` : 'Stable',
        },
        {
            label: 'Active companies',
            value: activeCompanies.toLocaleString(),
            detail: 'Tracked ATS targets currently allowed to ingest.',
            trend: companies.length ? `${companies.length} total` : 'No targets',
        },
        {
            label: 'Healthy sources',
            value: healthySources.toLocaleString(),
            detail: 'Sources running without recorded error drift.',
            trend: sources.length ? `${sources.length} monitored` : 'Pending',
        },
        {
            label: 'Queue backlog',
            value: ((queueStats?.pending ?? 0) + (queueStats?.dead ?? 0)).toLocaleString(),
            detail: 'Pending and dead-letter items still waiting on action.',
            trend: queueStats?.processing ? `${queueStats.processing} processing` : 'Idle',
        },
    ];

    const priorityItems = [
        queueStats?.dead
            ? {
                title: 'Dead-letter queue needs review',
                detail: `${queueStats.dead} ingestion jobs exhausted retries and should be retried or drained.`,
                tone: 'Retry queue',
            }
            : {
                title: 'Dead-letter queue is clear',
                detail: 'No failed ingestion jobs are waiting on operator intervention right now.',
                tone: 'Healthy',
            },
        ...adminSignals,
    ].slice(0, 4);

    const sourceSnapshot = sources.slice(0, 4);

    return (
        <div className="flex flex-col gap-6 py-8 md:gap-8 md:py-10">

            {/* Page intro */}
            <div className="px-6 lg:px-8">
                <AdminPageIntro
                    eyebrow="Admin dashboard"
                    title="Operations dashboard"
                    description="Monitor job ingestion, source health, user activation, and tracked company coverage across the platform."
                    actions={
                        <>
                            <Button
                                variant="outline"
                                className="rounded-xl border-border/80 bg-background/80 px-4"
                                onClick={() => loadAdminData()}
                            >
                                <RefreshCcw className="size-4" />
                                Refresh data
                            </Button>

                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger render={<Button className="rounded-xl px-4" />}>
                                    <Plus className="size-4" />
                                    Track company
                                </DialogTrigger>
                                <DialogContent className="max-w-xl rounded-[1.25rem] border border-border/80 bg-popover">
                                    <DialogHeader>
                                        <DialogTitle>Add a tracked company</DialogTitle>
                                        <DialogDescription>
                                            Create a new ATS watch target without leaving the admin workspace.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Company name</label>
                                            <Input
                                                value={form.name}
                                                onChange={(event) =>
                                                    setForm((current) => ({ ...current, name: event.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Slug</label>
                                            <Input
                                                value={form.slug}
                                                onChange={(event) =>
                                                    setForm((current) => ({ ...current, slug: event.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">ATS</label>
                                            <Select
                                                value={form.ats}
                                                onValueChange={(value) =>
                                                    setForm((current) => ({ ...current, ats: value ?? current.ats }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="greenhouse">Greenhouse</SelectItem>
                                                    <SelectItem value="lever">Lever</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Country</label>
                                            <Input
                                                value={form.country}
                                                onChange={(event) =>
                                                    setForm((current) => ({ ...current, country: event.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Industry</label>
                                            <Input
                                                value={form.industry}
                                                onChange={(event) =>
                                                    setForm((current) => ({ ...current, industry: event.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Website</label>
                                            <Input
                                                value={form.websiteUrl}
                                                onChange={(event) =>
                                                    setForm((current) => ({ ...current, websiteUrl: event.target.value }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    <DialogFooter className="rounded-b-[1.25rem]">
                                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={() => createCompany()}
                                            disabled={!form.name || !form.slug || !form.ats || isActing}
                                        >
                                            Create tracked source
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    }
                />
            </div>

            {/* Lead gen KPI strip */}
            <div className="px-6 lg:px-8">
              <div className="grid grid-cols-2 gap-3 @xl/main:grid-cols-3 @5xl/main:grid-cols-5">
                {[
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
                ].map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <div
                      key={kpi.label}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${kpi.bg}`}>
                        <Icon className={`size-4 ${kpi.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                        <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* System health */}
            <div className="px-6 lg:px-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">System health</p>
            </div>

            {/* Stat cards — container-query responsive grid */}
            <div className="grid gap-4 px-6 lg:px-8 md:gap-5 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                {statCards.map((card) => (
                    <DashboardCard
                        key={card.label}
                        title={card.label}
                        value={card.value}
                        description={card.detail}
                        badge={card.trend}
                    />
                ))}
            </div>

            {/* Chart + operator controls */}
            <div className="px-6 lg:px-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px_360px]">
                <AdminPanel
                    title="New signups over time"
                    description="Daily new user registrations for the selected time range."
                    className="[&_[data-slot='card-content']]:p-5"
                    action={
                        <div className="admin-segmented">
                            {[
                                { key: '90d' as const, label: 'Last 3 months' },
                                { key: '30d' as const, label: 'Last 30 days' },
                                { key: '7d' as const, label: 'Last 7 days' },
                            ].map((range) => (
                                <button
                                    key={range.key}
                                    type="button"
                                    className={cn(
                                        'admin-segmented-button',
                                        selectedRange === range.key && 'is-active'
                                    )}
                                    onClick={() => setSelectedRange(range.key)}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    }
                >
                    <div className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="panel-inline-stat">
                                <p className="panel-inline-stat-label">Total visitors</p>
                                <p className="panel-inline-stat-value">45,678</p>
                                <p className="panel-inline-stat-sub">Total for the active range</p>
                            </div>
                            <div className="panel-inline-stat">
                                <p className="panel-inline-stat-label">Qualified sessions</p>
                                <p className="panel-inline-stat-value">18,234</p>
                                <p className="panel-inline-stat-sub">Sessions with downstream conversion intent</p>
                            </div>
                            <div className="panel-inline-stat">
                                <p className="panel-inline-stat-label">Avg processing</p>
                                <p className="panel-inline-stat-value">
                                    {queueStats?.avgProcessingMs ? `${Math.round(queueStats.avgProcessingMs)} ms` : 'Idle'}
                                </p>
                                <p className="panel-inline-stat-sub">Mean queue runtime for the latest window</p>
                            </div>
                        </div>

                        <div className="admin-chart-wrap">
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
                        </div>
                    </div>
                </AdminPanel>

                <AdminPanel
                  title="Users by plan"
                  description="Current distribution of Free, Pro, and Premium accounts."
                >
                  <div className="flex flex-col items-center gap-4">
                    <ChartContainer
                      className="h-[200px] w-full"
                      config={{
                        free: { label: 'Free', color: 'hsl(217, 91%, 60%)' },
                        pro: { label: 'Pro', color: 'hsl(262, 83%, 58%)' },
                        premium: { label: 'Premium', color: 'hsl(142, 71%, 45%)' },
                      }}
                    >
                      <PieChart>
                        <Pie
                          data={planData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={84}
                          paddingAngle={3}
                          dataKey="count"
                        >
                          <Cell fill="hsl(217, 91%, 60%)" />
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>

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
                  </div>
                </AdminPanel>

                <div className="space-y-5">
                    <AdminPanel
                        title="Operator controls"
                        description="Run the existing maintenance actions without leaving the dashboard."
                    >
                        <div className="space-y-4">
                            {/* Queue operations */}
                            <div className="admin-action-group">
                                <p className="admin-action-group-label">Queue</p>
                                <Button
                                    className="h-11 w-full justify-start rounded-xl px-4"
                                    onClick={() => runAdminAction('/api/admin/backfill', 'Backfill completed')}
                                    disabled={isActing}
                                >
                                    {isActing ? (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    ) : (
                                        <Database className="size-4" />
                                    )}
                                    Backfill missing source data
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-11 w-full justify-start rounded-xl border-border/80 bg-background/80 px-4"
                                    onClick={() => runAdminAction('/api/admin/queue/retry-dead', 'Dead jobs re-queued')}
                                    disabled={isActing}
                                >
                                    <Workflow className="size-4" />
                                    Retry dead queue items
                                </Button>
                            </div>

                            {/* Configuration */}
                            <div className="admin-action-group">
                                <p className="admin-action-group-label">Configuration</p>
                                <Button
                                    variant="outline"
                                    className="h-11 w-full justify-start rounded-xl border-border/80 bg-background/80 px-4"
                                    onClick={() => runAdminAction('/api/admin/seed-companies', 'Seed companies synced')}
                                    disabled={isActing}
                                >
                                    <Sparkles className="size-4" />
                                    Seed tracked company defaults
                                </Button>
                            </div>

                            {/* Danger zone */}
                            <div className="admin-action-divider" />
                            <div className="admin-action-group">
                                <p className="admin-action-group-label">Danger zone</p>
                                <Button
                                    variant="destructive"
                                    className="h-11 w-full justify-start rounded-xl px-4"
                                    onClick={() => runAdminAction('/api/admin/queue/drain', 'Pending queue drained')}
                                    disabled={isActing}
                                >
                                    <ShieldAlert className="size-4" />
                                    Drain pending queue
                                </Button>
                            </div>
                        </div>

                        <div className="admin-action-result">
                            <p className="admin-action-result-label">Last operator result</p>
                            <p className="admin-action-result-text">
                                {actionMessage ?? 'No action has been triggered yet.'}
                            </p>
                        </div>
                    </AdminPanel>

                    <AdminPanel
                        title="Priority queue"
                        description="Signals that deserve a decision from the admin team this week."
                    >
                        <AdminMiniList items={priorityItems} />
                    </AdminPanel>
                </div>
            </div>
            </div>

            {/* Workspace panel */}
            <div className="px-6 lg:px-8">
            <AdminPanel
                flush
                title="Workspace"
                description="Switch between tracked companies, source telemetry, and collection guidance."
            >
                <div className="space-y-4 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="admin-tabbar">
                            {workspaceTabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={cn('admin-tab', workspaceView === tab.key && 'is-active')}
                                    onClick={() => setWorkspaceView(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <Button variant="outline" className="rounded-xl border-border/80 bg-background/80 px-4">
                            Customize columns
                        </Button>
                    </div>

                    {workspaceView === 'companies' ? (
                        <div className="admin-table-wrap">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Company</TableHead>
                                        <TableHead>ATS</TableHead>
                                        <TableHead>Industry</TableHead>
                                        <TableHead>Country</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {companies.map((company) => (
                                        <TableRow key={company.id}>
                                            <TableCell className="min-w-[220px]">
                                                <div className="space-y-1">
                                                    <p className="font-medium text-foreground">{company.name}</p>
                                                    <p className="text-sm text-muted-foreground">{company.slug}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="rounded-md px-2 py-0.5 uppercase">
                                                    {company.ats}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{company.industry ?? 'Not set'}</TableCell>
                                            <TableCell>{company.country ?? 'Not set'}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={company.isActive ? 'secondary' : 'outline'}
                                                    className="rounded-md px-2 py-0.5"
                                                >
                                                    {company.isActive ? 'Active' : 'Paused'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl border-border/80 bg-background/80"
                                                    onClick={() => toggleCompany(company)}
                                                    disabled={isActing}
                                                >
                                                    {company.isActive ? 'Pause ingestion' : 'Resume ingestion'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {!companies.length ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                                {isLoading ? 'Loading tracked companies...' : 'No tracked companies found yet.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}

                    {workspaceView === 'sources' ? (
                        <div className="admin-table-wrap">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Polls</TableHead>
                                        <TableHead>Error rate</TableHead>
                                        <TableHead>Jobs found</TableHead>
                                        <TableHead>Avg duration</TableHead>
                                        <TableHead>Last poll</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sources.map((source) => (
                                        <TableRow key={source.source}>
                                            <TableCell className="font-medium capitalize text-foreground">
                                                {source.source}
                                            </TableCell>
                                            <TableCell>{source.totalPolls}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={source.errorRate > 0 ? 'destructive' : 'secondary'}
                                                    className="rounded-md px-2 py-0.5"
                                                >
                                                    {Math.round(source.errorRate * 100)}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{source.totalJobsFound}</TableCell>
                                            <TableCell>
                                                {source.avgDurationMs ? `${source.avgDurationMs} ms` : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {source.lastPollAt
                                                    ? new Date(source.lastPollAt).toLocaleString()
                                                    : 'No runs yet'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {!sources.length ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                                {isLoading ? 'Loading source health...' : 'No source health data available.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}

                    {workspaceView === 'notes' ? (
                        <div className="grid gap-4 lg:grid-cols-3">
                            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                                <p className="text-sm font-semibold text-foreground">Preference completion nudges</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Prioritize users missing compensation, commute, or seniority preferences before
                                    those gaps affect match quality.
                                </p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                                <p className="text-sm font-semibold text-foreground">Source confidence review</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Pause noisy ATS targets earlier when job freshness or fit score drifts away from
                                    healthy ranges.
                                </p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                                <p className="text-sm font-semibold text-foreground">Recovery targeting</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Pair dormant user cohorts with resume prompts, preference reminders, and faster
                                    sourcing refresh windows.
                                </p>
                            </div>
                        </div>
                    ) : null}
                </div>
            </AdminPanel>
            </div>

            {/* Signups trend */}
            <div className="px-6 lg:px-8">
              <AdminPanel
                title="User signups"
                description="Weekly new user registrations over the last 9 weeks."
              >
                <div className="px-2 pb-2 pt-1">
                <ChartContainer
                  className="h-[180px] w-full"
                  config={{
                    signups: { label: 'Signups', color: 'var(--color-chart-3)' },
                  }}
                >
                  <LineChart data={dashboardStats?.weeklySignups ?? []} margin={{ left: 2, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="week"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis axisLine={false} tickLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-chart-3)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--color-chart-3)', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
                </div>
              </AdminPanel>
            </div>

            {/* Bottom panels */}
            <div className="px-6 lg:px-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <AdminPanel
                    title="Tracked company pulse"
                    description="Active ATS targets and their current ingestion posture."
                    action={
                        <div className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-background/80 px-3 py-1.5 text-sm text-foreground">
                            <TowerControl className="size-4 text-primary" />
                            {companies.length} tracked
                        </div>
                    }
                >
                    <div className="space-y-3">
                        {companies.slice(0, 4).map((company) => (
                            <div
                                key={company.id}
                                className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-foreground">{company.name}</p>
                                        <Badge
                                            variant={company.isActive ? 'secondary' : 'outline'}
                                            className="rounded-md px-2 py-0.5"
                                        >
                                            {company.isActive ? 'Active' : 'Paused'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {company.industry ?? 'Industry not set'} · {company.country ?? 'Country not set'}
                                    </p>
                                </div>
                                <Badge variant="outline" className="w-fit rounded-md px-2 py-0.5 uppercase">
                                    {company.ats}
                                </Badge>
                            </div>
                        ))}
                        {!companies.length ? (
                            <p className="rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                                {isLoading ? 'Loading tracked companies...' : 'No tracked companies found yet.'}
                            </p>
                        ) : null}
                    </div>
                </AdminPanel>

                <AdminPanel
                    title="Source health snapshot"
                    description="Latest polling results across monitored ingestion sources."
                >
                    <div className="space-y-3">
                        {sourceSnapshot.map((source) => (
                            <div
                                key={source.source}
                                className="rounded-xl border border-border/70 bg-background/70 px-4 py-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-medium capitalize text-foreground">{source.source}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {source.totalJobsFound} jobs found · {source.totalPolls} polls
                                        </p>
                                    </div>
                                    <Badge
                                        variant={source.errorRate > 0 ? 'destructive' : 'secondary'}
                                        className="rounded-md px-2 py-0.5"
                                    >
                                        {Math.round(source.errorRate * 100)}% errors
                                    </Badge>
                                </div>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    Avg duration: {source.avgDurationMs ? `${source.avgDurationMs} ms` : 'No data yet'}
                                </p>
                            </div>
                        ))}
                        {!sourceSnapshot.length ? (
                            <p className="rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                                {isLoading ? 'Loading source telemetry...' : 'No source health data available.'}
                            </p>
                        ) : null}
                    </div>
                </AdminPanel>
            </div>
            </div>

        </div>
    );
}

