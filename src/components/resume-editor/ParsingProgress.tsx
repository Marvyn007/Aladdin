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

    useEffect(() => {
        if (currentStageIndex > animatedStages) {
            // Delay reveal of next stage to allow line animation to finish
            const timer = setTimeout(() => {
                setAnimatedStages(currentStageIndex);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [currentStageIndex, animatedStages]);

    // Only show stages that are completed or currently running (plus the next one being revealed)
    const visibleStages = stages.filter((_, index) => index <= Math.max(currentStageIndex, animatedStages));

    return (
        <div style={{
            padding: '24px 0',
            background: 'transparent',
            maxWidth: '550px',
            margin: '0 auto',
        }}>
            <div style={{ position: 'relative' }}>
                {visibleStages.map((stage, index) => (
                    <StageItem
                        key={stage.id}
                        stage={stage}
                        index={index}
                        isActive={index === currentStageIndex}
                        isCompleted={index < currentStageIndex}
                        isRevealing={index === currentStageIndex && index > animatedStages}
                        hasNext={index < stages.length - 1}
                        isLastVisible={index === visibleStages.length - 1}
                    />
                ))}
            </div>
        </div>
    );
}

interface StageItemProps {
    stage: ParsingStage;
    index: number;
    isActive: boolean;
    isCompleted: boolean;
    isRevealing: boolean;
    hasNext: boolean;
    isLastVisible: boolean;
}

function StageItem({ stage, index, isActive, isCompleted, isRevealing, hasNext, isLastVisible }: StageItemProps) {
    const [time, setTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isActive && stage.status === 'running') {
            if (!timerRef.current) {
                setTime(0);
                timerRef.current = setInterval(() => {
                    setTime(prev => prev + 1);
                }, 1000);
            }
        } else if (stage.status === 'completed' || stage.status === 'failed') {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isActive, stage.status]);

    const formatTime = (seconds: number) => {
        if (seconds === 0 && !isCompleted) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        if (m > 0) return `${m} m ${s} sec`;
        return `${s} sec`;
    };

    return (
        <div style={{
            position: 'relative',
            display: 'flex',
            gap: '20px',
            opacity: isRevealing ? 0 : 1,
            transform: isRevealing ? 'translateY(10px)' : 'translateY(0)',
            transition: 'all 0.5s ease',
            marginBottom: isLastVisible ? 0 : '16px'
        }}>
            {/* Left Column: Icons and Lines */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '24px',
                flexShrink: 0
            }}>
                <div style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    background: 'var(--surface)',
                    borderRadius: '50%'
                }}>
                    {isCompleted ? (
                        <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#22c55e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    ) : isActive ? (
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            boxShadow: '0 0 0 4px rgba(var(--accent-rgb, 59, 130, 246), 0.2)',
                        }} />
                    ) : (
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            border: '2px solid var(--border)',
                            background: 'transparent',
                        }} />
                    )}
                </div>

                {hasNext && !isLastVisible && (
                    <div style={{
                        width: '2px',
                        flex: 1,
                        background: 'var(--border)',
                        position: 'relative',
                        marginTop: '4px',
                        marginBottom: '4px'
                    }}>
                        {isCompleted && (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                background: '#22c55e',
                                animation: 'fillLine 0.6s ease-out forwards',
                                transformOrigin: 'top'
                            }} />
                        )}
                    </div>
                )}
            </div>

            {/* Right Column: Content */}
            <div style={{ flex: 1, paddingBottom: isLastVisible ? 0 : '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                    <div style={{
                        fontSize: '15px',
                        fontWeight: isActive || isCompleted ? 600 : 400,
                        color: isCompleted ? '#22c55e' : isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}>
                        {stage.title}
                    </div>
                    {(isActive || isCompleted) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                            {formatTime(time)}
                        </div>
                    )}
                </div>
                <div style={{
                    fontSize: '13px',
                    color: isActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    lineHeight: 1.4
                }}>
                    {stage.description}
                </div>

                {isActive && stage.logs.length > 0 && (
                    <div style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        fontFamily: 'inherit',
                        fontWeight: 400
                    }}>
                        {stage.logs.map((log, i) => (
                            <div key={i} style={{
                                marginBottom: i === stage.logs.length - 1 ? 0 : '2px',
                                opacity: i === stage.logs.length - 1 ? 1 : 0.5,
                                transition: 'opacity 0.3s ease'
                            }}>
                                {log}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fillLine {
                    from { transform: scaleY(0); }
                    to { transform: scaleY(1); }
                }
            `}</style>
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
