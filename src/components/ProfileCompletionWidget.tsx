'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

/* ── types ── */
type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface UploadedFile { resumeId: string; filename: string; }

interface InitialFiles {
  resume: UploadedFile | null;
  linkedin: UploadedFile | null;
}

interface Snapshot {
  completed: boolean;
  profileSetupComplete: boolean;
  answersByKey?: Record<string, { value: unknown }>;
}

/* ── Save an answer to the onboarding snapshot ── */
async function saveOnboardingAnswer(questionKey: string, value: unknown) {
  await fetch('/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentStep: 2,
      answers: [{ questionKey, value }],
    }),
  });
}

/* ── Extract UploadedFile from a stored answer value ── */
function fileFromValue(val: unknown): UploadedFile | null {
  if (!val || val === 'skipped' || typeof val !== 'object') return null;
  const obj = val as Record<string, unknown>;
  if (typeof obj.resumeId === 'string' && typeof obj.filename === 'string') {
    return { resumeId: obj.resumeId, filename: obj.filename };
  }
  return null;
}

/* ─────────────────────────────────────────────
   Chevron icon
   ───────────────────────────────────────────── */
function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        flexShrink: 0,
        color: 'var(--text-muted, #999)',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.22s ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   AccordionItem — collapsible step wrapper
   ───────────────────────────────────────────── */
function AccordionItem({
  index,
  label,
  done,
  open,
  onToggle,
  children,
}: {
  index: number;
  label: string;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          outline: 'none',
        }}
      >
        {/* Status badge */}
        <div style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10.5,
          fontWeight: 700,
          background: done ? 'var(--accent, #2383e2)' : 'transparent',
          border: done ? 'none' : '1.5px solid var(--border)',
          color: done ? '#fff' : 'var(--text-muted, #aaa)',
        }}>
          {done ? '✓' : index + 1}
        </div>

        {/* Label */}
        <span style={{
          flex: 1,
          fontSize: 13,
          fontWeight: done ? 400 : 600,
          color: done ? 'var(--text-muted, #888)' : 'var(--text-primary, inherit)',
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {label}
        </span>

        {done && (
          <span style={{
            fontSize: 11,
            color: 'var(--accent, #2383e2)',
            fontWeight: 500,
            marginRight: 6,
          }}>
            Done
          </span>
        )}

        <ChevronDown open={open} />
      </button>

      {/* Collapsible body */}
      <div style={{
        maxHeight: open ? 440 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div style={{ padding: '2px 16px 16px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   UploadStep — used for resume and LinkedIn
   ───────────────────────────────────────────── */
function UploadStep({
  title,
  description,
  endpoint,
  answerKey,
  initialFile,
  onDone,
  onSkip,
}: {
  title: string;
  description: string;
  endpoint: string;
  answerKey: string;
  initialFile: UploadedFile | null;
  onDone: () => void;
  onSkip?: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>(initialFile ? 'done' : 'idle');
  const [file, setFile] = useState<UploadedFile | null>(initialFile);
  const [errorMsg, setErrorMsg] = useState('');
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    if (initialFile && uploadState === 'idle') {
      setFile(initialFile);
      setUploadState('done');
    }
  }, [initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { setErrorMsg('Only PDF files are accepted.'); return; }
    if (f.size > 10 * 1024 * 1024) { setErrorMsg('File must be 10 MB or smaller.'); return; }

    setErrorMsg('');
    setUploadState('uploading');
    try {
      const form = new FormData();
      form.append('file', f);
      const res = await fetch(endpoint, { method: 'POST', body: form });
      const data = await res.json() as {
        resume?: { id: string };
        profile?: { id: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      const fileId = data.resume?.id ?? data.profile?.id ?? '';
      const uploaded: UploadedFile = { resumeId: fileId, filename: f.name };
      setFile(uploaded);
      setUploadState('done');
      await saveOnboardingAnswer(answerKey, uploaded);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
      setUploadState('error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSkip = async () => {
    if (!onSkip) return;
    setSkipping(true);
    try {
      await onSkip();
    } finally {
      setSkipping(false);
    }
  };

  const isReady = uploadState === 'done';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary, inherit)' }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary, #666)', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>

      {isReady && file ? (
        /* Success state */
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 12px',
          borderRadius: 8,
          background: 'rgba(35,131,226,0.07)',
          border: '1px solid rgba(35,131,226,0.22)',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--accent, #2383e2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#fff',
          }}>
            ✓
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 11.5, fontWeight: 600,
              color: 'var(--accent, #2383e2)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {file.filename}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary, #888)' }}>
              Uploaded successfully
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--text-secondary, #888)', padding: '2px 4px',
              flexShrink: 0,
            }}
          >
            Replace
          </button>
        </div>
      ) : (
        /* Drop zone */
        <div
          onClick={() => uploadState !== 'uploading' && fileRef.current?.click()}
          style={{
            border: `1.5px dashed ${uploadState === 'error' ? '#e03e3e' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '14px 12px',
            textAlign: 'center',
            cursor: uploadState === 'uploading' ? 'default' : 'pointer',
            background: 'var(--background-secondary, transparent)',
          }}
        >
          {uploadState === 'uploading' ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #888)' }}>Uploading...</p>
          ) : (
            <>
              <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, inherit)' }}>
                Click to select a PDF
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary, #999)' }}>10 MB max</p>
            </>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFile} />

      {errorMsg && (
        <p style={{ margin: 0, fontSize: 11, color: '#e03e3e' }}>{errorMsg}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          disabled={!isReady}
          onClick={onDone}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 600,
            border: 'none',
            background: isReady ? 'var(--accent, #2383e2)' : 'var(--border)',
            color: isReady ? '#fff' : 'var(--text-muted, #999)',
            cursor: isReady ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          Continue
        </button>

        {onSkip && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={skipping}
            style={{
              width: '100%',
              padding: '7px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 500,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary, #888)',
              cursor: skipping ? 'not-allowed' : 'pointer',
              opacity: skipping ? 0.6 : 1,
            }}
          >
            {skipping ? 'Saving...' : 'Skip — add later'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PreferencesStep
   ───────────────────────────────────────────── */
function PreferencesStep({
  done,
  onNavigate,
}: {
  done: boolean;
  onNavigate: () => void;
}) {
  if (done) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 8,
        background: 'rgba(35,131,226,0.07)',
        border: '1px solid rgba(35,131,226,0.22)',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--accent, #2383e2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#fff',
        }}>
          ✓
        </div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent, #2383e2)' }}>
          Preferences saved
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary, inherit)' }}>
          Set your job preferences
        </p>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary, #666)', lineHeight: 1.5 }}>
          Tell us the roles, locations, and work style you are targeting so we can surface the right opportunities.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          'Role families and career level',
          'Employment type and regions',
          'Onsite, hybrid, or remote',
          'Visa sponsorship needs',
        ].map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', flexShrink: 0, background: 'var(--accent, #2383e2)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #666)' }}>{item}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onNavigate}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: 7,
          fontSize: 12.5,
          fontWeight: 600,
          border: 'none',
          background: 'var(--accent, #2383e2)',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Go to Preferences
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main widget
   ───────────────────────────────────────────── */
export function ProfileCompletionWidget() {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const prevPathRef = useRef(pathname);

  // DB-driven: undefined = loading, true = complete (hide), false = incomplete (show)
  const [setupComplete, setSetupComplete] = useState<boolean | undefined>(undefined);

  // Per-step completion state (derived from DB checks)
  const [stepDone, setStepDone] = useState({ resume: false, linkedin: false, prefs: false });
  const [initialFiles, setInitialFiles] = useState<InitialFiles>({ resume: null, linkedin: null });

  // Accordion: which step is open (-1 = none)
  const [openStep, setOpenStep] = useState<number>(-1);
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);

  const toggleStep = (i: number) => setOpenStep((prev) => (prev === i ? -1 : i));

  const checkStatus = async () => {
    if (!isSignedIn) return;
    try {
      const [snapshotRes, resumeRes, linkedinRes] = await Promise.all([
        fetch('/api/onboarding'),
        fetch('/api/upload-resume'),
        fetch('/api/upload-linkedin'),
      ]);

      if (!snapshotRes.ok) return;
      const snapshot = await snapshotRes.json() as Snapshot;

      // Source of truth: DB flag
      if (snapshot.profileSetupComplete) {
        setSetupComplete(true);
        return;
      }

      const answers = snapshot.answersByKey ?? {};

      // Resume
      const resumeAnswerFile = fileFromValue(answers['resume_upload']?.value);
      let resumeFile = resumeAnswerFile;
      if (!resumeFile && resumeRes.ok) {
        const resumeData = await resumeRes.json() as { resumes?: Array<{ id: string; filename: string }> };
        const first = resumeData.resumes?.[0] ?? null;
        if (first) {
          resumeFile = { resumeId: first.id, filename: first.filename };
          void saveOnboardingAnswer('resume_upload', resumeFile);
        }
      }

      // LinkedIn
      const linkedinAnswerVal = answers['linkedin_pdf']?.value;
      const linkedinAnswerFile = fileFromValue(linkedinAnswerVal);
      const linkedinSkipped = linkedinAnswerVal === 'skipped';
      let linkedinFile = linkedinAnswerFile;
      if (!linkedinFile && !linkedinSkipped && linkedinRes.ok) {
        const linkedinData = await linkedinRes.json() as { profiles?: Array<{ id: string; filename: string }> };
        const first = linkedinData.profiles?.[0] ?? null;
        if (first) {
          linkedinFile = { resumeId: first.id, filename: first.filename };
          void saveOnboardingAnswer('linkedin_pdf', linkedinFile);
        }
      }

      const resumeDone = !!resumeFile;
      const linkedinDone = !!linkedinFile || linkedinSkipped;
      const prefsDone = snapshot.completed;

      setInitialFiles({ resume: resumeFile, linkedin: linkedinFile });
      setStepDone({ resume: resumeDone, linkedin: linkedinDone, prefs: prefsDone });
      setSetupComplete(false);

      // Auto-open the first incomplete step
      if (!resumeDone) setOpenStep(0);
      else if (!linkedinDone) setOpenStep(1);
      else if (!prefsDone) setOpenStep(2);
      else setOpenStep(-1);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setSetupComplete(true); return; }
    void checkStatus();
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check on navigation back from /onboarding
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (prev === '/onboarding' && pathname !== '/onboarding') {
      void checkStatus();
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate in/out
  useEffect(() => {
    if (setupComplete === false) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [setupComplete]);

  if (pathname === '/onboarding') return null;
  if (setupComplete !== false) return null;

  const markStepDone = (key: 'resume' | 'linkedin' | 'prefs') => {
    setStepDone((prev) => {
      const next = { ...prev, [key]: true };
      // If all 3 done, re-fetch to pick up the updated DB flag
      if (next.resume && next.linkedin && next.prefs) {
        void checkStatus();
      } else {
        // Open next incomplete step
        if (!next.resume) setOpenStep(0);
        else if (!next.linkedin) setOpenStep(1);
        else if (!next.prefs) setOpenStep(2);
        else setOpenStep(-1);
      }
      return next;
    });
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9998,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {collapsed ? (
        /* ── Collapsed pill ── */
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          style={{
            padding: '10px 20px',
            borderRadius: 9999,
            background: 'var(--accent, #2383e2)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(35,131,226,0.35)',
            outline: 'none',
            position: 'relative',
          }}
        >
          <span style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 9999,
            border: '2px solid rgba(35,131,226,0.4)',
            animation: 'profileWidgetPulse 2.2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          Finish Your Profile
        </button>
      ) : (
        /* ── Expanded modal ── */
        <div style={{
          width: 380,
          borderRadius: 14,
          background: 'var(--surface, var(--background))',
          border: '1px solid var(--border)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {/* Top accent bar */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #2383e2, #60a5fa)' }} />

          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '13px 16px 12px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary, inherit)' }}>
                Finish Your Profile
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary, #888)' }}>
                {[stepDone.resume, stepDone.linkedin, stepDone.prefs].filter(Boolean).length} of 3 steps complete
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '3px 7px',
                fontSize: 13,
                color: 'var(--text-secondary, #888)',
                borderRadius: 4,
                outline: 'none',
                lineHeight: 1,
              }}
            >
              —
            </button>
          </div>

          {/* Accordion steps */}
          <div>
            {/* Step 1 — Resume */}
            <AccordionItem
              index={0}
              label="Upload Resume"
              done={stepDone.resume}
              open={openStep === 0}
              onToggle={() => toggleStep(0)}
            >
              <UploadStep
                title="Upload your resume"
                description="We will use it to personalize your job matches and help autofill applications."
                endpoint="/api/upload-resume"
                answerKey="resume_upload"
                initialFile={initialFiles.resume}
                onDone={() => markStepDone('resume')}
              />
            </AccordionItem>

            {/* Step 2 — LinkedIn */}
            <AccordionItem
              index={1}
              label="LinkedIn Profile"
              done={stepDone.linkedin}
              open={openStep === 1}
              onToggle={() => toggleStep(1)}
            >
              <UploadStep
                title="Add your LinkedIn profile"
                description="Upload your LinkedIn profile as a PDF to enrich your recommendations with work history."
                endpoint="/api/upload-linkedin"
                answerKey="linkedin_pdf"
                initialFile={initialFiles.linkedin}
                onDone={() => markStepDone('linkedin')}
                onSkip={async () => {
                  await saveOnboardingAnswer('linkedin_pdf', 'skipped');
                  markStepDone('linkedin');
                }}
              />
            </AccordionItem>

            {/* Step 3 — Preferences */}
            <AccordionItem
              index={2}
              label="Job Preferences"
              done={stepDone.prefs}
              open={openStep === 2}
              onToggle={() => toggleStep(2)}
            >
              <PreferencesStep
                done={stepDone.prefs}
                onNavigate={() => router.push('/onboarding')}
              />
            </AccordionItem>
          </div>
        </div>
      )}
    </div>
  );
}
