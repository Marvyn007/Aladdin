'use client';

import { useState } from 'react';
import { ArrowLeft, ExternalLink, Linkedin, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { cn } from '@/lib/utils';
import { adminUsers, AdminUserRecord } from '@/components/admin/admin-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function UserProfilePage() {
  const params = useParams<{ adminId: string; userId: string }>();
  const { adminId, userId } = params;

  const initial = adminUsers.find((u) => u.id === userId);

  const [user, setUser] = useState<AdminUserRecord | undefined>(initial);
  const [plan, setPlan] = useState<AdminUserRecord['plan']>(initial?.plan ?? 'Free');
  const [segment, setSegment] = useState<AdminUserRecord['segment']>(initial?.segment ?? 'New');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [resumeLinks, setResumeLinks] = useState<string[]>(initial?.resumeLinks ?? []);
  const [linkedinUrl, setLinkedinUrl] = useState(initial?.linkedinUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) {
    return (
      <div className="flex flex-col gap-4 py-4 px-4 lg:px-6 md:gap-6 md:py-6">
        <p className="text-muted-foreground">User not found.</p>
        <Link href={`/admin/${adminId}/users`} className="text-sm text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="size-4" /> Back to users
        </Link>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updates = { plan, segment, notes, resumeLinks, linkedinUrl: linkedinUrl || null };
      await fetch(`/api/admin/users/${user!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setUser((u) => (u ? { ...u, ...updates } : u));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const healthColor =
    user.healthScore >= 80
      ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200'
      : user.healthScore >= 50
      ? 'text-amber-700 bg-amber-50 ring-1 ring-amber-200'
      : 'text-red-700 bg-red-50 ring-1 ring-red-200';

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6">
      {/* Breadcrumb */}
      <div className="px-4 lg:px-6">
        <Link
          href={`/admin/${adminId}/users`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to users
        </Link>
      </div>

      {/* Header */}
      <div className="px-4 lg:px-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge
              variant={plan === 'Premium' ? 'default' : plan === 'Pro' ? 'secondary' : 'outline'}
              className="rounded-full px-2.5 py-0.5"
            >
              {plan}
            </Badge>
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
              {segment}
            </Badge>
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
              {user.focus}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold', healthColor)}>
            Health {user.healthScore}
          </span>
        </div>
      </div>

      <div className="px-4 lg:px-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left — edit form */}
        <div className="space-y-6">
          {/* Plan & Segment */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Account settings</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</label>
                <Select value={plan} onValueChange={(v) => setPlan(v as AdminUserRecord['plan'])}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Free">Free</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Segment</label>
                <Select value={segment} onValueChange={(v) => setSegment(v as AdminUserRecord['segment'])}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Power">Power</SelectItem>
                    <SelectItem value="At Risk">At Risk</SelectItem>
                    <SelectItem value="Dormant">Dormant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* LinkedIn */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">LinkedIn</h2>
            <div className="relative">
              <Linkedin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                className="pl-9 rounded-full"
              />
            </div>
            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" /> View profile
              </a>
            )}
          </div>

          {/* Resume links */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Resumes</h2>
            <div className="space-y-2">
              {resumeLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={link}
                    onChange={(e) =>
                      setResumeLinks((prev) => prev.map((l, j) => (j === i ? e.target.value : l)))
                    }
                    className="rounded-full text-sm"
                    placeholder="https://…"
                  />
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  <button
                    onClick={() => setResumeLinks((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full w-full"
                onClick={() => setResumeLinks((prev) => [...prev, ''])}
              >
                <Plus className="size-4" />
                Add resume link
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Operator notes</h2>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Internal notes about this user…"
              className="rounded-2xl resize-none"
            />
          </div>
        </div>

        {/* Right — stats sidebar */}
        <div className="space-y-4">
          {/* Health bar */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Engagement health</h2>
              <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', healthColor)}>
                {user.healthScore}
              </span>
            </div>
            <Progress
              value={user.healthScore}
              className={cn(
                'h-2',
                user.healthScore >= 80
                  ? '[&>div]:bg-emerald-500'
                  : user.healthScore >= 50
                  ? '[&>div]:bg-amber-500'
                  : '[&>div]:bg-red-500'
              )}
            />
            <p className="text-xs text-muted-foreground">
              {user.healthScore >= 80
                ? 'Strong engagement — user is active and productive.'
                : user.healthScore >= 50
                ? 'Moderate engagement — watch for churn signals.'
                : 'Low engagement — consider re-activation outreach.'}
            </p>
          </div>

          {/* Usage stats */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Usage</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Resumes', value: user.resumes },
                { label: 'Applications', value: user.applications },
                { label: 'Cover letters', value: user.coverLetters },
                { label: 'Interviews', value: user.interviews },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Account meta */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Account details</h2>
            <dl className="space-y-2 text-sm">
              {[
                { label: 'User ID', value: user.id },
                { label: 'Joined', value: user.joinedAt },
                { label: 'Last active', value: user.lastActive },
                { label: 'Onboarding', value: user.onboarding },
                { label: 'Consent', value: user.consent },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-10 border-t border-border/60 bg-background/95 backdrop-blur-sm px-4 lg:px-6 py-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {saved ? (
            <span className="text-emerald-600 font-medium">Saved successfully</span>
          ) : (
            'Changes are saved to this session.'
          )}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-full" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
