'use client';

import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ParsingStage } from '@/components/resume-editor/ParsingProgress';
import type { TailoredResumeData } from '@/types';
import { DEFAULT_RESUME_DESIGN } from '@/types';

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
}

const ResumeGenerationContext = createContext<ResumeGenerationContextValue | null>(null);

export function useResumeGeneration(): ResumeGenerationContextValue {
  const ctx = useContext(ResumeGenerationContext);
  if (!ctx) throw new Error('useResumeGeneration must be used inside ResumeGenerationProvider');
  return ctx;
}

function applyUpdateStage(stages: ParsingStage[], stageId: string): { stages: ParsingStage[], currentStageIndex: number } {
  const idx = stages.findIndex(s => s.id === stageId);
  const updated = stages.map((stage, i) => {
    if (stage.id === stageId) return { ...stage, status: 'running' as const };
    if (i < idx && stage.status === 'running') return { ...stage, status: 'completed' as const };
    return stage;
  });
  return { stages: updated, currentStageIndex: idx !== -1 ? idx : 0 };
}

function applyCompleteStage(stages: ParsingStage[], stageId: string): ParsingStage[] {
  return stages.map(s => s.id === stageId ? { ...s, status: 'completed' as const } : s);
}

function applyAddLog(stages: ParsingStage[], stageId: string, log: string): ParsingStage[] {
  return stages.map(s => s.id === stageId ? { ...s, logs: [...s.logs, log] } : s);
}

export function ResumeGenerationProvider({ children }: { children: React.ReactNode }) {
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);
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
    setState(prev => ({
      ...prev,
      status: 'idle',
      progress: makeInitialProgress(),
      error: null,
      isModalOpen: false,
    }));
  }, []);

  const startGeneration = useCallback(async (jobDescription: string) => {
    if (generatingRef.current) return;
    generatingRef.current = true;

    const { jobId, jobTitle, linkedinProfileUrl, linkedinData } = paramsRef.current;

    setState(prev => ({
      ...prev,
      status: 'generating',
      error: null,
      progress: makeInitialProgress(),
    }));

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/generate-tailored-resume-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, jobDescription, linkedinProfileUrl, linkedinData }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

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
              setState(prev => {
                const { stages, currentStageIndex } = applyUpdateStage(prev.progress.stages, data.stageId);
                return { ...prev, progress: { ...prev.progress, stages, currentStageIndex } };
              });
            } else if (eventType === 'log') {
              setState(prev => ({
                ...prev,
                progress: { ...prev.progress, stages: applyAddLog(prev.progress.stages, data.stageId, data.log) },
              }));
            } else if (eventType === 'complete') {
              setState(prev => ({
                ...prev,
                progress: { ...prev.progress, stages: applyCompleteStage(prev.progress.stages, data.stageId) },
              }));
            } else if (eventType === 'done') {
              const parsed = data.final_resume_json;
              if (!parsed) {
                setState(prev => ({ ...prev, status: 'error', error: 'Empty resume returned from server.' }));
                generatingRef.current = false;
                continue;
              }

              let skillsFlat: string[] = [];
              let skillsRecord: Record<string, string[]> = {};
              if (Array.isArray(parsed.skills)) {
                skillsFlat = parsed.skills;
                skillsRecord = { Skills: parsed.skills };
              } else if (parsed.skills && typeof parsed.skills === 'object') {
                skillsRecord = parsed.skills as Record<string, string[]>;
                skillsFlat = Object.values(skillsRecord).flat();
              }

              const mappedSections = (parsed.sections ?? []).map((sec: any) => ({
                id: uuidv4(),
                type: sec.name.toLowerCase().replace(/[^a-z]/g, ''),
                title: sec.name,
                items: (sec.entries ?? []).map((entry: any) => ({
                  id: uuidv4(),
                  title: entry.title ?? '',
                  subtitle: entry.subtitle ?? '',
                  location: entry.location ?? '',
                  dates: entry.startDate && entry.endDate
                    ? `${entry.startDate} - ${entry.endDate}`
                    : (entry.startDate ?? entry.dates ?? ''),
                  bullets: (entry.bullets ?? []).map((b: string) => ({ id: uuidv4(), text: b })),
                })),
              }));

              if (!mappedSections.some((s: any) => s.type === 'skills')) {
                mappedSections.push({ id: uuidv4(), type: 'skills', title: 'Skills', items: [] });
              }

              const resumeData: TailoredResumeData = {
                id: uuidv4(),
                contact: {
                  name: parsed.basics?.name ?? parsed.basics?.full_name ?? '',
                  email: parsed.basics?.email ?? '',
                  phone: parsed.basics?.phone ?? '',
                  linkedin: parsed.basics?.linkedin ?? '',
                  location: parsed.basics?.location ?? '',
                  github: parsed.basics?.website
                    ? [parsed.basics.website]
                    : parsed.basics?.portfolio
                    ? [parsed.basics.portfolio]
                    : [],
                },
                summary: parsed.summary ?? '',
                sections: mappedSections,
                skills: skillsRecord,
                design: DEFAULT_RESUME_DESIGN,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                jobId,
                jobTitle,
              };

              const missingSkills: string[] = parsed.missingSkills ?? data.missingSkills ?? [];
              const autoAddedSkills: string[] = parsed.autoAddedSkills ?? data.autoAddedSkills ?? [];
              const matchedSkills = autoAddedSkills.length > 0
                ? skillsFlat.filter(s => !autoAddedSkills.includes(s))
                : skillsFlat;

              try {
                await fetch('/api/tailored-resume', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jobId,
                    resumeData,
                    keywordsData: { matched: matchedSkills, missing: missingSkills, autoAdded: autoAddedSkills },
                  }),
                });
              } catch (saveErr) {
                console.error('[ResumeGenerationContext] Auto-save failed:', saveErr);
              }

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

            } else if (eventType === 'error') {
              setState(prev => ({ ...prev, status: 'error', error: data.message ?? 'Stream error' }));
              generatingRef.current = false;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setState(prev => ({ ...prev, status: 'error', error: err.message ?? 'Failed to generate resume.' }));
      }
      generatingRef.current = false;
    }
  }, []);

  const value: ResumeGenerationContextValue = {
    ...state,
    openModal,
    startGeneration,
    sendToBackground,
    openProgressModal,
    dismissCompletion,
    cancelGeneration,
  };

  return (
    <ResumeGenerationContext.Provider value={value}>
      {children}
    </ResumeGenerationContext.Provider>
  );
}
