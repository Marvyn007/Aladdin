'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, LoaderCircle, Pencil, Trash2 } from 'lucide-react';

import { AdminPageIntro, AdminPanel, AdminStatCard } from '@/components/admin/admin-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { AdminJobSummary } from '@/lib/admin/types';

function formatLongDate(date: string | null) {
  if (!date) return 'Date unavailable';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export default function JobsPage() {
  const [status, setStatus] = useState('all');
  const [jobs, setJobs] = useState<AdminJobSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<AdminJobSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: '',
    company: '',
    location: '',
    status: '',
    source: '',
    sourceUrl: '',
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      setIsLoading(true);
      setActionMessage(null);

      try {
        const response = await fetch('/api/admin/jobs', { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load jobs');
        }

        setJobs(payload.jobs ?? []);
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : 'Unable to load jobs');
        setJobs([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadJobs();
  }, []);

  async function deleteJob(jobId: string) {
    setDeletingId(jobId);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/jobs/${jobId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to delete job');
      }

      setJobs((current) => current.filter((job) => job.id !== jobId));
      setActionMessage(payload.message ?? 'Job deleted successfully.');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to delete job');
    } finally {
      setDeletingId(null);
    }
  }

  function openEditDialog(job: AdminJobSummary) {
    setEditingJob(job);
    setJobForm({
      title: job.title,
      company: job.company,
      location: job.location,
      status: job.status,
      source: job.source,
      sourceUrl: job.sourceUrl,
    });
  }

  async function saveJob() {
    if (!editingJob) return;

    setIsSaving(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/jobs/${editingJob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobForm),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to update job');
      }

      if (payload.job) {
        setJobs((current) =>
          current.map((job) => (job.id === payload.job.id ? payload.job : job))
        );
      }

      setActionMessage(payload.message ?? 'Job updated successfully.');
      setEditingJob(null);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to update job');
    } finally {
      setIsSaving(false);
    }
  }

  const filteredJobs = jobs.filter((job) => status === 'all' || job.status === status);
  const totalApplications = filteredJobs.reduce((sum, job) => sum + job.applications, 0);
  const totalResumesGenerated = filteredJobs.reduce((sum, job) => sum + job.resumeGenerations, 0);
  const totalCoverLetters = filteredJobs.reduce((sum, job) => sum + job.coverLetters, 0);
  const totalSaves = filteredJobs.reduce((sum, job) => sum + job.saves, 0);
  const availableStatuses = Array.from(new Set(jobs.map((job) => job.status))).sort();

  return (
    <div className="admin-view">
      <AdminPageIntro
        eyebrow="Job management"
        title="Jobs"
        description="Live job rows from the database, enriched with application counts, tailored resume generations, cover letters, saves, posting source, and admin-only deletion."
      />

      <section className="admin-card-grid">
        <AdminStatCard label="Jobs in view" value={String(filteredJobs.length)} detail="Current job rows visible after the selected status filter." />
        <AdminStatCard label="Applications" value={String(totalApplications)} detail="Total applications linked to the jobs currently visible in the table." />
        <AdminStatCard label="Tailored resumes" value={String(totalResumesGenerated)} detail="Resume generations tied directly to these jobs." />
        <AdminStatCard label="Saved jobs" value={String(totalSaves)} detail="Current saved-state rows tied to these jobs in the database." />
      </section>

      <AdminPanel
        flush
        title="Job listings"
        description="Wide operator table with posting source, job provenance, user funnel counts, and destructive controls."
        action={
          <div className="admin-panel-toolbar">
            <Select value={status} onValueChange={(value) => setStatus(value ?? 'all')}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {availableStatuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="admin-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead className="hidden md:table-cell">Posted</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Funnel</TableHead>
                <TableHead className="hidden xl:table-cell">Posted by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead>Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="max-w-[13rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.company} - {job.location}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell align-top">
                    <p className="font-medium text-foreground">{formatLongDate(job.postedAt)}</p>
                  </TableCell>
                  <TableCell className="max-w-[12rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <Badge variant="outline">{job.source}</Badge>
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-preview-link"
                      >
                        <ExternalLink className="size-3.5" />
                        Open source
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[11rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{job.applications} users applied</p>
                      <div className="admin-table-cell-meta">
                        <span>{job.resumeGenerations} tailored resumes</span>
                        <span>{job.coverLetters} cover letters</span>
                        <span>{job.saves} saves</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell align-top">
                    <p className="text-sm text-foreground">{job.postedByName ?? 'Imported system job'}</p>
                  </TableCell>
                  <TableCell className="align-top w-[1%]">
                    <Badge variant="outline">{job.status}</Badge>
                  </TableCell>
                  <TableCell className="w-[1%]">
                    <Button variant="outline" onClick={() => openEditDialog(job)}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </TableCell>
                  <TableCell className="w-[1%]">
                    <Button
                      variant="destructive"
                      onClick={() => void deleteJob(job.id)}
                      disabled={deletingId === job.id}
                    >
                      {deletingId === job.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!filteredJobs.length ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="admin-empty-state">
                      {isLoading ? 'Loading jobs...' : actionMessage ?? 'No jobs matched the current filters.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </AdminPanel>

      <section className="admin-surface-grid">
        <AdminPanel title="Operator context" description="Supporting context moved below so the jobs table stays dominant.">
          <div className="space-y-3">
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Delete jobs from the database</p>
              <p className="text-sm text-muted-foreground">The delete column now uses an admin-only database route instead of the user-scoped job removal endpoint.</p>
            </div>
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Resume and cover-letter counts</p>
              <p className="text-sm text-muted-foreground">These counts come from `tailored_resumes` and `cover_letters`, so they reflect actual generated assets tied to each job.</p>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel title="Latest action" description="Current action feedback and aggregate context.">
          <div className="space-y-3">
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Latest action</p>
              <p className="text-sm text-muted-foreground">{actionMessage ?? 'No destructive action has been run yet.'}</p>
            </div>
            <div className="admin-note-card">
              <p>Cover letters in view</p>
              <p>{totalCoverLetters} cover letters are currently linked to the jobs visible in the table.</p>
            </div>
          </div>
        </AdminPanel>
      </section>

      <Dialog open={Boolean(editingJob)} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit job</DialogTitle>
            <DialogDescription>
              Update the database-backed job record without changing the ingestion pipeline behind it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={jobForm.title}
              onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Job title"
            />
            <Input
              value={jobForm.company}
              onChange={(event) => setJobForm((current) => ({ ...current, company: event.target.value }))}
              placeholder="Company"
            />
            <Input
              value={jobForm.location}
              onChange={(event) => setJobForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="Location"
            />
            <Input
              value={jobForm.status}
              onChange={(event) => setJobForm((current) => ({ ...current, status: event.target.value }))}
              placeholder="Status"
            />
            <Input
              value={jobForm.source}
              onChange={(event) => setJobForm((current) => ({ ...current, source: event.target.value }))}
              placeholder="Source"
            />
            <Input
              value={jobForm.sourceUrl}
              onChange={(event) => setJobForm((current) => ({ ...current, sourceUrl: event.target.value }))}
              placeholder="Source URL"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingJob(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void saveJob()} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
