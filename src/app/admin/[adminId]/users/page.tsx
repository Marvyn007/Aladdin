'use client';

import { useState } from 'react';
import { Filter, Search, ShieldCheck, Sparkles } from 'lucide-react';

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
                                    <TableHead>Output</TableHead>
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
                                        <TableCell>{user.resumes} resumes | {user.applications} apps</TableCell>
                                        <TableCell>
                                            <Badge variant={user.consent === 'Full' ? 'secondary' : 'outline'} className="rounded-full px-2.5 py-0.5">
                                                {user.consent}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium text-foreground">{user.healthScore}</TableCell>
                                        <TableCell>{user.lastActive}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </AdminPanel>

                <AdminPanel title="Operator signals" description="Patterns and watch items across the current user cohort.">
                    <div className="space-y-3">
                        <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="size-4 text-primary" />
                                <p className="font-medium text-foreground">Consent-aware segmentation</p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Full-consent users can support deeper analytics, while limited-consent users should see softer collection prompts.
                            </p>
                        </div>
                        <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                            <p className="font-medium text-foreground">Activation watchlist</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Focus on &quot;Missing Resume&quot; and &quot;Needs Preferences&quot; states first. Those are the fastest admin interventions with the highest output lift.
                            </p>
                        </div>
                        <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                            <p className="font-medium text-foreground">Power user behavior</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Premium and Pro users are clustered around platform and full-stack searches, which suggests stronger appetite for advanced sourcing controls.
                            </p>
                        </div>
                    </div>
                </AdminPanel>
            </div>
            </div>
        </div>
    );
}
