'use client';

import Link from 'next/link';
import { ExternalLink, LoaderCircle, X } from 'lucide-react';

import type { AdminUserDetail } from '@/lib/admin/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface UserDrawerProps {
  user: AdminUserDetail | null;
  adminId: string;
  open: boolean;
  loading: boolean;
  selectedUserId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function UserDrawer({
  user,
  adminId,
  open,
  loading,
  selectedUserId,
  onOpenChange,
}: UserDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="admin-drawer-shell w-full overflow-y-auto p-0 data-[side=right]:sm:max-w-[38rem]"
      >
        <SheetHeader className="admin-drawer-header">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <SheetTitle className="text-lg">{user?.name ?? 'User detail'}</SheetTitle>
              <SheetDescription>{user?.email ?? 'Loading account details...'}</SheetDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start">
              {user ? <span className="admin-score-chip is-good">Health {user.healthScore}</span> : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="admin-drawer-close"
                onClick={() => onOpenChange(false)}
                aria-label="Close user detail"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="admin-drawer-body">
          {loading ? (
            <div className="flex min-h-[14rem] items-center justify-center text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" />
            </div>
          ) : !user ? (
            <div className="admin-highlight-card">
              <p className="font-semibold text-foreground">Unable to load this user</p>
              <p className="text-sm text-muted-foreground">Try reopening the row to fetch the latest user detail.</p>
            </div>
          ) : (
            <>
              <div className="admin-drawer-stats">
                {[
                  { label: 'Jobs applied', value: user.applications },
                  { label: 'Resume uploads', value: user.resumes },
                  { label: 'Tailored resumes', value: user.tailoredResumes },
                  { label: 'Cover letters', value: user.coverLetters },
                ].map((stat) => (
                  <div key={stat.label} className="admin-drawer-stat">
                    <p>{stat.label}</p>
                    <p>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="admin-highlight-card">
                  <p className="admin-highlight-label">Onboarding</p>
                  <p className="admin-highlight-value">{user.onboardingStatus}</p>
                  <p className="admin-highlight-detail">Derived from the current onboarding state and available resumes.</p>
                </div>
                <div className="admin-highlight-card">
                  <p className="admin-highlight-label">Searches / 30d</p>
                  <p className="admin-highlight-value">{user.searches30d}</p>
                  <p className="admin-highlight-detail">Live search analytics rows linked to this user.</p>
                </div>
                <div className="admin-highlight-card">
                  <p className="admin-highlight-label">Interactions / 30d</p>
                  <p className="admin-highlight-value">{user.interactions30d}</p>
                  <p className="admin-highlight-detail">Tracked job interactions recorded across the app.</p>
                </div>
              </div>

              <div className="admin-drawer-meta">
                <span>Joined {user.joinedLabel}</span>
                <span>Last active {user.lastActiveLabel}</span>
                <span>Last sign in {user.lastSignInLabel}</span>
                <Badge variant="outline">{user.accessRole}</Badge>
                <Badge variant="outline">{user.segment}</Badge>
                {!user.dbProfileExists ? <Badge variant="secondary">Clerk only</Badge> : null}
              </div>

              <div className="admin-highlight-card">
                <p className="font-semibold text-foreground">Recent activity</p>
                <div className="mt-3 admin-activity-feed">
                  {user.recentActivity.length ? (
                    user.recentActivity.map((activity) => (
                      <div key={activity.id} className="admin-activity-row">
                        <div className="admin-activity-row-main">
                          <p className="text-sm font-medium text-foreground">{activity.label}</p>
                          <p className="text-sm text-muted-foreground">{activity.detail}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{activity.timestampLabel}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent tracked activity is available for this user yet.</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="admin-highlight-card">
                  <p className="font-semibold text-foreground">Resumes</p>
                  <div className="mt-3 space-y-2">
                    {user.resumesList.length ? (
                      user.resumesList.map((resume) => (
                        <div
                          key={resume.id}
                          className="flex items-center justify-between gap-3 rounded-[0.72rem] border border-[var(--admin-border)] px-3 py-2 text-sm text-foreground"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{resume.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {resume.createdAt ? new Date(resume.createdAt).toLocaleDateString() : 'Date unavailable'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
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
                </div>

                <div className="admin-highlight-card">
                  <p className="font-semibold text-foreground">LinkedIn uploads</p>
                  <div className="mt-3 space-y-2">
                    {user.linkedInProfiles.length ? (
                      user.linkedInProfiles.map((profile) => (
                        <div key={profile.id} className="flex items-center justify-between gap-3 rounded-[0.72rem] border border-[var(--admin-border)] px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{profile.filename}</p>
                            <p className="text-xs text-muted-foreground">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Date unavailable'}</p>
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
                </div>
              </div>

              <Link href={`/admin/${adminId}/users/${selectedUserId ?? user.id}`} className="admin-drawer-link-row">
                <ExternalLink className="size-4" />
                View full profile
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
