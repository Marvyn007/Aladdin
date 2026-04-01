'use client';

import { useState } from 'react';
import { Filter, Sparkles, Trash2 } from 'lucide-react';

import { adminJobs } from '@/components/admin/admin-data';
import {
    AdminPageIntro,
    AdminPanel,
    AdminStatCard,
} from '@/components/admin/admin-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export default function JobsPage() {
    const [status, setStatus] = useState('all');
    const [jobs, setJobs] = useState(adminJobs);

    const filteredJobs = jobs.filter((job) => status === 'all' || job.status === status);

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <AdminPageIntro
                    eyebrow="Job management"
                    title="Jobs"
                    description="Triage, promote, and clean up job listings by source quality, conversion performance, and freshness."
                    actions={
                        <>
                            <Button variant="outline" className="rounded-full">
                                <Filter className="size-4" />
                                Quality filters
                            </Button>
                            <Button className="rounded-full">
                                <Sparkles className="size-4" />
                                Create source report
                            </Button>
                        </>
                    }
                />
            </div>

            <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                <AdminStatCard label="Jobs in view" value={String(filteredJobs.length)} detail="Listings currently surfaced in the operator table." trend="Filtered" />
                <AdminStatCard label="Healthy listings" value={String(jobs.filter((job) => job.status === 'Healthy').length)} detail="High-confidence listings with strong conversion behavior." trend="Green" />
                <AdminStatCard label="Review queue" value={String(jobs.filter((job) => job.status === 'Review').length)} detail="Listings with signal drift or questionable relevance." trend="Needs triage" />
                <AdminStatCard label="Stale jobs" value={String(jobs.filter((job) => job.status === 'Stale').length)} detail="Listings whose freshness or engagement has dropped." trend="Clean up" />
            </div>

            <div className="px-4 lg:px-6">
            <AdminPanel
                title="Job listings"
                description="All ingested listings with quality score, conversion data, and triage status."
                action={
                    <Select value={status} onValueChange={(value) => setStatus(value ?? 'all')}>
                        <SelectTrigger className="w-44 rounded-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="Healthy">Healthy</SelectItem>
                            <SelectItem value="Review">Review</SelectItem>
                            <SelectItem value="Stale">Stale</SelectItem>
                        </SelectContent>
                    </Select>
                }
            >
                <div className="admin-table-wrap">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Job</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Quality</TableHead>
                                <TableHead>Conversion</TableHead>
                                <TableHead>Saves</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredJobs.map((job) => (
                                <TableRow key={job.id}>
                                    <TableCell className="min-w-[220px]">
                                        <div className="space-y-1">
                                            <p className="font-medium text-foreground">{job.title}</p>
                                            <p className="text-sm text-muted-foreground">{job.company} | {job.location}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>{job.source}</TableCell>
                                    <TableCell className="font-medium text-foreground">{job.qualityScore}</TableCell>
                                    <TableCell>{job.applications} apps | {job.resumeRuns} resumes | {job.coverLetters} CLs</TableCell>
                                    <TableCell>{job.saves}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={job.status === 'Healthy' ? 'secondary' : job.status === 'Review' ? 'outline' : 'destructive'}
                                            className="rounded-full px-2.5 py-0.5"
                                        >
                                            {job.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{job.owner}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger render={<Button variant="outline" className="rounded-full" />}>
                                                Manage
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>Promote listing</DropdownMenuItem>
                                                <DropdownMenuItem>Send to review</DropdownMenuItem>
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onClick={() => setJobs((current) => current.filter((item) => item.id !== job.id))}
                                                >
                                                    <Trash2 className="size-4" />
                                                    Remove from view
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </AdminPanel>
            </div>
        </div>
    );
}
