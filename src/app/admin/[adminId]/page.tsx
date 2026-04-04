'use client';

import { useEffect, useState } from 'react';
import { Building2, LoaderCircle, Plus, RefreshCcw, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { AdminPageIntro, AdminPanel, AdminStatCard } from '@/components/admin/admin-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
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
import type { AdminDashboardStats } from '@/lib/admin/types';
import { cn } from '@/lib/utils';

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
type WorkspaceKey = 'companies' | 'sources';

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
];

export default function AdminDashboardPage() {
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [companies, setCompanies] = useState<TrackedCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeKey>('90d');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceKey>('companies');
  const [form, setForm] = useState(companySeed);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats | null>(null);

  async function loadAdminData() {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const [sourceRes, companyRes, statsRes] = await Promise.all([
        fetch('/api/admin/source-health', { cache: 'no-store' }),
        fetch('/api/admin/companies', { cache: 'no-store' }),
        fetch('/api/admin/dashboard-stats', { cache: 'no-store' }),
      ]);

      const sourceJson = await sourceRes.json();
      const companyJson = await companyRes.json();
      const statsJson = await statsRes.json();

      setSources(sourceRes.ok ? sourceJson.sources ?? [] : []);
      setCompanies(companyRes.ok ? companyJson.companies ?? [] : []);
      setDashboardStats(statsRes.ok ? statsJson : null);

      const firstError =
        (!sourceRes.ok && sourceJson.error) ||
        (!companyRes.ok && companyJson.error) ||
        (!statsRes.ok && statsJson.error) ||
        null;

      if (firstError) {
        setActionMessage(String(firstError));
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

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
      if (!response.ok) throw new Error(payload.error ?? 'Unable to update company');

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
      if (!response.ok) throw new Error(payload.error ?? 'Unable to create tracked company');

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

  const chartData = (() => {
    if (!dashboardStats) return [];
    const days = selectedRange === '90d' ? 90 : selectedRange === '30d' ? 30 : 7;
    return dashboardStats.dailySignups.slice(-days).map((entry) => ({
      label: entry.date.slice(5),
      count: entry.count,
    }));
  })();

  const statCards = [
    {
      label: 'Total signups',
      value: dashboardStats ? dashboardStats.totalUsers.toLocaleString() : '--',
      detail: 'Live Clerk user count across every account that has signed up.',
    },
    {
      label: 'Total jobs',
      value: dashboardStats ? dashboardStats.totalJobs.toLocaleString() : '--',
      detail: 'Current job rows available in the application database.',
    },
    {
      label: 'Total reviews',
      value: dashboardStats ? dashboardStats.totalReviews.toLocaleString() : '--',
      detail: 'Interview experience records currently stored in the database.',
    },
    {
      label: 'Resumes generated',
      value: dashboardStats ? dashboardStats.totalResumesGenerated.toLocaleString() : '--',
      detail: 'Tailored resume generations created from real user job activity.',
    },
  ];

  return (
    <div className="admin-view">
      <AdminPageIntro
        eyebrow="Admin dashboard"
        title="Operations dashboard"
        description="Track signup momentum, watch source quality, and manage tracked companies without leaving the admin surface."
        actions={
          <Button variant="outline" onClick={() => void loadAdminData()}>
            <RefreshCcw className="size-4" />
            Refresh data
          </Button>
        }
      />

      <section className="admin-card-grid">
        {statCards.map((card) => (
          <AdminStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
          />
        ))}
      </section>

      <AdminPanel
        className="admin-chart-panel"
        title="User signup trend"
        description="Daily signup volume across the selected period."
        action={
          <div className="admin-segmented">
            {(['90d', '30d', '7d'] as RangeKey[]).map((range) => (
              <button
                key={range}
                type="button"
                className={cn('admin-segmented-button', selectedRange === range && 'is-active')}
                onClick={() => setSelectedRange(range)}
              >
                {range === '90d' ? 'Last 90 days' : range === '30d' ? 'Last 30 days' : 'Last 7 days'}
              </button>
            ))}
          </div>
        }
      >
        <div className="admin-chart-frame">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" />
            </div>
          ) : !chartData.length ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Signup data will appear here once dashboard stats are available.
            </div>
          ) : (
            <ChartContainer className="h-full w-full" config={{ signups: { label: 'Signups', color: 'var(--chart-1)' } }}>
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="signupsFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--chart-1)"
                  strokeWidth={2.25}
                  fill="url(#signupsFill)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </AdminPanel>

      <AdminPanel
        className="admin-workspace-panel"
        flush
        title={workspaceView === 'companies' ? 'Tracked companies' : 'Source health'}
        description={
          workspaceView === 'companies'
            ? 'Pause or resume ATS targets and keep the company watchlist tidy.'
            : 'Monitor polling reliability, jobs found, and source freshness.'
        }
        action={
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
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
            <button
              onClick={() => setIsDialogOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '14px', padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(15,23,42,0.18)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f172a')}
            >
              <Plus size={16} />
              Track company
            </button>
          </div>
        }
      >
        <div className="admin-workspace-body">
          {actionMessage ? <div className="admin-action-inline">{actionMessage}</div> : null}

          {workspaceView === 'companies' ? (
            <div className="admin-table-wrap">
              <Table className="admin-workspace-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>ATS</TableHead>
                    <TableHead className="hidden xl:table-cell">Coverage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="min-w-[18rem] max-w-[24rem] align-top whitespace-normal">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{company.name}</p>
                          <div className="admin-table-cell-meta">
                            <span>{company.slug}</span>
                            <span className="xl:hidden">{company.industry ?? 'Industry not set'}</span>
                            <span className="xl:hidden">{company.country ?? 'Country not set'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-[1%]">
                        <Badge variant="outline">{company.ats}</Badge>
                      </TableCell>
                      <TableCell className="hidden min-w-[14rem] xl:table-cell">
                        <div className="space-y-1">
                          <p className="text-sm text-foreground">{company.industry ?? 'Industry not set'}</p>
                          <p className="text-sm text-muted-foreground">{company.country ?? 'Country not set'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="w-[1%]">
                        <Badge variant={company.isActive ? 'secondary' : 'outline'}>
                          {company.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[1%]">
                        <Button
                          variant="outline"
                          onClick={() => void toggleCompany(company)}
                          disabled={isActing}
                        >
                          {company.isActive ? 'Pause' : 'Resume'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!companies.length ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="admin-empty-state">
                          {isLoading ? 'Loading tracked companies...' : 'No tracked companies found yet.'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {workspaceView === 'sources' ? (
            <div className="admin-table-wrap">
              <Table className="admin-workspace-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Polls</TableHead>
                    <TableHead>Error rate</TableHead>
                    <TableHead>Jobs found</TableHead>
                    <TableHead className="hidden lg:table-cell">Avg duration</TableHead>
                    <TableHead>Last poll</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.source}>
                      <TableCell className="min-w-[14rem] max-w-[18rem] align-top whitespace-normal">
                        <div className="space-y-1">
                          <p className="font-medium capitalize text-foreground">{source.source}</p>
                          <p className="text-sm text-muted-foreground lg:hidden">
                            {source.avgDurationMs ? `${source.avgDurationMs} ms avg` : 'No duration data'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="w-[1%]">{source.totalPolls}</TableCell>
                      <TableCell className="w-[1%]">
                        <Badge variant={source.errorRate > 0 ? 'destructive' : 'secondary'}>
                          {Math.round(source.errorRate * 100)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[1%]">{source.totalJobsFound}</TableCell>
                      <TableCell className="hidden lg:table-cell w-[1%]">
                        {source.avgDurationMs ? `${source.avgDurationMs} ms` : '-'}
                      </TableCell>
                      <TableCell className="w-[1%]">
                        <div className="space-y-1">
                          <p className="text-sm text-foreground">
                            {source.lastPollAt ? new Date(source.lastPollAt).toLocaleDateString() : 'No runs yet'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {source.lastPollAt ? new Date(source.lastPollAt).toLocaleTimeString() : ''}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!sources.length ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="admin-empty-state">
                          {isLoading ? 'Loading source health...' : 'No source health data available.'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      </AdminPanel>
      {isDialogOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 55, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setIsDialogOpen(false)}
          />
          {/* Centered Modal */}
          <div
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 60, width: '100%', maxWidth: '640px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter, sans-serif', maxHeight: '90vh' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Add Tracked Company</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '2px' }}>ATS Watch Target</div>
                </div>
              </div>
              <button
                onClick={() => setIsDialogOpen(false)}
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { label: 'Company Name', key: 'name', placeholder: 'e.g. OpenAI', required: true },
                  { label: 'Slug', key: 'slug', placeholder: 'e.g. openai', required: true },
                  { label: 'Country', key: 'country', placeholder: 'e.g. US' },
                  { label: 'Industry', key: 'industry', placeholder: 'e.g. AI / Machine Learning' },
                  { label: 'Website URL', key: 'websiteUrl', placeholder: 'https://openai.com' },
                ].map(({ label, key, placeholder, required }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '2px' }}>
                      {label}{required && <span style={{ color: '#f43f5e', marginLeft: '3px' }}>*</span>}
                    </label>
                    <input
                      type="text"
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: '100%', padding: '11px 14px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#0f172a', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '2px' }}>
                    ATS <span style={{ color: '#f43f5e', marginLeft: '3px' }}>*</span>
                  </label>
                  <select
                    value={form.ats}
                    onChange={(e) => setForm((c) => ({ ...c, ats: e.target.value }))}
                    style={{ width: '100%', padding: '11px 14px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#0f172a', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', appearance: 'none', cursor: 'pointer' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="greenhouse">Greenhouse</option>
                    <option value="lever">Lever</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ flexShrink: 0, borderTop: '1px solid #f1f5f9', backgroundColor: '#ffffff', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setIsDialogOpen(false)}
                style={{ fontSize: '14px', fontWeight: 600, color: '#475569', padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              >
                Cancel
              </button>
              <button
                onClick={() => void createCompany()}
                disabled={!form.name || !form.slug || !form.ats || isActing}
                style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 700, fontSize: '14px', padding: '11px 28px', borderRadius: '10px', border: 'none', cursor: (!form.name || !form.slug || !form.ats || isActing) ? 'not-allowed' : 'pointer', opacity: (!form.name || !form.slug || !form.ats || isActing) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 14px rgba(15,23,42,0.2)' }}
              >
                {isActing ? <><LoaderCircle size={15} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : 'Create Tracked Source'}
              </button>
            </div>
          </div>

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </div>
  );
}
