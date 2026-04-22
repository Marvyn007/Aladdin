'use client';

import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { ParsingStage } from '@/components/resume-editor/ParsingProgress';
import type { TailoredResumeBundleV2, TailoredResumeData } from '@/types';
import { toEditorFormat } from '@/lib/resume-generation/toEditorFormat';
import { applyOnePageDesignFromFull, buildTailoredResumeSavePayload } from '@/lib/tailored-resume-bundle';
import { useSubscription } from '@/hooks/useSubscription';
import type { UsageFeature } from '@/lib/subscription/tier-config';
import { announcePriorityModalOpening } from '@/lib/priority-modal';

export interface GateBlock {
  reason: 'UNAUTHORIZED' | 'LIMIT_REACHED';
  feature: UsageFeature;
  resetDate: string | null;
}

export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

interface ProgressState {
  stages: ParsingStage[];
  currentStageIndex: number;
  isComplete: boolean;
}

const INITIAL_STAGES: ParsingStage[] = [
  { id: 'stage1_resume-load', title: 'Loading Resume', description: 'Downloading and extracting text from your PDF resume', logs: ['Initializing...'], status: 'pending' },
  { id: 'stage2_resume-parse', title: 'Parsing Resume', description: 'Converting resume to structured JSON format', logs: [], status: 'pending' },
  { id: 'stage3_linkedin-parse', title: 'Parsing LinkedIn', description: 'Extracting information from LinkedIn profile (optional)', logs: [], status: 'pending' },
  { id: 'stage4_master-merge', title: 'Building Master Profile', description: 'Combining resume and LinkedIn data', logs: [], status: 'pending' },
  { id: 'stage5_jd-parse', title: 'Analyzing Job Description', description: 'Extracting requirements and matching against Master Profile', logs: [], status: 'pending' },
  { id: 'stage6_tailor', title: 'Generating Tailored Resume', description: 'Rewriting bullets and optimizing for ATS', logs: [], status: 'pending' },
  { id: 'stage7_export', title: 'Finalizing Resume', description: 'Applying design template and styles', logs: [], status: 'pending' },
];

function makeInitialProgress(): ProgressState {
  return {
    stages: INITIAL_STAGES.map(s => ({ ...s, logs: s.id === 'stage1_resume-load' ? ['Initializing...'] : [], status: 'pending' as const })),
    currentStageIndex: 0,
    isComplete: false,
  };
}

export interface ModalParams {
  jobId: string;
  jobTitle: string;
  company: string | null;
  jobDescription: string;
  jobUrl?: string;
  linkedinProfileUrl?: string;
  linkedinData?: string;
}

interface ResumeGenerationState {
  status: GenerationStatus;
  jobId: string | null;
  jobTitle: string | null;
  company: string | null;
  jobUrl: string | null;
  initialJobDescription: string;
  linkedinProfileUrl: string | null;
  linkedinData: string | null;
  progress: ProgressState;
  error: string | null;
  isModalOpen: boolean;
}

export interface ResumeGenerationContextValue extends ResumeGenerationState {
  openModal(params: ModalParams): void;
  startGeneration(jobDescription: string): void;
  sendToBackground(): void;
  openProgressModal(): void;
  dismissCompletion(): void;
  cancelGeneration(): void;
  blockedBy: GateBlock | null;
  clearBlockedBy(): void;
}

const ResumeGenerationContext = createContext<ResumeGenerationContextValue | null>(null);

export function useResumeGeneration(): ResumeGenerationContextValue {
  const ctx = useContext(ResumeGenerationContext);
  if (!ctx) throw new Error('useResumeGeneration must be used inside ResumeGenerationProvider');
  return ctx;
}

function applyUpdateStage(stages: ParsingStage[], stageId: string): { stages: ParsingStage[], currentStageIndex: number, found: boolean } {
  const idx = stages.findIndex(s => s.id === stageId);
  if (idx === -1) {
    // If unknown stage, just keep current index but maybe add log to current stage?
    return { stages, currentStageIndex: -1, found: false };
  }

  const updated = stages.map((stage, i) => {
    if (i === idx) return { ...stage, status: 'running' as const };
    if (i < idx) return { ...stage, status: 'completed' as const };
    return stage;
  });
  return { stages: updated, currentStageIndex: idx, found: true };
}

function applyCompleteStage(
  stages: ParsingStage[],
  stageId: string,
  prevCurrentStageIndex: number
): { stages: ParsingStage[]; currentStageIndex: number; found: boolean } {
  const idx = stages.findIndex(s => s.id === stageId);
  if (idx === -1) {
    return { stages, currentStageIndex: prevCurrentStageIndex, found: false };
  }

  // Completion means this stage has truly finished on the backend.
  // Mark all prior stages completed as well so the UI never lags behind.
  const updated = stages.map((stage, i) => {
    if (i <= idx) return { ...stage, status: 'completed' as const };
    return stage;
  });

  const isLastStage = idx === updated.length - 1;
  const nextIndex = isLastStage ? updated.length : Math.max(prevCurrentStageIndex, idx + 1);
  return { stages: updated, currentStageIndex: nextIndex, found: true };
}

function applyAddLog(stages: ParsingStage[], stageId: string, log: string): ParsingStage[] {
  return stages.map(s => s.id === stageId ? { ...s, logs: [...s.logs, log] } : s);
}

function applyOptimisticAdvance(
  stages: ParsingStage[],
  currentStageIndex: number
): { stages: ParsingStage[]; currentStageIndex: number } {
  const safeCurrent = Math.max(0, Math.min(currentStageIndex, stages.length - 1));
  const nextIndex = Math.min(safeCurrent + 1, stages.length - 1);
  if (nextIndex === safeCurrent) return { stages, currentStageIndex };

  const updated = stages.map((stage, i) => {
    if (i < nextIndex) return { ...stage, status: 'completed' as const };
    if (i === nextIndex) return { ...stage, status: 'running' as const };
    return stage;
  });
  return { stages: updated, currentStageIndex: nextIndex };
}

export function ResumeGenerationProvider({ children }: { children: React.ReactNode }) {
  const sub = useSubscription();
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);
  const lastProgressTickRef = useRef<number>(0);
  const [blockedBy, setBlockedBy] = useState<GateBlock | null>(null);
  const clearBlockedBy = useCallback(() => setBlockedBy(null), []);
  const paramsRef = useRef<{
    jobId: string;
    jobTitle: string;
    linkedinProfileUrl: string | null;
    linkedinData: string | null;
  }>({ jobId: '', jobTitle: '', linkedinProfileUrl: null, linkedinData: null });

  const [state, setState] = useState<ResumeGenerationState>({
    status: 'idle',
    jobId: null,
    jobTitle: null,
    company: null,
    jobUrl: null,
    initialJobDescription: '',
    linkedinProfileUrl: null,
    linkedinData: null,
    progress: makeInitialProgress(),
    error: null,
    isModalOpen: false,
  });

  const openModal = useCallback((params: ModalParams) => {
    paramsRef.current = {
      jobId: params.jobId,
      jobTitle: params.jobTitle,
      linkedinProfileUrl: params.linkedinProfileUrl ?? null,
      linkedinData: params.linkedinData ?? null,
    };
    setState(prev => {
      const shouldReset = prev.status === 'idle';
      return {
        ...prev,
        jobId: params.jobId,
        jobTitle: params.jobTitle,
        company: params.company,
        jobUrl: params.jobUrl ?? null,
        initialJobDescription: params.jobDescription,
        linkedinProfileUrl: params.linkedinProfileUrl ?? null,
        linkedinData: params.linkedinData ?? null,
        isModalOpen: true,
        ...(shouldReset ? { error: null, progress: makeInitialProgress() } : {}),
      };
    });
  }, []);

  const sendToBackground = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: false }));
  }, []);

  const openProgressModal = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: true }));
  }, []);

  const dismissCompletion = useCallback(() => {
    generatingRef.current = false;
    setState({
      status: 'idle',
      jobId: null,
      jobTitle: null,
      company: null,
      jobUrl: null,
      initialJobDescription: '',
      linkedinProfileUrl: null,
      linkedinData: null,
      progress: makeInitialProgress(),
      error: null,
      isModalOpen: false,
    });
  }, []);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    generatingRef.current = false;
    lastProgressTickRef.current = 0;
    setState(prev => ({
      ...prev,
      status: 'idle',
      progress: makeInitialProgress(),
      error: null,
      isModalOpen: false,
    }));
  }, []);

  const blockWithPriorityModal = useCallback((block: GateBlock) => {
    announcePriorityModalOpening();
    abortRef.current?.abort();
    abortRef.current = null;
    generatingRef.current = false;
    lastProgressTickRef.current = 0;
    setState(prev => ({
      ...prev,
      status: 'idle',
      progress: makeInitialProgress(),
      error: null,
      isModalOpen: false,
    }));
    setBlockedBy(block);
  }, []);

  // UX fallback: if early stages appear stuck with no backend events for ~9s, move one step forward.
  // This does not change backend logic; it only prevents the UI from feeling frozen.
  useEffect(() => {
    if (state.status !== 'generating') return;
    const STALL_MS = 9000;
    const EARLY_STAGE_MAX_INDEX = 4; // stages 1..5 only

    const timer = setInterval(() => {
      const now = Date.now();
      if (!lastProgressTickRef.current) {
        lastProgressTickRef.current = now;
        return;
      }

      const stalledFor = now - lastProgressTickRef.current;
      if (stalledFor < STALL_MS) return;

      setState(prev => {
        if (prev.status !== 'generating') return prev;
        if (prev.progress.currentStageIndex >= EARLY_STAGE_MAX_INDEX) return prev;
        const advanced = applyOptimisticAdvance(prev.progress.stages, prev.progress.currentStageIndex);
        return { ...prev, progress: { ...prev.progress, ...advanced } };
      });

      lastProgressTickRef.current = now;
    }, 1000);

    return () => clearInterval(timer);
  }, [state.status]);

  const startGeneration = useCallback(async (jobDescription: string) => {
    if (!sub.isLoading && sub.planType === 'LITE') {
      blockWithPriorityModal({ reason: 'UNAUTHORIZED', feature: 'resumesGenerated', resetDate: null });
      return;
    }
    if (!sub.isLoading && sub.usage.resumesGenerated >= sub.limits.resumesGenerated) {
      blockWithPriorityModal({ reason: 'LIMIT_REACHED', feature: 'resumesGenerated', resetDate: sub.currentPeriodEnd });
      return;
    }
    if (generatingRef.current) return;
    generatingRef.current = true;

    const { jobId, jobTitle, linkedinProfileUrl, linkedinData } = paramsRef.current;

    setState(prev => ({
      ...prev,
      status: 'generating',
      error: null,
      progress: makeInitialProgress(),
    }));
    lastProgressTickRef.current = Date.now();

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/generate-tailored-resume-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, jobDescription, linkedinProfileUrl, linkedinData }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 403) {
          const body = await response.json().catch(() => ({})) as { error?: string; resetDate?: string };
          blockWithPriorityModal({
            reason: body.error === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'LIMIT_REACHED',
            feature: 'resumesGenerated',
            resetDate: body.resetDate ?? null,
          });
          return;
        }
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to read response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { currentEvent = 'message'; continue; }
          if (trimmed.startsWith('event: ')) { currentEvent = trimmed.slice(7).trim(); continue; }

          if (trimmed.startsWith('data: ')) {
            let data: any;
            try {
              data = JSON.parse(trimmed.slice(6));
            } catch {
              console.error('[ResumeGenerationContext] Failed to parse SSE data:', trimmed);
              continue;
            }

            const eventType = currentEvent;

            if (eventType === 'stage') {
              lastProgressTickRef.current = Date.now();
              flushSync(() => {
                setState(prev => {
                  const { stages, currentStageIndex, found } = applyUpdateStage(prev.progress.stages, data.stageId);
                  if (!found) return prev; // Ignore unknown stages to prevent jumping back to step 1
                  return { ...prev, progress: { ...prev.progress, stages, currentStageIndex } };
                });
              });
            } else if (eventType === 'log') {
              lastProgressTickRef.current = Date.now();
              setState(prev => ({
                ...prev,
                progress: { ...prev.progress, stages: applyAddLog(prev.progress.stages, data.stageId, data.log) },
              }));
            } else if (eventType === 'complete') {
              lastProgressTickRef.current = Date.now();
              flushSync(() => {
                setState(prev => ({
                  ...prev,
                  progress: (() => {
                    const { stages, currentStageIndex, found } = applyCompleteStage(
                      prev.progress.stages,
                      data.stageId,
                      prev.progress.currentStageIndex
                    );
                    if (!found) return prev.progress;
                    return { ...prev.progress, stages, currentStageIndex };
                  })(),
                }));
              });
            } else if (eventType === 'done') {
              lastProgressTickRef.current = Date.now();
              const parsed = data.final_resume_json;
              if (!parsed) {
                setState(prev => ({ ...prev, status: 'error', error: 'Empty resume returned from server.' }));
                generatingRef.current = false;
                lastProgressTickRef.current = 0;
                continue;
              }

              let skillsFlat: string[] = [];
              if (Array.isArray(parsed.skills)) {
                skillsFlat = parsed.skills as string[];
              } else if (parsed.skills && typeof parsed.skills === 'object') {
                skillsFlat = Object.values(parsed.skills as Record<string, string[]>).flat();
              }

              const resumeData: TailoredResumeData = {
                ...toEditorFormat(parsed, { jobId: jobId ?? undefined, jobTitle: jobTitle ?? undefined }),
                jobId,
                jobTitle,
              };

              const oneParsed = data.final_resume_json_one_page as typeof parsed | undefined;
              let resumePayload: TailoredResumeData | TailoredResumeBundleV2 = resumeData;
              if (oneParsed) {
                const onePageResume: TailoredResumeData = {
                  ...toEditorFormat(oneParsed, { jobId: jobId ?? undefined, jobTitle: jobTitle ?? undefined }),
                  jobId,
                  jobTitle,
                  design: applyOnePageDesignFromFull(resumeData.design),
                };
                resumePayload = buildTailoredResumeSavePayload(resumeData, onePageResume);
              }

              const missingSkills: string[] = parsed.missingSkills ?? data.missingSkills ?? [];
              const autoAddedSkills: string[] = parsed.autoAddedSkills ?? data.autoAddedSkills ?? [];
              const matchedSkills = autoAddedSkills.length > 0
                ? skillsFlat.filter(s => !autoAddedSkills.includes(s))
                : skillsFlat;

              const atsScoreData = data.ats ? {
                raw: data.ats.keyword_coverage ?? 0,
                weighted: data.ats.keyword_coverage ?? 0,
                matchedCount: data.ats.matched_keywords?.length ?? 0,
                totalCount: (data.ats.matched_keywords?.length ?? 0) + (data.ats.missing_keywords?.length ?? 0),
                skillsMatch: data.ats.skills_match ?? data.ats.keyword_coverage ?? 0,
                formattingCheck: true
              } : undefined;

              const honeypotData = data.honeypot ?? null;

              setState(prev => ({
                ...prev,
                status: 'complete',
                progress: {
                  stages: prev.progress.stages.map(s => ({ ...s, status: 'completed' as const })),
                  currentStageIndex: prev.progress.stages.length,
                  isComplete: true,
                },
              }));
              generatingRef.current = false;
              lastProgressTickRef.current = 0;

            } else if (eventType === 'error') {
              setState(prev => ({ ...prev, status: 'error', error: data.message ?? 'Stream error' }));
              generatingRef.current = false;
              lastProgressTickRef.current = 0;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setState(prev => ({ ...prev, status: 'error', error: err.message ?? 'Failed to generate resume.' }));
      }
      generatingRef.current = false;
      lastProgressTickRef.current = 0;
    }
  }, [blockWithPriorityModal, sub]);

  const value: ResumeGenerationContextValue = {
    ...state,
    openModal,
    startGeneration,
    sendToBackground,
    openProgressModal,
    dismissCompletion,
    cancelGeneration,
    blockedBy,
    clearBlockedBy,
  };

  return (
    <ResumeGenerationContext.Provider value={value}>
      {children}
    </ResumeGenerationContext.Provider>
  );
}
