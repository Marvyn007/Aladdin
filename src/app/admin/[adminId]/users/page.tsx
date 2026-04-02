'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { useParams } from 'next/navigation';

import { AdminIdentity, AdminPageIntro, AdminPanel, AdminStatCard } from '@/components/admin/admin-ui';
import { UserDrawer } from '@/components/admin/UserDrawer';
import { Badge } from '@/components/ui/badge';
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
import type { AdminUserDetail, AdminUserSummary } from '@/lib/admin/types';

export default function UsersPage() {
  const params = useParams<{ adminId: string }>();
  const adminId = params.adminId;

  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState('all');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true);
      setPageMessage(null);

      try {
        const response = await fetch('/api/admin/users', { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load users');
        }

        setUsers(payload.users ?? []);
      } catch (error) {
        setPageMessage(error instanceof Error ? error.message : 'Unable to load users');
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadUsers();
  }, []);

  async function handleRowClick(userId: string) {
    setSelectedUserId(userId);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setSelectedUser(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load user detail');
      }

      setSelectedUser(payload.user ?? null);
    } catch (error) {
      setSelectedUser(null);
      setPageMessage(error instanceof Error ? error.message : 'Unable to load user detail');
    } finally {
      setDrawerLoading(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      user.name.toLowerCase().includes(normalizedQuery) ||
      user.email.toLowerCase().includes(normalizedQuery) ||
      user.onboardingStatus.toLowerCase().includes(normalizedQuery);

    return matchesQuery && (segment === 'all' || user.segment === segment);
  });

  const completedOnboarding = users.filter((user) => user.onboardingStatus === 'Complete').length;
  const powerUsers = users.filter((user) => user.segment === 'Power').length;
  const missingResumes = users.filter((user) => user.onboardingStatus === 'Missing Resume').length;
  const noDbProfiles = users.filter((user) => !user.dbProfileExists).length;

  return (
    <div className="admin-view">
      <AdminPageIntro
        eyebrow="User management"
        title="Users"
        description="Live Clerk signups enriched with database-backed applications, resumes, cover letters, onboarding state, and default resume access."
      />

      <section className="admin-card-grid">
        <AdminStatCard label="Users in view" value={String(filteredUsers.length)} detail="Filtered by the current search and segment controls." />
        <AdminStatCard label="Onboarding complete" value={String(completedOnboarding)} detail="Users with a usable resume profile and setup flow completed." />
        <AdminStatCard label="Power users" value={String(powerUsers)} detail="Highly active users derived from real recency and usage signals." />
        <AdminStatCard label="Missing DB profile" value={String(noDbProfiles)} detail="Clerk accounts that exist before creating product-side records in the database." />
      </section>

      <AdminPanel
        flush
        title="User roster"
        description="The table is powered by Clerk for signups and Prisma for product activity. Click any row to open the right-side activity panel."
        action={
          <div className="admin-panel-toolbar">
            <div className="relative admin-panel-search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email, or onboarding"
                className="w-full pl-9"
              />
            </div>
            <Select value={segment} onValueChange={(value) => setSegment(value ?? 'all')}>
              <SelectTrigger className="w-full sm:w-40 xl:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All segments</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Power">Power</SelectItem>
                <SelectItem value="At Risk">At Risk</SelectItem>
                <SelectItem value="Dormant">Dormant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="admin-table-wrap">
          <Table className="admin-user-table">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead className="hidden lg:table-cell">Generated assets</TableHead>
                <TableHead>Default resume</TableHead>
                <TableHead>Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="cursor-pointer" onClick={() => void handleRowClick(user.id)}>
                  <TableCell className="max-w-[14rem] align-top whitespace-normal">
                    <div className="space-y-2">
                      <AdminIdentity
                        name={user.name}
                        secondary={user.email}
                        badge={
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{user.accessRole}</Badge>
                            <Badge variant="outline">{user.segment}</Badge>
                            {!user.dbProfileExists ? <Badge variant="secondary">Clerk only</Badge> : null}
                          </div>
                        }
                      />
                      <div className="admin-table-cell-meta">
                        <span>{user.onboardingStatus}</span>
                        <span>Health {user.healthScore}</span>
                        <span>{user.activeDays7d} active days / 7d</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell align-top">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{user.joinedLabel}</p>
                      <p className="text-sm text-muted-foreground">{user.dbProfileExists ? 'Database linked' : 'Waiting for product profile'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[11rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{user.applications} jobs applied</p>
                      <div className="admin-table-cell-meta">
                        <span>{user.interviews} interview posts</span>
                        <span>{user.searches7d} searches / 7d</span>
                        <span>{user.interactions7d} interactions / 7d</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[11rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{user.resumes} resume uploads</p>
                      <div className="admin-table-cell-meta">
                        <span>{user.tailoredResumes} tailored resumes</span>
                        <span>{user.coverLetters} cover letters</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top w-[1%]" onClick={(event) => event.stopPropagation()}>
                    {user.defaultResume ? (
                      <div className="space-y-2">
                        <a
                          href={user.defaultResume.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-preview-link"
                        >
                          <ExternalLink className="size-3.5" />
                          Preview resume
                        </a>
                        <p className="truncate text-xs text-muted-foreground">{user.defaultResume.filename}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No default resume</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[11rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{user.lastActiveLabel}</p>
                      <div className="admin-table-cell-meta">
                        <span>{user.activeDays7d} active days / 7d</span>
                        <span>{user.searches7d + user.interactions7d} tracked events / 7d</span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!filteredUsers.length ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="admin-empty-state">
                      {isLoading ? 'Loading users...' : pageMessage ?? 'No users matched the current filters.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </AdminPanel>

      <section className="admin-surface-grid">
        <AdminPanel title="Activation watch" description="Supporting signals moved below so the user's table keeps the page's main emphasis.">
          <div className="space-y-3">
            {[
              {
                label: 'Missing resume',
                count: missingResumes,
                detail: 'Users who have signed up but still have no resume stored in the database.',
              },
              {
                label: 'Clerk only accounts',
                count: noDbProfiles,
                detail: 'Users visible from Clerk whose product-side profile has not been created yet.',
              },
              {
                label: 'At risk or dormant',
                count: users.filter((user) => user.segment === 'At Risk' || user.segment === 'Dormant').length,
                detail: 'Accounts with declining recency or weak product engagement signals.',
              },
            ].map((item) => (
              <div key={item.label} className="admin-highlight-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="admin-score-chip is-mid">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Data coverage" description="What the roster is pulling from live sources right now.">
          <div className="space-y-3">
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Signups and identity</p>
              <p className="text-sm text-muted-foreground">Pulled from Clerk so new signups appear even before a local DB profile exists.</p>
            </div>
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Applications, resumes, and activity</p>
              <p className="text-sm text-muted-foreground">Pulled from Prisma using the live product tables that already power the app.</p>
            </div>
            <div className="admin-note-card">
              <p>User detail drawer</p>
              <p>Open any row to inspect recent searches, job interactions, resume uploads, cover letters, tailored resumes, and interview posts.</p>
            </div>
          </div>
        </AdminPanel>
      </section>

      <UserDrawer
        user={selectedUser}
        adminId={adminId}
        open={drawerOpen}
        loading={drawerLoading}
        selectedUserId={selectedUserId}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
