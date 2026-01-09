// Kanban Tracker Page - Application tracking board

'use client';

import { useState, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    useDroppable,
    DragOverEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Application, ApplicationColumn, Job } from '@/types';

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

// Sortable job card component
function SortableJobCard({
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
        transition: transition || 'transform 150ms ease', // Buttery smooth transition
        opacity: isDragging ? 0.3 : 1, // Placeholder opacity
        cursor: isDragging ? 'grabbing' : 'grab',
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
                        onDelete(application.id);
                    }}
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
            {application.external_link && (
                <a
                    href={application.external_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
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

// Kanban column component
function KanbanColumn({
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
            ref={setNodeRef}
            style={{
                flex: 1,
                minWidth: '220px',
                maxWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--background-secondary)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                // Visual feedback when hovering over the column
                border: isOver ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'border-color 0.2s ease',
            }}
        >
            {/* Column header */}
            <div
                style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {column}
                </h3>
                <span
                    style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '2px 8px',
                        background: 'var(--surface)',
                        borderRadius: '999px',
                        color: 'var(--text-secondary)',
                    }}
                >
                    {columnApps.length}
                </span>
            </div>

            {/* Cards container */}
            <SortableContext
                items={columnApps.map((app) => app.id)}
                strategy={verticalListSortingStrategy}
            >
                <div
                    style={{
                        flex: 1,
                        padding: '12px',
                        overflowY: 'auto',
                        minHeight: '200px', // Maintain min-height but expand to fill
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                    }}
                >
                    {/* Render items or empty state */}
                    {columnApps.map((app) => (
                        <SortableJobCard
                            key={app.id}
                            application={app}
                            onDelete={onDelete}
                        />
                    ))}
                    {columnApps.length === 0 && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100px',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                border: '2px dashed var(--border)',
                                borderRadius: 'var(--radius-md)',
                                opacity: 0.5,
                            }}
                        >
                            Drop jobs here
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

export default function TrackerPage() {
    const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 3, // Ultra-responsive 3px threshold
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        loadApplications();
    }, []);

    const loadApplications = async () => {
        try {
            const res = await fetch('/api/application');
            const data = await res.json();

            // Load job details for each application
            const appsWithJobs = await Promise.all(
                (data.applications || []).map(async (app: Application) => {
                    try {
                        const jobRes = await fetch(`/api/job/${app.job_id}`);
                        const jobData = await jobRes.json();
                        return { ...app, job: jobData.job };
                    } catch {
                        return app;
                    }
                })
            );

            setApplications(appsWithJobs);
        } catch (error) {
            console.error('Error loading applications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveTask = applications.find(app => app.id === activeId);
        const isOverTask = applications.find(app => app.id === overId);

        if (!isActiveTask) return;

        setApplications((prev) => {
            const activeIndex = prev.findIndex((t) => t.id === activeId);
            const overIndex = prev.findIndex((t) => t.id === overId);

            if (isOverTask) {
                if (isActiveTask.column_name !== isOverTask.column_name) {
                    const newItems = [...prev];
                    newItems[activeIndex].column_name = isOverTask.column_name;
                    return arrayMove(newItems, activeIndex, overIndex - 1); // Adjust index logic might need checking but standard is arrayMove
                }
                return arrayMove(prev, activeIndex, overIndex);
            }

            const isOverColumn = COLUMNS.includes(overId as ApplicationColumn);
            if (isOverColumn) {
                const newColumn = overId as ApplicationColumn;
                if (isActiveTask.column_name !== newColumn) {
                    const newItems = [...prev];
                    newItems[activeIndex].column_name = newColumn;
                    return arrayMove(newItems, activeIndex, activeIndex);
                }
            }

            return prev;
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeApp = applications.find((app) => app.id === active.id);
        if (!activeApp) return;

        // Determine destination column
        const isOverColumn = COLUMNS.includes(over.id as ApplicationColumn);
        let newColumn = isOverColumn
            ? over.id as ApplicationColumn
            : applications.find((app) => app.id === over.id)?.column_name;

        if (!newColumn) return;

        if (activeApp.column_name === newColumn) {
            // Logic for reordering in same column if needed, but handled by state already
        } else {
            // Optimistic update ensured
            setApplications((prev) =>
                prev.map((app) =>
                    app.id === active.id ? { ...app, column_name: newColumn as ApplicationColumn } : app
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
        }
    };

    const handleDelete = async (applicationId: string) => {
        if (!confirm('Are you sure you want to delete this application?')) return;

        // Optimistically update UI
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

    const activeApplication = activeId
        ? applications.find((app) => app.id === activeId)
        : null;

    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'var(--background)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <header
                style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--background-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a
                        href="/"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            fontSize: '14px',
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Jobs
                    </a>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                    <h1
                        style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            background: 'var(--gradient-primary)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Application Tracker
                    </h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {applications.length} applications
                    </span>
                </div>
            </header>

            {/* Kanban board */}
            <main
                style={{
                    flex: 1,
                    padding: '24px',
                    overflowX: 'auto',
                }}
            >
                {isLoading ? (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '400px',
                            color: 'var(--text-tertiary)',
                        }}
                    >
                        <div className="loading-spin" style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <div
                            style={{
                                display: 'flex',
                                gap: '16px',
                                minWidth: 'max-content',
                            }}
                        >
                            {COLUMNS.map((column) => (
                                <KanbanColumn
                                    key={column}
                                    column={column}
                                    applications={applications}
                                    onDelete={handleDelete}
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
                                        boxShadow: 'var(--shadow-xl)',
                                        cursor: 'grabbing',
                                        width: '220px',
                                        transform: 'scale(1.05)',
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
                )}
            </main>
        </div>
    );
}
