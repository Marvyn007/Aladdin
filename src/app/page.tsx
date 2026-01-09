// Main dashboard page - Integrated Jobs + Tracker views with Sidebar

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { JobList } from '@/components/layout/JobList';
import { JobDetail } from '@/components/layout/JobDetail';
import { CoverLetterModal } from '@/components/modals/CoverLetterModal';
import { CoverLetterSetupModal } from '@/components/modals/CoverLetterSetupModal';
import { TailoredResumeEditor } from '@/components/resume-editor/TailoredResumeEditor';
import { ResumeSelector } from '@/components/modals/ResumeSelector';
import { LinkedInSelector } from '@/components/modals/LinkedInSelector';
import { ImportJobModal } from '@/components/modals/ImportJobModal';
import { useStore } from '@/store/useStore';
import type { Job, Application, ApplicationColumn } from '@/types';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLUMNS: ApplicationColumn[] = [
  'Applied',
  'Got OA',
  'Interview R1',
  'Interview R2',
  'Interview R3',
  'Interview R4',
  'Got Offer',
];

interface ApplicationWithJob extends Application {
  job?: Job;
}

// Draggable job card component for Kanban
function DraggableJobCard({
  application,
  onDelete,
}: {
  application: ApplicationWithJob;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        padding: '12px',
        marginBottom: '8px',
        cursor: 'grab',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
      className="card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {application.job?.company || 'Unknown Company'}
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {application.job?.title || 'Unknown Position'}
          </p>
          {application.job?.location && (
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {application.job.location}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(application.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            padding: '4px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--error)'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
      {application.job?.source_url && (
        <a
          href={application.job.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          View Job
        </a>
      )}
    </div>
  );
}

// Droppable Kanban column component
function DroppableColumn({
  column,
  applications,
  onDelete,
}: {
  column: ApplicationColumn;
  applications: ApplicationWithJob[];
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column,
  });

  const columnApps = applications.filter((app) => app.column_name === column);

  return (
    <div
      style={{
        flex: 1,
        minWidth: '180px',
        maxWidth: '220px',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--background-secondary)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: isOver ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'border-color 0.2s',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {column}
        </h3>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            padding: '2px 6px',
            background: 'var(--surface)',
            borderRadius: '999px',
            color: 'var(--text-secondary)',
          }}
        >
          {columnApps.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          padding: '10px',
          overflowY: 'auto',
          minHeight: '150px',
          background: isOver ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent',
        }}
      >
        <SortableContext
          items={columnApps.map((app) => app.id)}
          strategy={verticalListSortingStrategy}
        >
          {columnApps.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '80px',
                color: isOver ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '11px',
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              Drop here
            </div>
          ) : (
            columnApps.map((app) => (
              <DraggableJobCard
                key={app.id}
                application={app}
                onDelete={onDelete}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export default function Home() {
  const {
    jobs,
    setJobs,
    selectedJob,
    setSelectedJob,
    isLoadingJobs,
    setIsLoadingJobs,
    setLastUpdated,
    freshLimit,
    activeModal,
    setActiveModal,
  } = useStore();

  const [activeView, setActiveView] = useState<'jobs' | 'tracker'>('jobs');
  const [applicationStatus, setApplicationStatus] = useState<Record<string, 'none' | 'applied' | 'loading'>>({});
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);

  // Mobile responsive state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileJobDetailVisible, setIsMobileJobDetailVisible] = useState(false);

  const [coverLetterSetupModal, setCoverLetterSetupModal] = useState<{
    isOpen: boolean;
    jobId: string | null;
    jobTitle: string;
    company: string | null;
    jobUrl: string | null;
    initialDescription: string;
  }>({
    isOpen: false,
    jobId: null,
    jobTitle: '',
    company: null,
    jobUrl: null,
    initialDescription: '',
  });

  const [coverLetterModal, setCoverLetterModal] = useState<{
    isOpen: boolean;
    jobId: string | null;
    coverLetterId: string | undefined;
    html: string;
    text: string;
    highlights: string[];
    jobTitle: string;
    company: string | null;
    error: string | null;
    isGenerating: boolean;
  }>({
    isOpen: false,
    jobId: null,
    coverLetterId: undefined,
    html: '',
    text: '',
    highlights: [],
    jobTitle: '',
    company: null,
    error: null,
    isGenerating: false,
  });

  const [tailoredResumeModal, setTailoredResumeModal] = useState<{
    isOpen: boolean;
    jobId: string | null;
    jobTitle: string;
    company: string | null;
    jobDescription: string;
    jobUrl: string | null;
  }>({
    isOpen: false,
    jobId: null,
    jobTitle: '',
    company: null,
    jobDescription: '',
    jobUrl: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  useEffect(() => {
    loadJobs(false);
    loadApplications();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadJobs = async (rescore: boolean = false) => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch(`/api/find-fresh?limit=${freshLimit}&rescore=${rescore}`);
      const data = await res.json();
      setJobs(data.jobs || []);
      setLastUpdated(data.lastUpdated);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const loadApplications = async () => {
    try {
      const res = await fetch('/api/application');
      const data = await res.json();
      const statusMap: Record<string, 'none' | 'applied' | 'loading'> = {};

      const appsWithJobs = await Promise.all(
        (data.applications || []).map(async (app: Application) => {
          statusMap[app.job_id] = 'applied';
          try {
            const jobRes = await fetch(`/api/job/${app.job_id}`);
            const jobData = await jobRes.json();
            return { ...app, job: jobData.job };
          } catch {
            return app;
          }
        })
      );

      setApplicationStatus(statusMap);
      setApplications(appsWithJobs);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };



  const handleFindNow = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      await fetch('/api/run-finder', { method: 'POST' });
      loadJobs(true);
    } catch (e) {
      console.error('Find now failed:', e);
      setIsLoadingJobs(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshLimit]);

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    // Show job detail on mobile when a job is selected
    setIsMobileJobDetailVisible(true);
  };

  // Handle mobile back from job detail
  const handleMobileBack = () => {
    setIsMobileJobDetailVisible(false);
  };

  // Close mobile sidebar
  const handleCloseMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };





  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this job? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/job/${jobId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setJobs(jobs.filter(j => j.id !== jobId));
        if (selectedJob?.id === jobId) setSelectedJob(null);
      } else {
        const data = await res.json();
        alert(`Failed to delete job: ${data.error}`);
      }
    } catch (e) {
      console.error('Delete failed', e);
      alert('Delete failed');
    }
  };

  const handleApply = async (jobId: string) => {
    if (applicationStatus[jobId] === 'applied') return;

    setApplicationStatus(prev => ({ ...prev, [jobId]: 'loading' }));

    try {
      const res = await fetch('/api/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      });

      if (res.ok) {
        setApplicationStatus(prev => ({ ...prev, [jobId]: 'applied' }));
        // Remove from fresh jobs
        setJobs(jobs.filter(j => j.id !== jobId));
        if (selectedJob?.id === jobId) setSelectedJob(null);
        loadApplications();
      } else {
        setApplicationStatus(prev => ({ ...prev, [jobId]: 'none' }));
        const data = await res.json();
        if (data.error !== 'Application already exists for this job') {
          alert(data.error || 'Failed to mark as applied');
        } else {
          setApplicationStatus(prev => ({ ...prev, [jobId]: 'applied' }));
        }
      }
    } catch (error) {
      console.error('Error applying:', error);
      setApplicationStatus(prev => ({ ...prev, [jobId]: 'none' }));
    }
  };



  const handleGenerateCoverLetter = async (jobId: string, queue: boolean = false) => {
    const job = jobs.find(j => j.id === jobId) || (selectedJob?.id === jobId ? selectedJob : null);
    if (!job) return;

    if (queue) {
      // Queue immediately (skip setup for now, or use defaults)
      handleConfirmGenerateCoverLetter(jobId, '', true);
    } else {
      // Open Setup Modal
      setCoverLetterSetupModal({
        isOpen: true,
        jobId,
        jobTitle: job.title,
        company: job.company,
        jobUrl: job.source_url,
        initialDescription: job.raw_text_summary || job.normalized_text || ''
      });
    }
  };

  const handleConfirmGenerateCoverLetter = async (jobId: string, jobDescription: string, queue: boolean = false) => {
    // Close setup modal
    setCoverLetterSetupModal(prev => ({ ...prev, isOpen: false }));

    const job = jobs.find(j => j.id === jobId) || (selectedJob?.id === jobId ? selectedJob : null);

    // Update state to show modal immediately with loading state
    setCoverLetterModal(prev => ({
      ...prev,
      isOpen: true,
      jobId,
      isGenerating: true,
      error: null,
      html: queue ? prev.html : (prev.jobId === jobId ? prev.html : ''),
      text: queue ? prev.text : (prev.jobId === jobId ? prev.text : ''),
      jobTitle: job?.title || prev.jobTitle,
      company: job?.company || prev.company,
    }));

    try {
      const res = await fetch('/api/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          queue,
          job_description: jobDescription
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (queue) {
          setCoverLetterModal(prev => ({
            ...prev,
            isOpen: false,
            isGenerating: false,
          }));
          alert("Cover letter generation queued successfully.");
        } else {
          setCoverLetterModal(prev => ({
            ...prev,
            isOpen: true,
            isGenerating: false,
            html: data.coverLetter.content_html || '',
            text: data.coverLetter.content_text || '',
            highlights: data.coverLetter.highlights || [],
            coverLetterId: data.coverLetter.id,
            error: null,
          }));
        }
      } else {
        // Handle Error
        const errorMsg = data.error || 'Failed to generate cover letter';
        setCoverLetterModal(prev => ({
          ...prev,
          isOpen: true,
          isGenerating: false,
          error: errorMsg,
        }));
      }
    } catch (error) {
      console.error('Error generating cover letter:', error);
      setCoverLetterModal(prev => ({
        ...prev,
        isOpen: true,
        isGenerating: false,
        error: 'Failed to communicate with server. Please try again.',
      }));
    }
  };



  const handleGenerateTailoredResume = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId) || (selectedJob?.id === jobId ? selectedJob : null);

    if (!job) return;

    setTailoredResumeModal({
      isOpen: true,
      jobId,
      jobTitle: job.title,
      company: job.company,
      jobDescription: job.raw_text_summary || job.normalized_text || '',
      jobUrl: job.source_url || null,
    });
  };

  // Kanban drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeApp = applications.find((app) => app.id === active.id);
    if (!activeApp) return;

    // Determine target column
    let newColumn: ApplicationColumn | null = null;

    // Check if dropped on a column directly
    if (COLUMNS.includes(over.id as ApplicationColumn)) {
      newColumn = over.id as ApplicationColumn;
    } else {
      // Dropped on another card - find that card's column
      const overApp = applications.find((app) => app.id === over.id);
      if (overApp) {
        newColumn = overApp.column_name;
      }
    }

    if (!newColumn || activeApp.column_name === newColumn) return;

    // Optimistically update UI
    setApplications((prev) =>
      prev.map((app) =>
        app.id === active.id ? { ...app, column_name: newColumn! } : app
      )
    );

    // Update in database
    try {
      await fetch('/api/application', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: active.id,
          column_name: newColumn,
        }),
      });
    } catch (error) {
      console.error('Error updating application:', error);
      loadApplications();
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;

    setApplications((prev) => prev.filter((app) => app.id !== applicationId));

    try {
      await fetch(`/api/application?id=${applicationId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting application:', error);
      loadApplications();
    }
  };

  const [isScoring, setIsScoring] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleScoreJobs = async () => {
    setIsScoring(true);
    try {
      const res = await fetch('/api/run-scoring', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        loadJobs(false);
      } else {
        alert('Scoring failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Scoring error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsScoring(false);
    }
  };

  const handleSmartCleanup = async () => {
    if (!confirm('Run Smart Cleanup? This will use AI to analyze all fresh jobs and DELETE strictly invalid ones (Senior, Clearance, etc.). This may take a minute.')) return;

    setIsCleaning(true);
    try {
      const res = await fetch('/api/run-ai-cleanup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Cleanup complete!\nAnalyzed: ${data.stats.analyzed}\nDeleted: ${data.stats.deleted}`);
        loadJobs(false);
      } else {
        alert('Cleanup failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Cleanup error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsCleaning(false);
    }
  };

  const activeApplication = activeId
    ? applications.find((app) => app.id === activeId)
    : null;

  return (
    <div className="app-container">
      {/* Left sidebar */}
      <Sidebar
        onFindNow={handleFindNow}
        isLoading={isLoadingJobs}
        onScoreJobs={handleScoreJobs}
        onImportJob={() => setActiveModal('import-job')}
        onCleanup={handleSmartCleanup}
        isScoring={isScoring}
        isCleaning={isCleaning}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={handleCloseMobileSidebar}
      />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Mobile Header */}
        <div className="mobile-header">
          <button
            className="hamburger-btn"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="mobile-header-title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aladdin-logo.png" alt="Aladdin" className="mobile-header-logo" />
            <span>Aladdin</span>
          </div>
          <div style={{ width: 44 }}>{/* Spacer for centering */}</div>
        </div>

        {/* View Toggle Tabs */}
        <div className="view-tabs">
          <button
            onClick={() => setActiveView('jobs')}
            className={`view-tab ${activeView === 'jobs' ? 'active' : ''}`}
          >
            Job Listings
          </button>
          <button
            onClick={() => setActiveView('tracker')}
            className={`view-tab ${activeView === 'tracker' ? 'active' : ''}`}
          >
            Application Tracker ({applications.length})
          </button>
        </div>

        {/* Content based on active view */}
        {activeView === 'jobs' && (
          <div className="content-area">
            <JobList onJobClick={handleJobClick} />
            <JobDetail
              job={selectedJob}
              onApply={handleApply}
              onDelete={handleDeleteJob}
              onGenerateCoverLetter={handleGenerateCoverLetter}
              onGenerateTailoredResume={handleGenerateTailoredResume}
              applicationStatus={selectedJob ? (applicationStatus[selectedJob.id] || 'none') : 'none'}
              isMobileVisible={isMobileJobDetailVisible}
              onBack={handleMobileBack}
            />
          </div>
        )}

        {activeView === 'tracker' && (
          <div className="tracker-container">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="kanban-columns">
                {COLUMNS.map((column) => (
                  <DroppableColumn
                    key={column}
                    column={column}
                    applications={applications}
                    onDelete={handleDeleteApplication}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeApplication && (
                  <div
                    className="card"
                    style={{
                      padding: '12px',
                      background: 'var(--surface)',
                      border: '2px solid var(--accent)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      cursor: 'grabbing',
                      width: '200px',
                    }}
                  >
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                      {activeApplication.job?.company || 'Unknown Company'}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {activeApplication.job?.title || 'Unknown Position'}
                    </p>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        )}


      </div>

      {/* Cover Letter Setup Modal */}
      <CoverLetterSetupModal
        isOpen={coverLetterSetupModal.isOpen}
        onClose={() => setCoverLetterSetupModal(prev => ({ ...prev, isOpen: false }))}
        onGenerate={(description) => handleConfirmGenerateCoverLetter(coverLetterSetupModal.jobId!, description)}
        jobTitle={coverLetterSetupModal.jobTitle}
        company={coverLetterSetupModal.company}
        jobUrl={coverLetterSetupModal.jobUrl}
        initialDescription={coverLetterSetupModal.initialDescription}
      />



      {/* Cover Letter Modal */}
      <CoverLetterModal
        isOpen={coverLetterModal.isOpen}
        onClose={() => setCoverLetterModal(prev => ({ ...prev, isOpen: false }))}
        coverLetterHtml={coverLetterModal.html}
        coverLetterText={coverLetterModal.text}

        jobTitle={coverLetterModal.jobTitle}
        company={coverLetterModal.company}

        // New Props
        coverLetterId={coverLetterModal.coverLetterId}
        error={coverLetterModal.error}
        isGenerating={coverLetterModal.isGenerating}
        onRegenerate={() => handleConfirmGenerateCoverLetter(coverLetterModal.jobId!, coverLetterSetupModal.initialDescription || '')} // Retry with same desc
        onQueue={() => activeId && handleGenerateCoverLetter(activeId, true)} // Queue logic remains same? No, queue skips setup? 
      // For queue, we might want to skip setup or just use empty desc. 
      // Let's keep queue simple for now.
      />

      {/* Import Job Modal */}
      {activeModal === 'import-job' && (
        <ImportJobModal onClose={() => setActiveModal(null)} />
      )}

      {/* Tailored Resume Editor */}
      <TailoredResumeEditor
        isOpen={tailoredResumeModal.isOpen}
        onClose={() => setTailoredResumeModal(prev => ({ ...prev, isOpen: false }))}
        jobId={tailoredResumeModal.jobId || ''}
        jobTitle={tailoredResumeModal.jobTitle}
        company={tailoredResumeModal.company}
        jobDescription={tailoredResumeModal.jobDescription}
        jobUrl={tailoredResumeModal.jobUrl || undefined}
      />

      {/* Resume Selector Modal */}
      {activeModal === 'resume-selector' && (
        <ResumeSelector onClose={() => setActiveModal(null)} />
      )}

      {/* LinkedIn Selector Modal */}
      {activeModal === 'linkedin-selector' && (
        <LinkedInSelector onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
