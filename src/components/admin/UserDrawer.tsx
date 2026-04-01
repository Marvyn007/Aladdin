'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Linkedin, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { AdminUserRecord } from '@/components/admin/admin-data';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

interface UserDrawerProps {
  user: AdminUserRecord | null;
  adminId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<AdminUserRecord>) => void;
}

export function UserDrawer({ user, adminId, open, onOpenChange, onSave }: UserDrawerProps) {
  const [plan, setPlan] = useState<AdminUserRecord['plan']>(user?.plan ?? 'Free');
  const [segment, setSegment] = useState<AdminUserRecord['segment']>(user?.segment ?? 'New');
  const [notes, setNotes] = useState(user?.notes ?? '');
  const [resumeLinks, setResumeLinks] = useState<string[]>(user?.resumeLinks ?? []);
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedinUrl ?? '');
  const [saving, setSaving] = useState(false);

  // Sync local state whenever the selected user changes
  useEffect(() => {
    if (!user) return;
    setPlan(user.plan);
    setSegment(user.segment);
    setNotes(user.notes);
    setResumeLinks(user.resumeLinks);
    setLinkedinUrl(user.linkedinUrl ?? '');
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const updates = {
        plan,
        segment,
        notes,
        resumeLinks,
        linkedinUrl: linkedinUrl || null,
      };
      await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      onSave(user.id, updates);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-lg">{user.name}</SheetTitle>
              <SheetDescription className="text-sm">{user.email}</SheetDescription>
            </div>
            <span
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold shrink-0',
                user.healthScore >= 80
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : user.healthScore >= 50
                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                  : 'bg-red-50 text-red-700 ring-1 ring-red-200'
              )}
            >
              Health {user.healthScore}
            </span>
          </div>
        </SheetHeader>

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Usage stats */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Usage
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Resumes', value: user.resumes },
                { label: 'Applications', value: user.applications },
                { label: 'Cover letters', value: user.coverLetters },
                { label: 'Interviews', value: user.interviews },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3"
                >
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Joined {user.joinedAt}</span>
            <span>·</span>
            <span>Last active {user.lastActive}</span>
            <span>·</span>
            <span>Consent: {user.consent}</span>
            <span>·</span>
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">{user.focus}</Badge>
          </div>

          {/* Plan */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Plan
            </label>
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

          {/* Segment */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Segment
            </label>
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

          {/* LinkedIn */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              LinkedIn URL
            </label>
            <div className="relative">
              <Linkedin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                className="pl-9 rounded-full"
              />
            </div>
          </div>

          {/* Resume links */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resume links
            </label>
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
                  <a href={link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-4" />
                  </a>
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
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Operator notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this user…"
              className="rounded-2xl resize-none"
            />
          </div>

          {/* View full profile */}
          <Link
            href={`/admin/${adminId}/users/${user.id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            View full profile
          </Link>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 flex justify-end gap-3">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
