'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, Linkedin, Loader2, Upload, Info } from 'lucide-react';

type UploadSubstep = 'resume' | 'linkedin';

interface FileUploadValue {
  resumeId: string;
  filename: string;
}

interface Props {
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  substep: UploadSubstep;
  setSubstep: (s: UploadSubstep) => void;
  onBackToStepOne: () => void;
  onContinueToStepThree: () => void;
  saving?: boolean;
}

function valueFromAnswers(answers: Record<string, unknown>, key: string): FileUploadValue | null {
  const v = answers[key];
  if (!v || typeof v !== 'object') return null;
  const typed = v as Partial<FileUploadValue>;
  if (!typed.resumeId && !typed.filename) return null;
  return {
    resumeId: String(typed.resumeId ?? ''),
    filename: String(typed.filename ?? ''),
  };
}

const STEP_LABELS = ['Preferences', 'Uploads'];

// ── Info Tooltip ────────────────────────────────────────────────────────────

const LINKEDIN_STEPS = [
  'Open linkedin.com on your desktop browser.',
  'Click the "Me" icon at the top, then "View Profile".',
  'Click "More" below your name and headline.',
  'Select "Save to PDF" from the dropdown.',
  'The file will download automatically.',
];

function LinkedInInfoTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '1.5px solid var(--ot-card-border)',
          background: 'var(--ot-card-bg)',
          cursor: 'pointer',
          padding: 0,
          outline: 'none',
          color: 'var(--ot-text-muted)',
          transition: 'border-color 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ot-primary)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--ot-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ot-card-border)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--ot-text-muted)';
        }}
        aria-label="How to download your LinkedIn profile as PDF"
      >
        <Info style={{ width: 11, height: 11 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            width: 272,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.09)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.05)',
            padding: '14px 16px 12px',
            pointerEvents: 'auto',
          }}
        >
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              bottom: -5,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 9,
              height: 9,
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.09)',
              borderTop: 'none',
              borderLeft: 'none',
            }}
          />

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 11,
              paddingBottom: 10,
              borderBottom: '1px solid rgba(0,0,0,0.07)',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: 'rgba(10,102,194,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Linkedin style={{ width: 12, height: 12, color: '#0a66c2' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Download LinkedIn PDF
            </span>
          </div>

          {/* Steps — left-aligned */}
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {LINKEDIN_STEPS.map((step, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 17,
                    height: 17,
                    borderRadius: '50%',
                    background: 'rgba(29,161,242,0.11)',
                    color: '#1da1f2',
                    fontSize: 9.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1.5,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.5, textAlign: 'left' }}>{step}</span>
              </li>
            ))}
          </ol>

          {/* Footer note */}
          <p
            style={{
              margin: '10px 0 0',
              paddingTop: 9,
              borderTop: '1px solid rgba(0,0,0,0.06)',
              fontSize: 10,
              color: '#94a3b8',
              fontStyle: 'italic',
              textAlign: 'left',
            }}
          >
            Desktop browser only. Not available on mobile.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Resume Panel ───────────────────────────────────────────────────────────────

function ResumePanel({
  value,
  uploading,
  error,
  onPickFile,
  onPrimary,
  primaryDisabled,
  onBack,
}: {
  value: FileUploadValue | null;
  uploading: boolean;
  error: string | null;
  onPickFile: () => void;
  onPrimary: () => void;
  primaryDisabled: boolean;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        width: 'min(520px, 100%)',
        marginLeft: 'auto',
        marginRight: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, rgba(167,139,250,0.35), rgba(167,139,250,0.10) 55%, rgba(255,255,255,0.04) 100%)',
          border: '1px solid rgba(255,255,255,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        }}
      >
        <FileText style={{ width: 34, height: 34, color: 'var(--ot-text)' }} />
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--ot-text)' }}>Upload your resume</div>
        <div style={{ fontSize: 11, color: 'var(--ot-text-muted)', marginTop: 4 }}>PDF only · up to 10 MB</div>
      </div>

      {/* Upload button — no Skip */}
      <div style={{ marginTop: 6 }}>
        <button
          type="button"
          onClick={onPickFile}
          disabled={uploading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 12,
            border: '1px solid var(--ot-card-border)',
            background: 'var(--ot-row-bg)',
            color: 'var(--ot-text)',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.65 : 1,
            fontSize: 13,
          }}
        >
          {uploading ? <Loader2 style={{ width: 16, height: 16 }} /> : <Upload style={{ width: 16, height: 16 }} />}
          {uploading ? 'Uploading…' : value ? 'Replace file' : 'Upload PDF'}
        </button>
      </div>

      {/* Uploaded file chip */}
      {value && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 550,
            border: '1px solid var(--ot-card-border)',
            background: 'var(--ot-row-bg)',
            color: 'var(--ot-text)',
          }}
        >
          <Upload style={{ width: 13, height: 13 }} />
          {value.filename || 'Uploaded'}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--color-destructive)' }}>{error}</div>}

      {/* Nav */}
      <div
        style={{
          width: 'min(520px, 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 26,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 550,
            border: '1.5px solid var(--ot-ghost-border)',
            background: 'var(--ot-ghost-bg)',
            color: 'var(--ot-ghost-color)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />
          Back
        </button>

        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 650,
            border: 'none',
            background: primaryDisabled ? 'var(--ot-primary-alpha)' : 'var(--ot-primary-gradient)',
            color: primaryDisabled ? 'var(--ot-primary)' : 'var(--ot-primary-fg)',
            cursor: primaryDisabled ? 'not-allowed' : 'pointer',
            outline: 'none',
            boxShadow: primaryDisabled ? 'none' : '0 4px 18px var(--ot-primary-glow)',
          }}
        >
          Continue
          <ArrowRight style={{ width: 15, height: 15 }} />
        </button>
      </div>
    </div>
  );
}

// ── LinkedIn Panel ─────────────────────────────────────────────────────────────

function LinkedInPanel({
  value,
  uploading,
  error,
  onPickFile,
  onSkip,
  onPrimary,
  primaryDisabled,
  onBack,
}: {
  value: FileUploadValue | null;
  uploading: boolean;
  error: string | null;
  onPickFile: () => void;
  onSkip: () => void;
  onPrimary: () => void;
  primaryDisabled: boolean;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        width: 'min(520px, 100%)',
        marginLeft: 'auto',
        marginRight: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, rgba(10,102,194,0.30), rgba(10,102,194,0.08) 55%, rgba(255,255,255,0.04) 100%)',
          border: '1px solid rgba(255,255,255,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        }}
      >
        <Linkedin style={{ width: 34, height: 34, color: 'var(--ot-text)' }} />
      </div>

      {/* Title + Optional badge + Info icon */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--ot-text)' }}>LinkedIn profile PDF</div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 9999,
              background: 'var(--ot-primary-alpha)',
              color: 'var(--ot-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Optional
          </span>
          <LinkedInInfoTooltip />
        </div>
        <div style={{ fontSize: 11, color: 'var(--ot-text-muted)' }}>PDF only · up to 10 MB · desktop browser only</div>
      </div>

      {/* Upload + Skip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={onPickFile}
          disabled={uploading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 12,
            border: '1px solid var(--ot-card-border)',
            background: 'var(--ot-row-bg)',
            color: 'var(--ot-text)',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.65 : 1,
            fontSize: 13,
          }}
        >
          {uploading ? <Loader2 style={{ width: 16, height: 16 }} /> : <Upload style={{ width: 16, height: 16 }} />}
          {uploading ? 'Uploading…' : value ? 'Replace file' : 'Upload PDF'}
        </button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ot-text-muted)',
            cursor: 'pointer',
            padding: '10px 8px',
            fontSize: 13,
            textDecoration: 'underline',
            textDecorationColor: 'transparent',
            transition: 'color 0.15s ease, text-decoration-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ot-text)';
            e.currentTarget.style.textDecorationColor = 'var(--ot-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ot-text-muted)';
            e.currentTarget.style.textDecorationColor = 'transparent';
          }}
        >
          Skip
        </button>
      </div>

      {/* Uploaded file chip */}
      {value && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 550,
            border: '1px solid var(--ot-card-border)',
            background: 'var(--ot-row-bg)',
            color: 'var(--ot-text)',
          }}
        >
          <Upload style={{ width: 13, height: 13 }} />
          {value.filename || 'Uploaded'}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--color-destructive)' }}>{error}</div>}

      {/* Nav */}
      <div
        style={{
          width: 'min(520px, 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 26,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 550,
            border: '1.5px solid var(--ot-ghost-border)',
            background: 'var(--ot-ghost-bg)',
            color: 'var(--ot-ghost-color)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />
          Back
        </button>

        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 650,
            border: 'none',
            background: primaryDisabled ? 'var(--ot-primary-alpha)' : 'var(--ot-primary-gradient)',
            color: primaryDisabled ? 'var(--ot-primary)' : 'var(--ot-primary-fg)',
            cursor: primaryDisabled ? 'not-allowed' : 'pointer',
            outline: 'none',
            boxShadow: primaryDisabled ? 'none' : '0 4px 18px var(--ot-primary-glow)',
          }}
        >
          Finish
          <ArrowRight style={{ width: 15, height: 15 }} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function OnboardingUploadsScreen({
  answers,
  setAnswers,
  substep,
  setSubstep,
  onBackToStepOne,
  onContinueToStepThree,
  saving,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeKey = substep === 'resume' ? 'resume_upload' : 'linkedin_pdf';
  const activeValue = valueFromAnswers(answers, activeKey);
  const endpoint = substep === 'linkedin' ? '/api/upload-linkedin' : '/api/upload-resume';

  const progressPct = substep === 'resume' ? 75 : 100;

  const handlePickFile = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleSkipLinkedin = () => {
    setError(null);
    setAnswers((prev) => ({ ...prev, linkedin_pdf: 'skipped' }));
    onContinueToStepThree();
  };

  const handleResumePrimary = () => setSubstep('linkedin');

  const handleLinkedinPrimary = () => onContinueToStepThree();

  const handleBack = () => {
    if (substep === 'linkedin') {
      setSubstep('resume');
      return;
    }
    onBackToStepOne();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      event.currentTarget.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File must be 10 MB or smaller.');
      event.currentTarget.value = '';
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = (await res.json()) as {
        resume?: { id: string; filename?: string };
        profile?: { id: string; filename?: string };
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      const id = data.resume?.id ?? data.profile?.id ?? '';
      setAnswers((prev) => ({ ...prev, [activeKey]: { resumeId: id, filename: file.name } }));

      // After successful resume upload, immediately advance to LinkedIn
      if (activeKey === 'resume_upload') setSubstep('linkedin');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
      event.currentTarget.value = '';
    }
  };

  const primaryDisabled = Boolean(saving) || uploading;

  return (
    <div style={{ minHeight: '100vh', padding: '52px 10% 96px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Branding ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 40 }}>
        <img
          src="/aladdin-logo.png"
          alt="Aladdin"
          width={38}
          height={38}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: "Lato, 'Open Sans', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--ot-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Aladdin
        </span>
      </div>

      {/* ── Step indicator + progress bar ── */}
      <div style={{ marginBottom: 36 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              // Step 1 (Preferences) is always done when we're on uploads
              const done = stepNum === 1;
              const active = stepNum === 2;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: done
                        ? 'var(--ot-primary)'
                        : active
                        ? 'var(--ot-primary-alpha)'
                        : 'var(--ot-step-inactive-bg)',
                      border: `2px solid ${done || active ? 'var(--ot-primary)' : 'var(--ot-step-inactive-border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: done
                        ? 'var(--ot-primary-fg)'
                        : active
                        ? 'var(--ot-primary)'
                        : 'var(--ot-step-inactive-color)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {done ? '✓' : stepNum}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      color: active
                        ? 'var(--ot-text)'
                        : done
                        ? 'var(--ot-step-done-color)'
                        : 'var(--ot-step-inactive-color)',
                      transition: 'color 0.25s ease',
                    }}
                  >
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      style={{
                        width: 28,
                        height: 1,
                        background: 'var(--ot-track-bg)',
                        marginLeft: 2,
                        marginRight: 2,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: 12, color: 'var(--ot-text-muted)' }}>{progressPct}%</span>
        </div>

        {/* Progress track */}
        <div
          style={{
            height: 4,
            borderRadius: 9999,
            background: 'var(--ot-track-bg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: 9999,
              background: 'var(--ot-primary-gradient)',
              transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      <div
        style={{
          minHeight: 'calc(100vh - 52px - 96px - 120px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {substep === 'resume' ? (
          <ResumePanel
            value={activeValue}
            uploading={uploading}
            error={error}
            onPickFile={handlePickFile}
            onPrimary={handleResumePrimary}
            primaryDisabled={primaryDisabled}
            onBack={handleBack}
          />
        ) : (
          <LinkedInPanel
            value={activeValue}
            uploading={uploading}
            error={error}
            onPickFile={handlePickFile}
            onSkip={handleSkipLinkedin}
            onPrimary={handleLinkedinPrimary}
            primaryDisabled={primaryDisabled}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
