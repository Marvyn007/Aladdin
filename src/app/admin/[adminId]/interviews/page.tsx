'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Pencil, Trash2 } from 'lucide-react';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { AdminInterviewSummary } from '@/lib/admin/types';

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<AdminInterviewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingInterview, setEditingInterview] = useState<AdminInterviewSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    role: '',
    companyName: '',
    location: '',
    status: '',
    moderationNotes: '',
    isFlagged: false,
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadInterviews() {
      setIsLoading(true);
      setActionMessage(null);

      try {
        const response = await fetch('/api/admin/interviews', { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load interview experiences');
        }

        setInterviews(payload.interviews ?? []);
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : 'Unable to load interview experiences');
        setInterviews([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadInterviews();
  }, []);

  async function deleteInterview(interviewId: string) {
    setDeletingId(interviewId);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/interviews/${interviewId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to delete interview experience');
      }

      setInterviews((current) => current.filter((item) => item.id !== interviewId));
      setActionMessage(payload.message ?? 'Interview experience deleted successfully.');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to delete interview experience');
    } finally {
      setDeletingId(null);
    }
  }

  function openEditDialog(interview: AdminInterviewSummary) {
    setEditingInterview(interview);
    setInterviewForm({
      role: interview.title,
      companyName: interview.company,
      location: interview.location,
      status: interview.status,
      moderationNotes: interview.moderationNotes ?? '',
      isFlagged: interview.isFlagged,
    });
  }

  async function saveInterview() {
    if (!editingInterview) return;

    setIsSaving(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/interviews/${editingInterview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interviewForm),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to update interview experience');
      }

      if (payload.interview) {
        setInterviews((current) =>
          current.map((item) => (item.id === payload.interview.id ? payload.interview : item))
        );
      }

      setActionMessage(payload.message ?? 'Interview experience updated successfully.');
      setEditingInterview(null);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to update interview experience');
    } finally {
      setIsSaving(false);
    }
  }

  const flaggedCount = interviews.filter((item) => item.isFlagged).length;
  const publishedCount = interviews.filter((item) => item.status === 'Published').length;
  const missingHelpfulCounts = interviews.filter((item) => !item.helpfulTracked).length;

  return (
    <div className="admin-view">
      <AdminPageIntro
        eyebrow="Interview reviews"
        title="Interview experiences"
        description="Live moderation table powered by the interview experience records already stored in the database."
      />

      <section className="admin-card-grid">
        <AdminStatCard label="Experiences in view" value={String(interviews.length)} detail="All interview experience rows currently visible to admins." />
        <AdminStatCard label="Flagged" value={String(flaggedCount)} detail="Entries already carrying moderation flags in the database." />
        <AdminStatCard label="Published" value={String(publishedCount)} detail="Rows whose current moderation status is published." />
        <AdminStatCard label="Helpful votes missing" value={String(missingHelpfulCounts)} detail="The current schema does not store helpful yes/no vote totals for these records." />
      </section>

      <AdminPanel
        flush
        title="Interview experiences"
        description="Wide moderation table with poster identity, posted date, moderation signals, and admin-only delete controls."
      >
        <div className="admin-table-wrap">
          <Table className="admin-wide-table">
            <TableHeader>
              <TableRow>
                <TableHead>Experience</TableHead>
                <TableHead>Posted by</TableHead>
                <TableHead className="hidden md:table-cell">Posted</TableHead>
                <TableHead>Helpful votes</TableHead>
                <TableHead>Moderation</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead>Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell className="min-w-[16rem] max-w-[22rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{interview.title}</p>
                      <p className="text-sm text-muted-foreground">{interview.company} - {interview.location}</p>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[11rem] max-w-[14rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{interview.postedByName}</p>
                      <p className="text-sm text-muted-foreground md:hidden">{interview.postedLabel}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell align-top">{interview.postedLabel}</TableCell>
                  <TableCell className="min-w-[10rem] align-top whitespace-normal">
                    {interview.helpfulTracked ? (
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{interview.helpfulYes} yes</p>
                        <p className="text-sm text-muted-foreground">{interview.helpfulNo} no</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Not tracked</p>
                        <p className="text-sm text-muted-foreground">No helpful-vote table exists today.</p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[15rem] max-w-[22rem] align-top whitespace-normal">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{interview.status}</Badge>
                        {interview.isFlagged ? <Badge variant="destructive">Flagged</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{interview.lastEditedByName ? `Last edited by ${interview.lastEditedByName}` : 'No editor recorded'}</p>
                      {interview.moderationNotes ? (
                        <p className="text-xs text-muted-foreground">{interview.moderationNotes}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="w-[1%]">
                    <Button variant="outline" onClick={() => openEditDialog(interview)}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </TableCell>
                  <TableCell className="w-[1%]">
                    <Button variant="destructive" onClick={() => void deleteInterview(interview.id)} disabled={deletingId === interview.id}>
                      {deletingId === interview.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!interviews.length ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="admin-empty-state">
                      {isLoading ? 'Loading interview experiences...' : actionMessage ?? 'No interview experiences were found.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </AdminPanel>

      <section className="admin-surface-grid">
        <AdminPanel title="Data notes" description="Supporting context moved below so the moderation table stays dominant.">
          <div className="space-y-3">
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Helpful vote counts</p>
              <p className="text-sm text-muted-foreground">The current schema does not store yes/no helpful vote totals, so the table explicitly shows that gap instead of fake numbers.</p>
            </div>
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Delete control</p>
              <p className="text-sm text-muted-foreground">The delete button now uses an admin-only route, so moderation no longer depends on user ownership rules from the public endpoint.</p>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel title="Latest action" description="Current moderation feedback and schema reality.">
          <div className="space-y-3">
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Latest action</p>
              <p className="text-sm text-muted-foreground">{actionMessage ?? 'No destructive action has been run yet.'}</p>
            </div>
            <div className="admin-note-card">
              <p>Posted by</p>
              <p>Poster names are resolved through the live Clerk + database user map, so they stay aligned with the rest of admin.</p>
            </div>
          </div>
        </AdminPanel>
      </section>

      <Dialog open={Boolean(editingInterview)} onOpenChange={(open) => !open && setEditingInterview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit interview experience</DialogTitle>
            <DialogDescription>
              Update moderation fields and the core interview metadata stored in the database.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={interviewForm.role}
              onChange={(event) => setInterviewForm((current) => ({ ...current, role: event.target.value }))}
              placeholder="Role"
            />
            <Input
              value={interviewForm.companyName}
              onChange={(event) => setInterviewForm((current) => ({ ...current, companyName: event.target.value }))}
              placeholder="Company"
            />
            <Input
              value={interviewForm.location}
              onChange={(event) => setInterviewForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="Location"
            />
            <Input
              value={interviewForm.status}
              onChange={(event) => setInterviewForm((current) => ({ ...current, status: event.target.value }))}
              placeholder="Status"
            />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={interviewForm.isFlagged}
                onChange={(event) => setInterviewForm((current) => ({ ...current, isFlagged: event.target.checked }))}
              />
              Mark as flagged
            </label>
            <Textarea
              value={interviewForm.moderationNotes}
              onChange={(event) => setInterviewForm((current) => ({ ...current, moderationNotes: event.target.value }))}
              placeholder="Moderation notes"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInterview(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void saveInterview()} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
