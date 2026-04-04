'use client';

import { useEffect, useState } from 'react';
import { Search, Building2, ExternalLink, PlusCircle, Globe } from 'lucide-react';
import { useParams } from 'next/navigation';

import { AdminIdentity, AdminPageIntro, AdminPanel, AdminStatCard } from '@/components/admin/admin-ui';
import { CompanyDrawer } from '@/components/admin/CompanyDrawer';
import { AddCompanyDrawer } from '@/components/admin/AddCompanyDrawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { AdminCompanySummary, AdminCompanyDetail } from '@/lib/admin/types';

export default function CompaniesPage() {
  const params = useParams<{ adminId: string }>();
  const adminId = params.adminId;

  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<AdminCompanySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<AdminCompanyDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('jobs-desc');

  async function loadCompanies() {
    setIsLoading(true);
    setPageMessage(null);

    try {
      const response = await fetch('/api/admin/branding/companies', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load companies');
      }

      setCompanies(payload.companies ?? []);
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : 'Unable to load companies');
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  async function handleRowClick(companyId: string) {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setSelectedCompany(null);

    try {
      const response = await fetch(`/api/admin/branding/companies/${companyId}`, { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load company detail');
      }

      setSelectedCompany(payload.company ?? null);
    } catch (error) {
      setSelectedCompany(null);
      setPageMessage(error instanceof Error ? error.message : 'Unable to load company detail');
    } finally {
      setDrawerLoading(false);
    }
  }

  const filteredCompanies = companies
    .filter((company) => {
      const normalizedQuery = query.trim().toLowerCase();
      return (
        !normalizedQuery ||
        company.name.toLowerCase().includes(normalizedQuery) ||
        (company.domain && company.domain.toLowerCase().includes(normalizedQuery))
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'jobs-desc':
          return b.jobCount - a.jobCount;
        case 'jobs-asc':
          return a.jobCount - b.jobCount;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'updated-desc':
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        case 'updated-asc':
          return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
        default:
          return 0;
      }
    });

  const totalCompanies = companies.length;
  const companiesWithLogos = companies.filter((c) => c.logoUrl).length;
  const totalJobs = companies.reduce((acc, c) => acc + (c.jobCount || 0), 0);
  const pendingLogos = companies.filter((c) => !c.logoUrl).length;

  return (
    <div className="admin-view">
      <AdminPageIntro
        eyebrow="Company management"
        title="Companies"
        description="Manage company branding, logos, and presence. Updates reflect instantly across all job listings."
      />

      <section className="admin-card-grid">
        <AdminStatCard label="Total companies" value={String(totalCompanies)} detail="Unique company records stored in the database." />
        <AdminStatCard label="With logos" value={String(companiesWithLogos)} detail="Companies that currently have a valid logo URL assigned." />
        <AdminStatCard label="Total job listings" value={String(totalJobs)} detail="Sum of all jobs processed and linked to these companies." />
        <AdminStatCard label="Pending logos" value={String(pendingLogos)} detail="Companies missing a logo; these will show fallback icons." trend={pendingLogos > 0 ? "Action needed" : "Clean"} />
      </section>

      <AdminPanel
        flush
        title="Company directory"
        description="Click any row to manage logos, domains, and branding for that company."
        action={
          <div className="admin-panel-toolbar">
            <div className="relative admin-panel-search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search companies or domains..."
                className="w-full pl-9"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-2">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] h-10 border-muted-foreground/20">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jobs-desc">Jobs: Most to Least</SelectItem>
                  <SelectItem value="jobs-asc">Jobs: Least to Most</SelectItem>
                  <SelectItem value="name-asc">Name: A to Z</SelectItem>
                  <SelectItem value="name-desc">Name: Z to A</SelectItem>
                  <SelectItem value="updated-desc">Date: Newest Updated</SelectItem>
                  <SelectItem value="updated-asc">Date: Oldest Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => setAddDrawerOpen(true)}
              className="h-10 px-4 font-bold shadow-sm shadow-primary/10 transition-all hover:shadow-primary/20"
            >
              <PlusCircle className="mr-2 size-4" />
              Add Company
            </Button>
          </div>
        }
      >
        <div className="admin-table-wrap">
          <Table className="admin-wide-table">
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Job Listings</TableHead>
                <TableHead>Branding Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id} className="group cursor-pointer" onClick={() => void handleRowClick(company.id)}>
                  <TableCell className="align-top whitespace-normal min-w-[16rem]">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-white shadow-sm overflow-hidden mb-1">
                        {company.logoUrl ? (
                          <img src={company.logoUrl} alt={company.name} className="size-full object-contain" />
                        ) : (
                          <Building2 className="size-5 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-semibold text-foreground truncate">{company.name}</p>
                        <p className="text-xs text-muted-foreground truncate italic">System ID: {company.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    {company.domain ? (
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Globe className="size-3.5 text-muted-foreground" />
                        {company.domain}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground font-normal italic">None set</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-semibold text-foreground">
                        {company.jobCount} {company.jobCount === 1 ? 'job' : 'jobs'}
                      </div>
                      <p className="text-xs text-muted-foreground">linked in database</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap items-center gap-2">
                       {company.logoUrl ? (
                         <Badge variant="outline" className="border-green-500/20 bg-green-500/5 text-green-600">
                           Logo OK
                         </Badge>
                       ) : (
                         <Badge variant="outline" className="border-destructive/20 bg-destructive/5 text-destructive">
                           Missing Logo
                         </Badge>
                       )}
                       {company.logoFetched && (
                         <Badge variant="outline" className="text-[10px] opacity-70">Auto</Badge>
                       )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {company.updatedAt ? new Date(company.updatedAt).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!filteredCompanies.length ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="admin-empty-state">
                      {isLoading ? 'Loading companies...' : pageMessage ?? 'No companies matched the current filters.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </AdminPanel>

      <CompanyDrawer
        company={selectedCompany}
        adminId={adminId}
        open={drawerOpen}
        loading={drawerLoading}
        onOpenChange={setDrawerOpen}
        onUpdated={() => {
          setDrawerOpen(false);
          void loadCompanies();
        }}
        onDeleted={() => {
          void loadCompanies();
        }}
      />

      <AddCompanyDrawer
        adminId={adminId}
        open={addDrawerOpen}
        onOpenChange={setAddDrawerOpen}
        onCreated={() => {
          void loadCompanies();
        }}
      />
    </div>
  );
}
