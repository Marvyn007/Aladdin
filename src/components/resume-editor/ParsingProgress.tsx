'use client';

import { useState, useEffect, useRef } from 'react';

export interface ParsingStage {
    id: string;
    title: string;
    description: string;
    logs: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
}

interface ParsingProgressProps {
    stages: ParsingStage[];
    currentStageIndex: number;
    onCancel?: () => void;
}

export function ParsingProgress({ stages, currentStageIndex, onCancel }: ParsingProgressProps) {
    const [animatedStages, setAnimatedStages] = useState<number>(0);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentStageIndex > animatedStages) {
            const timer = setTimeout(() => {
                setAnimatedStages(currentStageIndex);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [currentStageIndex, animatedStages]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [stages]);

    return (
        <div style={{
            padding: '24px',
            background: 'var(--surface)',
            borderRadius: '12px',
            maxWidth: '500px',
            margin: '0 auto',
        }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Parsing Resume
                </h3>
                {onCancel && (
                    <button onClick={onCancel} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }}>
                        Cancel
                    </button>
                )}
            </div>

            <div style={{ position: 'relative', paddingLeft: '32px' }}>
                {stages.map((stage, index) => (
                    <StageItem
                        key={stage.id}
                        stage={stage}
                        index={index}
                        isActive={index === currentStageIndex}
                        isCompleted={index < animatedStages}
                        isAnimating={index === animatedStages && index < currentStageIndex}
                        hasNext={index < stages.length - 1}
                    />
                ))}
            </div>

            {currentStageIndex < stages.length && stages[currentStageIndex] && (
                <div ref={logsEndRef} style={{
                    marginTop: '20px',
                    padding: '12px',
                    background: 'var(--background)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    color: 'var(--text-secondary)',
                }}>
                    {stages[currentStageIndex].logs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '4px', opacity: 0.8 }}>
                            {i === stages[currentStageIndex].logs.length - 1 ? (
                                <span>
                                    <span style={{ color: 'var(--accent)', marginRight: '8px' }}>›</span>
                                    {log}
                                </span>
                            ) : (
                                <span style={{ color: 'var(--text-tertiary)', marginLeft: '20px' }}>{log}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface StageItemProps {
    stage: ParsingStage;
    index: number;
    isActive: boolean;
    isCompleted: boolean;
    isAnimating: boolean;
    hasNext: boolean;
}

function StageItem({ stage, index, isActive, isCompleted, isAnimating, hasNext }: StageItemProps) {
    const [dotPosition, setDotPosition] = useState(0);

    useEffect(() => {
        if (isAnimating) {
            const interval = setInterval(() => {
                setDotPosition(prev => (prev + 1) % 4);
            }, 300);
            return () => clearInterval(interval);
        }
    }, [isAnimating]);

    return (
        <div style={{ position: 'relative', marginBottom: hasNext ? '0' : '0' }}>
            <div style={{
                position: 'absolute',
                left: '-32px',
                top: '0',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {isCompleted ? (
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#22c55e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                ) : isActive ? (
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        border: '2px solid var(--accent)',
                        background: isAnimating ? 'var(--accent)' : 'transparent',
                        animation: isAnimating ? 'pulse 1s infinite' : 'none',
                    }}>
                        {isAnimating && (
                            <div style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: 'white',
                                margin: '2px',
                            }}>
                                <DotLoader dots={dotPosition} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        border: '2px solid var(--border)',
                        background: 'transparent',
                    }} />
                )}
            </div>

            {hasNext && (
                <div style={{
                    position: 'absolute',
                    left: '-26px',
                    top: '20px',
                    width: '2px',
                    height: 'calc(100% + 20px)',
                    background: isCompleted ? '#22c55e' : 'var(--border)',
                    transition: 'background 0.5s ease',
                }}>
                    {isAnimating && (
                        <div style={{
                            width: '100%',
                            height: '20px',
                            background: 'var(--accent)',
                            animation: 'lineFlow 0.8s ease forwards',
                        }} />
                    )}
                </div>
            )}

            <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: isActive ? 'var(--background)' : 'transparent',
                transition: 'background 0.3s ease',
                marginBottom: hasNext ? '24px' : '0',
            }}>
                <div style={{
                    fontSize: '14px',
                    fontWeight: isActive || isCompleted ? 600 : 400,
                    color: isCompleted ? '#22c55e' : isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    marginBottom: '4px',
                }}>
                    {stage.title}
                </div>
                <div style={{
                    fontSize: '13px',
                    color: isActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                }}>
                    {stage.description}
                </div>
            </div>
        </div>
    );
}

function DotLoader({ dots }: { dots: number }) {
    const positions = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
    ];
    const pos = positions[dots];
    
    return (
        <div style={{
            position: 'relative',
            width: '4px',
            height: '4px',
        }}>
            <div style={{
                position: 'absolute',
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                background: 'white',
                left: `${pos.x * 1}px`,
                top: `${pos.y * 1}px`,
                transition: 'all 0.15s ease',
            }} />
        </div>
    );
}

export function useParsingProgress() {
    const [stages, setStages] = useState<ParsingStage[]>([
        {
            id: 'stage1_resume-load',
            title: 'Loading Resume',
            description: 'Downloading and extracting text from your PDF resume',
            logs: ['Initializing...'],
            status: 'pending',
        },
        {
            id: 'stage2_resume-parse',
            title: 'Parsing Resume',
            description: 'Converting resume to structured JSON format',
            logs: [],
            status: 'pending',
        },
        {
            id: 'stage3_linkedin-parse',
            title: 'Parsing LinkedIn',
            description: 'Extracting information from LinkedIn profile (optional)',
            logs: [],
            status: 'pending',
        },
        {
            id: 'stage4_jd-parse',
            title: 'Analyzing Job Description',
            description: 'Extracting requirements and keywords from JD',
            logs: [],
            status: 'pending',
        },
        {
            id: 'stage5_merge-tailor',
            title: 'Merging Profiles',
            description: 'Combining resume, LinkedIn, and job data',
            logs: [],
            status: 'pending',
        },
        {
            id: 'stage6_export',
            title: 'Generating Resume',
            description: 'Creating optimized resume content for the role',
            logs: [],
            status: 'pending',
        },
    ]);
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    const updateStage = (stageId: string, log?: string) => {
        setStages(prev => prev.map(stage => {
            if (stage.id === stageId) {
                return {
                    ...stage,
                    status: 'running' as const,
                    logs: log ? [...stage.logs, log] : stage.logs,
                };
            }
            if (prev.findIndex(s => s.id === stageId) > prev.findIndex(s => s.id === stage.id) && stage.status === 'running') {
                return { ...stage, status: 'completed' as const };
            }
            return stage;
        }));
        
        const idx = stages.findIndex(s => s.id === stageId);
        if (idx !== -1 && idx !== currentStageIndex) {
            setCurrentStageIndex(idx);
        }
    };

    const completeStage = (stageId: string) => {
        setStages(prev => prev.map(stage => 
            stage.id === stageId ? { ...stage, status: 'completed' as const } : stage
        ));
    };

    const addLog = (stageId: string, log: string) => {
        setStages(prev => prev.map(stage => 
            stage.id === stageId 
                ? { ...stage, logs: [...stage.logs, log] }
                : stage
        ));
    };

    const complete = () => {
        setIsComplete(true);
        setStages(prev => prev.map(stage => ({ ...stage, status: 'completed' as const })));
        setCurrentStageIndex(stages.length);
    };

    const reset = () => {
        setStages(prev => prev.map(stage => ({ ...stage, logs: [], status: 'pending' as const })));
        setCurrentStageIndex(0);
        setIsComplete(false);
    };

    return {
        stages,
        currentStageIndex,
        isComplete,
        updateStage,
        completeStage,
        addLog,
        complete,
        reset,
    };
}
