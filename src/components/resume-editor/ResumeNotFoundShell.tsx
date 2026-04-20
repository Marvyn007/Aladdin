import Link from 'next/link';
import styles from './ResumeNotFoundShell.module.css';

function FileDraftIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className={styles.ctaIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface ResumeNotFoundShellProps {
  jobTitle: string;
  company: string | null;
}

export function ResumeNotFoundShell({ jobTitle, company }: ResumeNotFoundShellProps) {
  const place = company && company.trim() ? company : 'Unknown';

  return (
    <div className={styles.shell} data-resume-not-found-island>
      <div className={styles.dim} aria-hidden />
      <main className={styles.card} aria-labelledby="resume-not-found-title">
        <div className={styles.iconWrap}>
          <div className={styles.icon}>
            <FileDraftIcon />
          </div>
        </div>
        <h1 id="resume-not-found-title" className={styles.title}>
          No tailored resume yet
        </h1>
        <p className={styles.lead}>
          There isn&apos;t a saved tailored resume for{' '}
          <strong>
            {jobTitle} at {place}
          </strong>
          . Generate one from the job dashboard first.
        </p>
        <p className={styles.hint}>
          Open the job, then use <strong>Parse &amp; Edit Resume</strong> (or your flow to create a tailored resume) before returning here.
        </p>
        <Link href="/" className={styles.cta}>
          <ChevronLeftIcon />
          Return to dashboard
        </Link>
      </main>
    </div>
  );
}
