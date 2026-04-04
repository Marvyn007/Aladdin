'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { ExternalLink, Globe, LoaderCircle, Pencil, Trash2, X, Link as LinkIcon } from 'lucide-react';

import { AdminPageIntro, AdminPanel, AdminStatCard } from '@/components/admin/admin-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const MULTI_LOCATION_RE = /\s*[|\/]\s*|\s+or\s+|\s+&\s+/i

function computeReviewReasons(job: AdminJobSummary): string[] {
  const reasons: string[] = []
  if (job.descriptionLength === 0) reasons.push('No job description')
  else if (job.descriptionLength < 1000) reasons.push(`Very short description (${job.descriptionLength} chars)`)
  else if (job.descriptionLength < 3000) reasons.push(`Short description (${job.descriptionLength} chars)`)
  if (!job.location?.trim()) reasons.push('Missing location')
  else if (MULTI_LOCATION_RE.test(job.location)) reasons.push('Multiple locations detected')
  if (!job.sourceUrl?.trim()) reasons.push('No source URL / apply link')
  return reasons
}

function computeEffectiveCurationStatus(job: AdminJobSummary): 'reviewed' | 'needs_review' | 'not_reviewed' {
  if (job.adminCurationStatus === 'reviewed') return 'reviewed'
  if (computeReviewReasons(job).length > 0) return 'needs_review'
  return 'not_reviewed'
}

// Severity score: lower = more severe (darker red, sorts to top)
function needsReviewSeverity(job: AdminJobSummary): number {
  return job.descriptionLength
}

const CURATION_LABEL: Record<string, string> = {
  reviewed: 'Reviewed',
  needs_review: 'Needs Review',
  not_reviewed: 'Not Reviewed',
}

const CURATION_STYLE: Record<string, React.CSSProperties> = {
  reviewed: { backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  needs_review: { backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
  not_reviewed: { backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' },
}

const STATUS_SORT_ORDER: Record<string, number> = { needs_review: 0, not_reviewed: 1, reviewed: 2 }

function getDescRowStyle(len: number): React.CSSProperties {
  if (len >= 3000) return {};
  if (len < 1000) return { backgroundColor: 'rgba(220,38,38,0.20)' };
  if (len < 2000) return { backgroundColor: 'rgba(220,38,38,0.11)' };
  return { backgroundColor: 'rgba(220,38,38,0.05)' };
}

function getDescBadgeStyle(len: number): React.CSSProperties {
  if (len >= 3000) return { backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' };
  if (len < 1000) return { backgroundColor: 'rgba(220,38,38,0.15)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.3)' };
  if (len < 2000) return { backgroundColor: 'rgba(220,38,38,0.09)', color: '#c2410c', border: '1px solid rgba(220,38,38,0.2)' };
  return { backgroundColor: 'rgba(220,38,38,0.05)', color: '#d97706', border: '1px solid rgba(220,38,38,0.12)' };
}

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
  const [curationFilter, setCurationFilter] = useState('needs_review');
  const [updatingCurationId, setUpdatingCurationId] = useState<string | null>(null);

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

  async function updateCurationStatus(job: AdminJobSummary, forceTo?: string) {
    const currentEffective = computeEffectiveCurationStatus(job)
    const next = forceTo ?? (currentEffective === 'reviewed' ? 'not_reviewed' : 'reviewed')
    setUpdatingCurationId(job.id)
    try {
      const response = await fetch(`/api/admin/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCurationStatus: next }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to update status')
      if (payload.job) {
        setJobs((current) => current.map((j) => (j.id === payload.job.id ? payload.job : j)))
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Failed to update curation status')
    } finally {
      setUpdatingCurationId(null)
    }
  }

  const filteredJobs = jobs
    .filter((job) => {
      const statusMatch = status === 'all' || job.status === status
      if (!statusMatch) return false
      if (curationFilter === 'all') return true
      return computeEffectiveCurationStatus(job) === curationFilter
    })
    .sort((a, b) => {
      const aEff = computeEffectiveCurationStatus(a)
      const bEff = computeEffectiveCurationStatus(b)
      const orderDiff = (STATUS_SORT_ORDER[aEff] ?? 1) - (STATUS_SORT_ORDER[bEff] ?? 1)
      if (orderDiff !== 0) return orderDiff
      // Within needs_review: lowest descriptionLength first (darkest red on top)
      if (aEff === 'needs_review') return needsReviewSeverity(a) - needsReviewSeverity(b)
      return 0
    });
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
            <Select value={curationFilter} onValueChange={(value) => setCurationFilter(value ?? 'all')}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All curation statuses</SelectItem>
                <SelectItem value="not_reviewed">Not Reviewed</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>
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
          <Table className="admin-wide-table">
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '22%' }}>Job</TableHead>
                <TableHead className="hidden md:table-cell" style={{ width: '10%' }}>Posted</TableHead>
                <TableHead style={{ width: '12%' }}>Source</TableHead>
                <TableHead style={{ width: '16%' }}>Funnel</TableHead>
                <TableHead className="hidden xl:table-cell" style={{ width: '11%' }}>Posted by</TableHead>
                <TableHead style={{ width: '10%' }}>Desc. Length</TableHead>
                <TableHead style={{ width: '11%' }}>Curation</TableHead>
                <TableHead style={{ width: '6%' }}>Edit</TableHead>
                <TableHead style={{ width: '6%' }}>Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.id} style={getDescRowStyle(job.descriptionLength)}>
                  <TableCell className="align-top whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.company} - {job.location}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell align-top">
                    <p className="font-medium text-foreground">{formatLongDate(job.postedAt)}</p>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
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
                  <TableCell className="align-top whitespace-normal">
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
                  <TableCell className="align-top">
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', ...getDescBadgeStyle(job.descriptionLength) }}>
                      {job.descriptionLength.toLocaleString()} chars
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    {(() => {
                      const effective = computeEffectiveCurationStatus(job)
                      const isUpdating = updatingCurationId === job.id
                      const reasons = computeReviewReasons(job)
                      const isNeedsReview = effective === 'needs_review'
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            onClick={() => !isNeedsReview && void updateCurationStatus(job)}
                            disabled={isUpdating}
                            title={isNeedsReview ? undefined : 'Click to toggle curation status'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
                              fontWeight: 700,
                              cursor: isNeedsReview ? 'default' : (isUpdating ? 'wait' : 'pointer'),
                              border: 'none', transition: 'opacity 0.15s',
                              opacity: isUpdating ? 0.6 : 1,
                              fontFamily: 'inherit',
                              ...CURATION_STYLE[effective],
                            }}
                          >
                            {isUpdating ? '...' : CURATION_LABEL[effective]}
                          </button>
                          {isNeedsReview && reasons.length > 0 && (
                            <span
                              title={reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '15px', height: '15px', borderRadius: '50%',
                                backgroundColor: 'rgba(194,65,12,0.12)', color: '#c2410c',
                                fontSize: '9px', fontWeight: 900, cursor: 'help', flexShrink: 0,
                                border: '1px solid rgba(194,65,12,0.2)', userSelect: 'none',
                              }}
                            >
                              i
                            </span>
                          )}
                          {isNeedsReview && (
                            <button
                              onClick={() => void updateCurationStatus(job)}
                              disabled={isUpdating}
                              title="Mark as Reviewed"
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '20px', height: '20px', borderRadius: '5px', border: 'none',
                                backgroundColor: 'rgba(194,65,12,0.08)', color: '#c2410c',
                                fontSize: '11px', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                                fontFamily: 'inherit',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(194,65,12,0.18)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(194,65,12,0.08)')}
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => openEditDialog(job)}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </TableCell>
                  <TableCell>
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
                  <TableCell colSpan={9}>
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

      {editingJob && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 55,
              backgroundColor: 'rgba(15,23,42,0.4)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setEditingJob(null)}
          />

          {/* Drawer panel */}
          <div
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              zIndex: 60, width: '100%', maxWidth: '540px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0, backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
                  <Pencil size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.2 }}>Edit Job</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '2px' }}>Job Record Editor</div>
                </div>
              </div>
              <button
                onClick={() => setEditingJob(null)}
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
              {/* Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>{jobForm.title || 'Job Title'}</div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>{jobForm.company}{jobForm.location ? ` · ${jobForm.location}` : ''}</div>
                {jobForm.status && (
                  <span style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', padding: '4px 10px', borderRadius: '6px' }}>
                    {jobForm.status}
                  </span>
                )}
              </div>

              {/* Job Details */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <Pencil size={14} style={{ color: '#93c5fd' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#94a3b8' }}>Job Details</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { label: 'Job Title', key: 'title', placeholder: 'e.g. Software Engineer' },
                    { label: 'Company', key: 'company', placeholder: 'e.g. OpenAI' },
                    { label: 'Location', key: 'location', placeholder: 'e.g. San Francisco, CA' },
                    { label: 'Status', key: 'status', placeholder: 'e.g. open' },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '2px' }}>{label}</label>
                      <input
                        type="text"
                        value={jobForm[key as keyof typeof jobForm]}
                        onChange={(e) => setJobForm((c) => ({ ...c, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{ width: '100%', padding: '12px 16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Source */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <Globe size={14} style={{ color: '#93c5fd' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#94a3b8' }}>Source</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '2px' }}>Source Name</label>
                    <input
                      type="text"
                      value={jobForm.source}
                      onChange={(e) => setJobForm((c) => ({ ...c, source: e.target.value }))}
                      placeholder="e.g. greenhouse"
                      style={{ width: '100%', padding: '12px 16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '2px' }}>Source URL</label>
                    <div style={{ position: 'relative' }}>
                      <LinkIcon size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        value={jobForm.sourceUrl}
                        onChange={(e) => setJobForm((c) => ({ ...c, sourceUrl: e.target.value }))}
                        placeholder="https://boards.greenhouse.io/..."
                        style={{ width: '100%', padding: '12px 16px 12px 42px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ flexShrink: 0, borderTop: '1px solid #f1f5f9', backgroundColor: '#ffffff', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setEditingJob(null)}
                disabled={isSaving}
                style={{ fontSize: '14px', fontWeight: 600, color: '#475569', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: isSaving ? 0.5 : 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
              >
                Cancel
              </button>
              <button
                onClick={() => void saveJob()}
                disabled={isSaving}
                style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 700, fontSize: '14px', padding: '12px 32px', borderRadius: '12px', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.5 : 1, boxShadow: '0 4px 14px rgba(15,23,42,0.2)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, sans-serif' }}
                onMouseEnter={(e) => { if (!isSaving) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {isSaving ? <><LoaderCircle size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </div>
  );
}
