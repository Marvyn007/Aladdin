'use client';

import { useState } from 'react';
import { Filter, Search, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

import { adminUsers } from '@/components/admin/admin-data';
import {
    AdminIdentity,
    AdminPageIntro,
    AdminPanel,
    AdminStatCard,
} from '@/components/admin/admin-ui';
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

export default function UsersPage() {
    const [query, setQuery] = useState('');
    const [segment, setSegment] = useState('all');

    const filteredUsers = adminUsers.filter((user) => {
        const matchesQuery =
            !query ||
            user.name.toLowerCase().includes(query.toLowerCase()) ||
            user.email.toLowerCase().includes(query.toLowerCase()) ||
            user.focus.toLowerCase().includes(query.toLowerCase());

        const matchesSegment = segment === 'all' || user.segment === segment;
        return matchesQuery && matchesSegment;
    });

    const completedOnboarding = adminUsers.filter((user) => user.onboarding === 'Complete').length;
    const atRiskUsers = adminUsers.filter((user) => user.segment === 'At Risk' || user.segment === 'Dormant').length;
    const fullConsent = adminUsers.filter((user) => user.consent === 'Full').length;

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <AdminPageIntro
                    eyebrow="User management"
                    title="Users"
                    description="View and manage user accounts, activation state, plan tier, resume uploads, and engagement health."
                    actions={
                        <>
                            <Button variant="outline" className="rounded-full">
                                <Filter className="size-4" />
                                Build cohort
                            </Button>
                            <Button className="rounded-full">
                                <Sparkles className="size-4" />
                                Export insight digest
                            </Button>
                        </>
                    }
                />
            </div>

            <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                <AdminStatCard label="Users in view" value={String(filteredUsers.length)} detail="Filtered by the current search and segment controls." trend="Live" />
                <AdminStatCard label="Onboarding complete" value={String(completedOnboarding)} detail="Users with resume + preference setup finished." trend={`${Math.round((completedOnboarding / adminUsers.length) * 100)}%`} />
                <AdminStatCard label="At risk" value={String(atRiskUsers)} detail="Dormant or declining engagement cohorts that need attention." trend="Recovery" />
                <AdminStatCard label="Full consent" value={String(fullConsent)} detail="Accounts sharing the deepest behavioral and personalization signals." trend="Healthy" />
            </div>

            <div className="px-4 lg:px-6">
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <AdminPanel
                    title="User roster"
                    description="Filter by segment or search by name, email, or job focus to find and act on specific accounts."
                    action={
                        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:justify-end">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search by name, email, or focus"
                                    className="w-full rounded-full pl-9 sm:w-64"
                                />
                            </div>
                            <Select value={segment} onValueChange={(value) => setSegment(value ?? 'all')}>
                                <SelectTrigger className="w-full rounded-full sm:w-36">
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Segment</TableHead>
                                    <TableHead>Activation</TableHead>
                                    <TableHead>Resumes</TableHead>
                                    <TableHead>Apps</TableHead>
                                    <TableHead>Consent</TableHead>
                                    <TableHead>Health</TableHead>
                                    <TableHead>Last active</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="min-w-[250px]">
                                            <AdminIdentity
                                                name={user.name}
                                                secondary={user.email}
                                                badge={<Badge variant="outline" className="rounded-full px-2.5 py-0.5">{user.focus}</Badge>}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.plan === 'Premium' ? 'default' : user.plan === 'Pro' ? 'secondary' : 'outline'} className="rounded-full px-2.5 py-0.5">
                                                {user.plan}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{user.segment}</TableCell>
                                        <TableCell>{user.onboarding}</TableCell>
                                        <TableCell className="tabular-nums">{user.resumes}</TableCell>
                                        <TableCell className="tabular-nums">{user.applications}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.consent === 'Full' ? 'secondary' : 'outline'} className="rounded-full px-2.5 py-0.5">
                                                {user.consent}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                                                user.healthScore >= 80
                                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                                    : user.healthScore >= 50
                                                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                                    : "bg-red-50 text-red-700 ring-1 ring-red-200"
                                            )}>
                                                {user.healthScore}
                                            </span>
                                        </TableCell>
                                        <TableCell>{user.lastActive}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </AdminPanel>

                <AdminPanel title="Operator signals" description="Patterns and watch items across the current user cohort.">
                    <div className="space-y-3">
                        {[
                            {
                                label: 'Missing resume',
                                count: adminUsers.filter((u) => u.onboarding === 'Missing Resume').length,
                                detail: "Users who haven't uploaded a resume yet.",
                                action: 'Prompt upload',
                            },
                            {
                                label: 'Needs preferences',
                                count: adminUsers.filter((u) => u.onboarding === 'Needs Preferences').length,
                                detail: 'Users missing job preference setup.',
                                action: 'Send nudge',
                            },
                            {
                                label: 'At risk / Dormant',
                                count: adminUsers.filter((u) => u.segment === 'At Risk' || u.segment === 'Dormant').length,
                                detail: 'Users with declining or no engagement.',
                                action: 'Review cohort',
                            },
                            {
                                label: 'Limited consent',
                                count: adminUsers.filter((u) => u.consent === 'Limited').length,
                                detail: 'Users with restricted personalization signals.',
                                action: 'Soft prompt',
                            },
                        ].map((item) => (
                            <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-foreground">{item.label}</span>
                                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-bold text-primary">{item.count}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                                </div>
                                <span className="text-xs font-medium text-primary whitespace-nowrap">{item.action}</span>
                            </div>
                        ))}
                    </div>
                </AdminPanel>
            </div>
            </div>
        </div>
    );
}
