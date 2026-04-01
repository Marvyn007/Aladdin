'use client';

import { useState } from 'react';
import { Flag, ShieldAlert, Sparkles } from 'lucide-react';

import { adminInterviews } from '@/components/admin/admin-data';
import {
    AdminPageIntro,
    AdminPanel,
    AdminStatCard,
} from '@/components/admin/admin-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export default function InterviewsPage() {
    const [interviews, setInterviews] = useState(adminInterviews);
    const reviewQueueCount = interviews.length;

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <AdminPageIntro
                    eyebrow="Interview reviews"
                    title="Interview experiences"
                    description="Review, escalate, and approve community-submitted interview reports. Flag harmful content and surface high-quality signals."
                    actions={
                        <>
                            <Button variant="outline" className="rounded-full">
                                <Flag className="size-4" />
                                Review flagged only
                            </Button>
                            <Button className="rounded-full">
                                <Sparkles className="size-4" />
                                Draft moderation summary
                            </Button>
                        </>
                    }
                />
            </div>

            <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                <AdminStatCard label="Experiences in queue" value={String(reviewQueueCount)} detail="All interview reports currently visible to admins." trend="Live" />
                <AdminStatCard label="Escalated" value={String(interviews.filter((item) => item.reviewState === 'Escalated').length)} detail="Reports that need a stronger moderation response." trend="Priority" />
                <AdminStatCard label="Needs review" value={String(interviews.filter((item) => item.reviewState === 'Needs Review').length)} detail="Items with reports or ambiguous policy coverage." trend="Active" />
                <AdminStatCard label="Approved" value={String(interviews.filter((item) => item.reviewState === 'Approved').length)} detail="Reports cleared for community visibility." trend="Stable" />
            </div>

            <div className="px-4 lg:px-6">
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <AdminPanel
                    title="Review queue"
                    description="All community interview submissions sorted by report volume and escalation state."
                >
                    <div className="admin-table-wrap">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Experience</TableHead>
                                    <TableHead>Votes</TableHead>
                                    <TableHead>Reports</TableHead>
                                    <TableHead>State</TableHead>
                                    <TableHead>Reviewer</TableHead>
                                    <TableHead>Submitted</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {interviews.map((interview) => (
                                    <TableRow key={interview.id}>
                                        <TableCell className="min-w-[260px]">
                                            <div className="space-y-1">
                                                <p className="font-medium text-foreground">{interview.title}</p>
                                                <p className="text-sm text-muted-foreground">{interview.company}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>{interview.usefulVotes}</TableCell>
                                        <TableCell>{interview.reportCount}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    interview.reviewState === 'Approved'
                                                        ? 'secondary'
                                                        : interview.reviewState === 'Needs Review'
                                                            ? 'outline'
                                                            : 'destructive'
                                                }
                                                className="rounded-full px-2.5 py-0.5"
                                            >
                                                {interview.reviewState}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{interview.reviewer}</TableCell>
                                        <TableCell>{interview.submittedAt}</TableCell>
                                        <TableCell>
                                            <Button
                                                variant="outline"
                                                className="rounded-full"
                                                onClick={() =>
                                                    setInterviews((current) =>
                                                        current.map((item) =>
                                                            item.id === interview.id
                                                                ? {
                                                                    ...item,
                                                                    reviewState:
                                                                        item.reviewState === 'Approved'
                                                                            ? 'Needs Review'
                                                                            : item.reviewState === 'Needs Review'
                                                                                ? 'Escalated'
                                                                                : 'Approved',
                                                                }
                                                                : item
                                                        )
                                                    )
                                                }
                                            >
                                                Cycle state
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </AdminPanel>

                <AdminPanel
                    title="Moderator context"
                    description="Summaries and signals to help reviewers make faster, better-informed decisions."
                >
                    <div className="space-y-3">
                        {interviews.slice(0, 3).map((interview) => (
                            <div key={interview.id} className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="size-4 text-primary" />
                                    <p className="font-medium text-foreground">{interview.title}</p>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{interview.summary}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
                                        {interview.company}
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                                        {interview.usefulVotes} useful votes
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </AdminPanel>
            </div>
            </div>
        </div>
    );
}
