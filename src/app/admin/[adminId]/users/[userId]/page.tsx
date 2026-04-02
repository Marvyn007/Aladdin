'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

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
import type { AdminUserDetail } from '@/lib/admin/types';

export default function UserProfilePage() {
  const params = useParams<{ adminId: string; userId: string }>();
  const { adminId, userId } = params;
  const router = useRouter();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    name: '',
    role: 'user',
  });

  useEffect(() => {
    async function loadUser() {
      setIsLoading(true);
      setPageMessage(null);

      try {
        const response = await fetch(`/api/admin/users/${userId}`, { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load user detail');
        }

        setUser(payload.user ?? null);
      } catch (error) {
        setPageMessage(error instanceof Error ? error.message : 'Unable to load user detail');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadUser();
  }, [userId]);

  useEffect(() => {
    if (!user) return;

    setForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      name: user.name,
      role: user.accessRole.toLowerCase(),
    });
  }, [user]);

  async function saveUser() {
    setIsSaving(true);
    setPageMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to update user');
      }

      if (payload.user) {
        setUser(payload.user);
      }

      setPageMessage(payload.message ?? 'User updated successfully.');
      setEditingOpen(false);
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : 'Unable to update user');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteUser() {
    if (!window.confirm('Delete this user from Clerk and the database? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setPageMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to delete user');
      }

      router.push(`/admin/${adminId}/users`);
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : 'Unable to delete user');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="admin-view">
      <Link href={`/admin/${adminId}/users`} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to users
      </Link>

      {isLoading ? (
        <div className="flex min-h-[16rem] items-center justify-center text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : !user ? (
        <div className="admin-highlight-card">
          <p className="font-semibold text-foreground">User not found</p>
          <p className="text-sm text-muted-foreground">{pageMessage ?? 'The selected user could not be loaded.'}</p>
        </div>
      ) : (
        <>
          {pageMessage ? (
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Latest action</p>
              <p className="text-sm text-muted-foreground">{pageMessage}</p>
            </div>
          ) : null}

          <AdminPageIntro
            eyebrow="User profile"
            title={user.name}
            description={user.email}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{user.accessRole}</Badge>
                <Badge variant="outline">{user.segment}</Badge>
                <Badge variant="outline">{user.onboardingStatus}</Badge>
                {!user.dbProfileExists ? <Badge variant="secondary">Clerk only</Badge> : null}
                <span className="admin-score-chip is-good">Health {user.healthScore}</span>
                <Button variant="outline" onClick={() => setEditingOpen(true)}>
                  <Pencil className="size-4" />
                  Edit user
                </Button>
                <Button variant="destructive" onClick={() => void deleteUser()} disabled={isDeleting}>
                  {isDeleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Delete user
                </Button>
              </div>
            }
          />

          <section className="admin-card-grid">
            <AdminStatCard
              label="Current streak"
              value={`${user.currentStreak}d`}
              detail="Consecutive tracked activity days from the live product event stream."
            />
            <AdminStatCard
              label="Best streak"
              value={`${user.longestStreak}d`}
              detail="Longest continuous activity run found across the recent heat map window."
            />
            <AdminStatCard
              label="Active days / 90d"
              value={String(user.activeDays90d)}
              detail="Distinct days with searches, applications, interactions, uploads, or generated assets."
            />
            <AdminStatCard
              label="Stored documents"
              value={String(user.documentsCount)}
              detail="All resumes and LinkedIn profile files currently attached to this account."
            />
          </section>

          <section className="admin-hero-grid">
            <div className="admin-side-stack">
              <AdminPanel title="Profile command view" description="Identity, onboarding state, and source-of-truth account fields pulled from Clerk and Prisma.">
                <div className="admin-profile-kv-grid">
                  {[
                    ['User ID', user.id],
                    ['Name', user.name],
                    ['Email', user.email],
                    ['Database profile', user.dbProfileExists ? 'Linked' : 'Clerk only'],
                    ['Joined', user.joinedLabel],
                    ['Last active', user.lastActiveLabel],
                    ['Last sign in', user.lastSignInLabel],
                    ['Onboarding status', user.onboardingStatus],
                    ['Onboarding step', user.onboardingCurrentStep ? `Step ${user.onboardingCurrentStep}` : 'Not started'],
                    ['Onboarding started', user.onboardingStartedAt ? new Date(user.onboardingStartedAt).toLocaleDateString() : 'Not available'],
                    ['Onboarding completed', user.onboardingCompletedAt ? new Date(user.onboardingCompletedAt).toLocaleDateString() : 'Not completed'],
                    ['Fresh jobs limit', user.freshJobLimit ? String(user.freshJobLimit) : 'Not set'],
                    ['Onboarding answers', String(user.onboardingAnswersCount)],
                    ['Active days / 7d', String(user.activeDays7d)],
                    ['Active days / 30d', String(user.activeDays30d)],
                    ['Active days / 90d', String(user.activeDays90d)],
                  ].map(([label, value]) => (
                    <div key={label} className="admin-profile-kv-row">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </AdminPanel>

              <AdminPanel title="Activity heat map" description="A compact contribution-style view of every tracked day across searches, applications, interactions, uploads, and generated documents.">
                <div className="admin-streak-grid">
                  <div className="admin-highlight-card">
                    <p className="admin-highlight-label">Current streak</p>
                    <p className="admin-highlight-value">{user.currentStreak} days</p>
                    <p className="admin-highlight-detail">The user has been active on {user.activeDays30d} distinct days in the last 30 days.</p>
                  </div>
                  <div className="admin-highlight-card">
                    <p className="admin-highlight-label">Best streak</p>
                    <p className="admin-highlight-value">{user.longestStreak} days</p>
                    <p className="admin-highlight-detail">Longest consecutive run found in the current 12-week activity window.</p>
                  </div>
                </div>

                <div className="admin-heatmap-shell">
                  <div className="admin-heatmap" aria-label="User activity heat map">
                    {user.activityHeatmap.map((cell) => (
                      <div
                        key={cell.date}
                        className={`admin-heatmap-cell is-${cell.intensity}`}
                        title={`${cell.date}: ${cell.count} tracked events`}
                      />
                    ))}
                  </div>

                  <div className="admin-heatmap-legend">
                    <span>Less</span>
                    {[0, 1, 2, 3, 4].map((level) => (
                      <span key={level} className={`admin-heatmap-cell is-${level}`} aria-hidden="true" />
                    ))}
                    <span>More</span>
                  </div>
                </div>
              </AdminPanel>
            </div>

            <div className="admin-side-stack">
              <AdminPanel title="Usage snapshot" description="The main production metrics pulled from live database tables.">
                <div className="admin-drawer-stats">
                  {[
                    { label: 'Applications', value: user.applications },
                    { label: 'Resume uploads', value: user.resumes },
                    { label: 'Tailored resumes', value: user.tailoredResumes },
                    { label: 'Cover letters', value: user.coverLetters },
                    { label: 'Interview posts', value: user.interviews },
                    { label: 'Searches / 30d', value: user.searches30d },
                    { label: 'Interactions / 30d', value: user.interactions30d },
                    { label: 'Documents', value: user.documentsCount },
                  ].map((stat) => (
                    <div key={stat.label} className="admin-drawer-stat">
                      <p>{stat.label}</p>
                      <p>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </AdminPanel>

              <AdminPanel title="Onboarding answers" description="Every stored onboarding answer currently attached to the user profile.">
                <div className="space-y-2">
                  {user.excludedKeywords.length ? (
                    <div className="admin-highlight-card">
                      <p className="admin-highlight-label">Excluded keywords</p>
                      <p className="text-sm text-muted-foreground">{user.excludedKeywords.join(', ')}</p>
                    </div>
                  ) : null}

                  {user.onboardingAnswers.length ? (
                    user.onboardingAnswers.map((answer) => (
                      <div key={answer.id} className="admin-answer-row">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{answer.questionLabel}</p>
                          <p className="text-sm text-muted-foreground">{answer.answer}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{answer.stepKey}</p>
                          <p>{answer.updatedAt ? new Date(answer.updatedAt).toLocaleDateString() : 'No date'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No onboarding answers are stored for this user.</p>
                  )}
                </div>
              </AdminPanel>
            </div>
          </section>

          <AdminPanel title="Document library" description="Preview every stored resume and LinkedIn profile without leaving the admin surface.">
            <div className="admin-document-library">
              <section className="admin-document-section">
                <div className="admin-document-summary">
                  <p className="admin-highlight-label">Default resume</p>
                  <p className="admin-document-title">{user.defaultResume?.filename ?? 'No default resume'}</p>
                  <p className="admin-highlight-detail">
                    {user.defaultResume ? 'The resume marked as default on the user account is available for preview here.' : 'No default resume is marked for this user yet.'}
                  </p>
                  {user.defaultResume ? (
                    <a
                      href={user.defaultResume.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-preview-link"
                    >
                      <ExternalLink className="size-3.5" />
                      Preview default
                    </a>
                  ) : null}
                </div>

                <div className="space-y-2.5">
                  <p className="admin-highlight-label">All resumes</p>
                  {user.resumesList.length ? (
                    user.resumesList.map((resume) => (
                      <div key={resume.id} className="admin-document-row">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-foreground">{resume.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {resume.createdAt ? new Date(resume.createdAt).toLocaleDateString() : 'Date unavailable'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {resume.isDefault ? <Badge variant="outline">Default</Badge> : null}
                          <a
                            href={resume.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-preview-link"
                          >
                            <ExternalLink className="size-3.5" />
                            Preview
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No resumes are stored for this user.</p>
                  )}
                </div>
              </section>

              <section className="admin-document-section">
                <div className="admin-document-summary">
                  <p className="admin-highlight-label">LinkedIn profiles</p>
                  <p className="admin-document-title">{user.linkedInProfiles.length} stored profiles</p>
                  <p className="admin-highlight-detail">Every LinkedIn PDF upload linked to this account is listed below with inline preview access.</p>
                </div>

                <div className="space-y-2.5">
                  <p className="admin-highlight-label">All LinkedIn documents</p>
                  {user.linkedInProfiles.length ? (
                    user.linkedInProfiles.map((profile) => (
                      <div key={profile.id} className="admin-document-row">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-foreground">{profile.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Date unavailable'}
                          </p>
                        </div>
                        <a
                          href={profile.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-preview-link"
                        >
                          <ExternalLink className="size-3.5" />
                          Preview
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No LinkedIn profile uploads are stored for this user.</p>
                  )}
                </div>
              </section>
            </div>
          </AdminPanel>

          <AdminPanel title="Recent activity" description="Actual product events, not mocked admin notes.">
            <div className="admin-activity-feed">
              {user.recentActivity.length ? (
                user.recentActivity.map((activity) => (
                  <div key={activity.id} className="admin-activity-row">
                    <div className="flex items-start justify-between gap-3">
                      <div className="admin-activity-row-main">
                        <p className="text-sm font-medium text-foreground">{activity.label}</p>
                        <p className="text-sm text-muted-foreground">{activity.detail}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.timestampLabel}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No tracked activity is available for this user yet.</p>
              )}
            </div>
          </AdminPanel>
        </>
      )}

      <Dialog open={editingOpen} onOpenChange={setEditingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update Clerk-backed identity fields and the product-side profile record from one admin form.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              placeholder="First name"
            />
            <Input
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              placeholder="Last name"
            />
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Display name"
            />
            <Select value={form.role} onValueChange={(value) => setForm((current) => ({ ...current, role: value ?? 'user' }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void saveUser()} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
