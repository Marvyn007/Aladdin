/**
 * ContentPanel - Left panel for editing resume sections
 * Features: Collapsible sections, drag-and-drop reordering, inline editing
 */

'use client';

import { useState, useRef } from 'react';
import { GripVertical, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
    TailoredResumeData,
    ResumeSection,
    ResumeSectionItem,
    ResumeBullet,
    ResumeContactInfo,
} from '@/types';

const QUICK_ADD_FIELDS = [
  { label: 'Portfolio', placeholder: 'https://yourportfolio.com' },
  { label: 'Twitter/X', placeholder: '@handle' },
  { label: 'Dribbble', placeholder: 'dribbble.com/yourname' },
  { label: 'Behance', placeholder: 'behance.net/yourname' },
  { label: 'Blog', placeholder: 'yourblog.com' },
  { label: 'Calendly', placeholder: 'calendly.com/yourname' },
];

// ── Shared icon ──────────────────────────────────────────────────────────────
function EyeIcon({ visible }: { visible: boolean }) {
    return visible ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
    ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
    );
}

// ── Sortable section card (render-prop) ───────────────────────────────────────
function SortableSectionCard({
    id,
    children,
}: {
    id: string;
    children: (handleProps: Record<string, unknown>) => React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    return (
        <div
            ref={setNodeRef}
            className="section-card"
            style={{
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e8ebef',
                overflow: 'hidden',
                transform: CSS.Transform.toString(transform) ?? undefined,
                transition: transition ?? 'all 0.15s ease',
                opacity: isDragging ? 0.85 : 1,
                boxShadow: isDragging
                    ? '0 4px 16px rgba(0,0,0,0.12)'
                    : '0 3px 10px rgba(0,0,0,0.03)',
                zIndex: isDragging ? 999 : ('auto' as React.CSSProperties['zIndex']),
                position: 'relative',
            }}
        >
            {children({ ...attributes, ...listeners })}
        </div>
    );
}

// ── Contact link row types and helpers ───────────────────────────────────────
type ContactLinkRow = {
    id: string;           // 'linkedin' | 'website' | 'github' | 'custom-<uuid>'
    label: string;
    inputType: string;
    value: string;
    placeholder: string;
    fieldKey: string;     // key for hiddenContactFields lookup
    isCustom: boolean;
    customFieldId?: string;
};

function deriveContactLinkRows(contact: ResumeContactInfo): ContactLinkRow[] {
    const natural: ContactLinkRow[] = [
        {
            id: 'linkedin',
            label: 'LinkedIn Profile',
            inputType: 'text',
            value: contact.linkedin ?? '',
            placeholder: 'linkedin.com/in/yourname',
            fieldKey: 'linkedin',
            isCustom: false,
        },
        {
            id: 'website',
            label: 'Website',
            inputType: 'url',
            value: contact.website ?? '',
            placeholder: 'https://',
            fieldKey: 'website',
            isCustom: false,
        },
        {
            id: 'github',
            label: 'GitHub URLs',
            inputType: 'text',
            value: (contact.github ?? []).join(', '),
            placeholder: 'Comma separated links',
            fieldKey: 'github',
            isCustom: false,
        },
        ...(contact.customFields ?? []).map(cf => ({
            id: `custom-${cf.id}`,
            label: cf.label,
            inputType: 'text',
            value: cf.value,
            placeholder: 'https:// or text',
            fieldKey: cf.id,
            isCustom: true,
            customFieldId: cf.id,
        })),
    ];

    const order = contact.linkFieldOrder;
    if (!order || order.length === 0) return natural;

    // Self-healing: filter stale keys, append any new ones not yet in order
    const byId = Object.fromEntries(natural.map(r => [r.id, r]));
    const validOrder = order.filter(k => k in byId);
    const inOrder = new Set(validOrder);
    const appended = natural.filter(r => !inOrder.has(r.id));
    return [...validOrder.map(k => byId[k]), ...appended];
}

function SortableContactLinkRow({
    row,
    isHidden,
    onToggleHide,
    onValueChange,
    onLabelChange,
    onRemove,
}: {
    row: ContactLinkRow;
    isHidden: boolean;
    onToggleHide: () => void;
    onValueChange: (value: string) => void;
    onLabelChange?: (label: string) => void;
    onRemove?: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: row.id });

    return (
        <div
            ref={setNodeRef}
            style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '8px',
                transform: CSS.Transform.toString(transform) ?? undefined,
                transition: transition ?? undefined,
                opacity: isDragging ? 0.85 : 1,
                background: isDragging ? '#f8fafc' : 'transparent',
                borderRadius: isDragging ? '8px' : undefined,
            }}
        >
            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                style={{
                    cursor: 'grab',
                    color: '#d1d5db',
                    display: 'flex',
                    alignItems: 'center',
                    paddingBottom: '8px',
                    flexShrink: 0,
                    touchAction: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; }}
            >
                <GripVertical size={14} />
            </div>

            {row.isCustom ? (
                <>
                    <div style={{ flex: '0 0 120px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Label</label>
                        <input
                            type="text"
                            value={row.label}
                            onChange={(e) => onLabelChange?.(e.target.value)}
                            style={{ width: '100%', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#111827', outline: 'none' }}
                            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Value / URL</label>
                        <input
                            type="text"
                            value={row.value}
                            onChange={(e) => onValueChange(e.target.value)}
                            placeholder="https:// or text"
                            style={{ width: '100%', background: isHidden ? '#f9fafb' : '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: isHidden ? '#9ca3af' : '#111827', outline: 'none', opacity: isHidden ? 0.6 : 1 }}
                            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>
                </>
            ) : (
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {row.label}
                    </label>
                    <input
                        type={row.inputType}
                        value={row.value}
                        onChange={(e) => onValueChange(e.target.value)}
                        placeholder={row.placeholder}
                        style={{
                            width: '100%',
                            background: isHidden ? '#f9fafb' : '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            fontSize: '14px',
                            fontWeight: 400,
                            color: isHidden ? '#9ca3af' : '#111827',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                            opacity: isHidden ? 0.6 : 1,
                        }}
                        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                    />
                </div>
            )}

            {/* Hide/show toggle */}
            <button
                onClick={onToggleHide}
                title={isHidden ? 'Show on resume' : 'Hide from resume'}
                style={{
                    marginTop: row.isCustom ? 0 : '22px',
                    padding: '8px',
                    border: 'none',
                    borderRadius: '8px',
                    background: isHidden ? '#fee2e2' : '#f0fdf4',
                    color: isHidden ? '#ef4444' : '#22c55e',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <EyeIcon visible={!isHidden} />
            </button>

            {/* Delete button — custom fields only */}
            {row.isCustom && onRemove && (
                <button
                    onClick={onRemove}
                    title="Remove field"
                    style={{ padding: '8px', border: 'none', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                    </svg>
                </button>
            )}
        </div>
    );
}

interface ContentPanelProps {
    resume: TailoredResumeData;
    onChange: (resume: TailoredResumeData) => void;
    onEnhanceBullet?: (args: {
        section: ResumeSection;
        item: ResumeSectionItem;
        bullet: ResumeBullet;
    }) => Promise<string>;
    onEnhanceSummary?: (summary: string) => Promise<string>;
}

export function ContentPanel({ resume, onChange, onEnhanceBullet, onEnhanceSummary }: ContentPanelProps) {
    const [editingContact, setEditingContact] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [bulletToDelete, setBulletToDelete] = useState<{ sectionId: string, itemId: string, bulletId: string } | null>(null);
    const [skillDrafts, setSkillDrafts] = useState<Record<string, string>>({});
    const [enhancingBulletId, setEnhancingBulletId] = useState<string | null>(null);
    const [isEnhancingSummary, setIsEnhancingSummary] = useState(false);
    const [summaryEnhanceCount, setSummaryEnhanceCount] = useState(0);
    const [summaryEnhanceError, setSummaryEnhanceError] = useState<string | null>(null);
    const [enhanceCounts, setEnhanceCounts] = useState<Record<string, number>>({});
    const [enhanceErrorByBullet, setEnhanceErrorByBullet] = useState<Record<string, string>>({});

    const handleSectionDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = resume.sections.findIndex(s => s.id === active.id);
        const newIndex = resume.sections.findIndex(s => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        onChange({
            ...resume,
            sections: arrayMove(resume.sections, oldIndex, newIndex),
            updatedAt: new Date().toISOString(),
        });
    };

    const handleContactLinkDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const rows = deriveContactLinkRows(resume.contact);
        const ids = rows.map(r => r.id);
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return;
        onChange({
            ...resume,
            contact: {
                ...resume.contact,
                linkFieldOrder: arrayMove(ids, oldIndex, newIndex),
            },
            updatedAt: new Date().toISOString(),
        });
    };

    const toggleSection = (sectionId: string) => {
        const newCollapsed = new Set(collapsedSections);
        if (newCollapsed.has(sectionId)) {
            newCollapsed.delete(sectionId);
        } else {
            newCollapsed.add(sectionId);
        }
        setCollapsedSections(newCollapsed);
    };

    const toggleSectionVisibility = (sectionId: string) => {
        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId ? { ...s, visible: s.visible === false ? true : false } : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const toggleItemVisibility = (sectionId: string, itemId: string) => {
        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId
                    ? {
                        ...s, items: s.items.map(item =>
                            item.id === itemId ? { ...item, visible: item.visible === false ? true : false } : item
                        )
                    }
                    : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const toggleBulletVisibility = (sectionId: string, itemId: string, bulletId: string) => {
        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId
                    ? {
                        ...s, items: s.items.map(item =>
                            item.id === itemId
                                ? {
                                    ...item, bullets: (item.bullets || []).map(b =>
                                        b.id === bulletId ? { ...b, visible: b.visible === false ? true : false } : b
                                    )
                                }
                                : item
                        )
                    }
                    : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const updateContact = (field: keyof ResumeContactInfo, value: string | string[]) => {
        onChange({
            ...resume,
            contact: { ...resume.contact, [field]: value },
            updatedAt: new Date().toISOString(),
        });
    };

    const toggleContactFieldVisibility = (fieldKey: string) => {
        const current = resume.contact.hiddenContactFields || [];
        const isHidden = current.includes(fieldKey);
        onChange({
            ...resume,
            contact: {
                ...resume.contact,
                hiddenContactFields: isHidden
                    ? current.filter(k => k !== fieldKey)
                    : [...current, fieldKey],
            },
            updatedAt: new Date().toISOString(),
        });
    };

    const addCustomField = (label: string) => {
        const existing = resume.contact.customFields || [];
        if (existing.some(f => f.label === label)) return;
        onChange({
            ...resume,
            contact: {
                ...resume.contact,
                customFields: [...existing, { id: crypto.randomUUID(), label, value: '' }],
            },
            updatedAt: new Date().toISOString(),
        });
    };

    const updateCustomField = (id: string, field: 'label' | 'value', val: string) => {
        onChange({
            ...resume,
            contact: {
                ...resume.contact,
                customFields: (resume.contact.customFields || []).map(f =>
                    f.id === id ? { ...f, [field]: val } : f
                ),
            },
            updatedAt: new Date().toISOString(),
        });
    };

    const removeCustomField = (id: string) => {
        onChange({
            ...resume,
            contact: {
                ...resume.contact,
                customFields: (resume.contact.customFields || []).filter(f => f.id !== id),
                hiddenContactFields: (resume.contact.hiddenContactFields || []).filter(k => k !== id),
            },
            updatedAt: new Date().toISOString(),
        });
    };

    const updateSection = (sectionId: string, updates: Partial<ResumeSection>) => {
        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId ? { ...s, ...updates } : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const updateSectionItem = (sectionId: string, itemId: string, updates: Partial<ResumeSectionItem>) => {
        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId
                    ? {
                        ...s, items: s.items.map(item =>
                            item.id === itemId ? { ...item, ...updates } : item
                        )
                    }
                    : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const updateBullet = (sectionId: string, itemId: string, bulletId: string, text: string) => {
        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId
                    ? {
                        ...s, items: s.items.map(item =>
                            item.id === itemId
                                ? {
                                    ...item, bullets: (item.bullets || []).map(b =>
                                        b.id === bulletId ? { ...b, text, isSuggested: false } : b
                                    )
                                }
                                : item
                        )
                    }
                    : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const handleEnhanceBullet = async (section: ResumeSection, item: ResumeSectionItem, bullet: ResumeBullet) => {
        if (!onEnhanceBullet || enhancingBulletId || !bullet.text.trim()) return;

        const currentCount = enhanceCounts[bullet.id] ?? 0;
        if (currentCount >= 10) {
            setEnhanceErrorByBullet(prev => ({
                ...prev,
                [bullet.id]: 'Enhancement limit reached for this bullet.',
            }));
            return;
        }

        setEnhancingBulletId(bullet.id);
        setEnhanceErrorByBullet(prev => {
            const next = { ...prev };
            delete next[bullet.id];
            return next;
        });

        try {
            const enhancedText = await onEnhanceBullet({ section, item, bullet });
            updateBullet(section.id, item.id, bullet.id, enhancedText);
            setEnhanceCounts(prev => ({ ...prev, [bullet.id]: currentCount + 1 }));
        } catch (error) {
            setEnhanceErrorByBullet(prev => ({
                ...prev,
                [bullet.id]: error instanceof Error ? error.message : 'Could not enhance this bullet.',
            }));
        } finally {
            setEnhancingBulletId(null);
        }
    };

    const fitTextareaToContent = (textarea: HTMLTextAreaElement | null) => {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    const handleEnhanceSummary = async () => {
        const currentSummary = (resume.summary || '').trim();
        if (!onEnhanceSummary || isEnhancingSummary || !currentSummary) return;

        if (summaryEnhanceCount >= 10) {
            setSummaryEnhanceError('Enhancement limit reached for this summary.');
            return;
        }

        setIsEnhancingSummary(true);
        setSummaryEnhanceError(null);

        try {
            const enhancedSummary = await onEnhanceSummary(currentSummary);
            updateSummary(enhancedSummary);
            setSummaryEnhanceCount(count => count + 1);
        } catch (error) {
            setSummaryEnhanceError(error instanceof Error ? error.message : 'Could not enhance this summary.');
        } finally {
            setIsEnhancingSummary(false);
        }
    };

    const addBullet = (sectionId: string, itemId: string) => {
        const newBullet: ResumeBullet = {
            id: crypto.randomUUID(),
            text: 'New bullet point...',
            isSuggested: false,
        };

        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId
                    ? {
                        ...s, items: s.items.map(item =>
                            item.id === itemId
                                ? { ...item, bullets: [...(item.bullets || []), newBullet] }
                                : item
                        )
                    }
                    : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const removeBullet = (sectionId: string, itemId: string, bulletId: string) => {
        setBulletToDelete({ sectionId, itemId, bulletId });
    };

    const confirmDeleteBullet = () => {
        if (!bulletToDelete) return;
        const { sectionId, itemId, bulletId } = bulletToDelete;
        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId
                    ? {
                        ...s, items: s.items.map(item =>
                            item.id === itemId
                                ? { ...item, bullets: (item.bullets || []).filter(b => b.id !== bulletId) }
                                : item
                        )
                    }
                    : s
            ),
            updatedAt: new Date().toISOString(),
        });
        setBulletToDelete(null);
    };

    const deleteSectionItem = (sectionId: string, itemId: string) => {
        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId
                    ? { ...s, items: s.items.filter(i => i.id !== itemId) }
                    : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const addSectionItem = (sectionId: string, type: string) => {
        const newItem: ResumeSectionItem = {
            id: crypto.randomUUID(),
            title: 'New Item',
            bullets: [],
        };

        onChange({
            ...resume,
            sections: resume.sections.map(s =>
                s.id === sectionId
                    ? { ...s, items: [...s.items, newItem] }
                    : s
            ),
            updatedAt: new Date().toISOString(),
        });
    };

    const handleSkillChange = (category: string, value: string) => {
        setSkillDrafts(prev => ({ ...prev, [category]: value }));
        onChange({
            ...resume,
            skills: {
                ...resume.skills,
                [category]: value.split(',').map(s => s.trim()).filter(Boolean),
            },
            updatedAt: new Date().toISOString(),
        });
    };

    const handleSkillBlur = (category: string) => {
        setSkillDrafts(prev => {
            const next = { ...prev };
            delete next[category];
            return next;
        });
    };

    const updateSummary = (text: string) => {
        onChange({
            ...resume,
            summary: text,
            updatedAt: new Date().toISOString(),
        });
    };

    return (
        <div className="content-panel" style={{
            background: '#ffffff', 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '24px' 
        }}>
            {/* Professional Summary Section */}
            <div className="section-card" style={{ 
                background: '#ffffff', 
                borderRadius: '10px', 
                border: '1px solid #e8ebef', 
                boxShadow: '0 3px 10px rgba(0,0,0,0.03)', 
                padding: '16px',
                transition: 'all 0.15s ease'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                        </div>
                        Professional Summary
                    </h3>
                </div>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '10px',
                    borderRadius: '10px',
                    background: isEnhancingSummary ? '#f0f9ff' : '#f9fafb',
                    border: isEnhancingSummary ? '1px solid #7dd3fc' : '1px solid transparent',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    transition: 'all 0.15s ease',
                }}>
                    <textarea
                        value={resume.summary || ''}
                        ref={fitTextareaToContent}
                        onChange={(e) => {
                            updateSummary(e.target.value);
                            fitTextareaToContent(e.currentTarget);
                        }}
                        disabled={isEnhancingSummary}
                        placeholder="Write a compelling professional summary that highlights your best skills and experiences..."
                        style={{ 
                            width: '100%', 
                            background: '#ffffff', 
                            border: '1px solid #e5e7eb', 
                            borderRadius: '8px', 
                            padding: '10px 12px',
                            fontSize: '13px', 
                            fontWeight: 400,
                            outline: 'none',
                            transition: 'all 0.15s ease',
                            minHeight: '88px',
                            height: 'auto',
                            lineHeight: 1.55,
                            color: '#334155',
                            resize: 'none',
                            overflow: 'hidden',
                            fontFamily: 'inherit',
                            opacity: isEnhancingSummary ? 0.75 : 1,
                            boxShadow: '0 1px 1px rgba(15, 23, 42, 0.03)',
                        }}
                        rows={1}
                        onFocus={(e) => {
                            fitTextareaToContent(e.currentTarget);
                            e.target.style.borderColor = '#93c5fd';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#e5e7eb';
                            e.target.style.boxShadow = '0 1px 1px rgba(15, 23, 42, 0.03)';
                        }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {onEnhanceSummary && (
                                <button
                                    type="button"
                                    className={`resume-ai-enhance-btn${isEnhancingSummary ? ' is-loading' : ''}`}
                                    onClick={handleEnhanceSummary}
                                    disabled={!resume.summary?.trim() || isEnhancingSummary || summaryEnhanceCount >= 10}
                                    title={summaryEnhanceCount >= 10 ? 'Enhancement limit reached' : 'Enhance summary with AI'}
                                    aria-label="Enhance summary with AI"
                                    style={{
                                        ['--ai-size' as string]: '0.5',
                                        cursor: resume.summary?.trim() && !isEnhancingSummary && summaryEnhanceCount < 10 ? 'pointer' : 'not-allowed',
                                        opacity: resume.summary?.trim() || isEnhancingSummary ? 1 : 0.48,
                                    }}
                                >
                                    {isEnhancingSummary ? (
                                        <Loader2 className="resume-ai-enhance-spark animate-spin" aria-hidden="true" />
                                    ) : (
                                        <Sparkles className="resume-ai-enhance-spark" fill="currentColor" strokeWidth={1.8} aria-hidden="true" />
                                    )}
                                    <span className="resume-ai-enhance-label">AI</span>
                                </button>
                            )}
                        </div>
                    </div>
                    {isEnhancingSummary && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '5px',
                            fontSize: '11px',
                            color: '#1d4ed8',
                            lineHeight: 1.4,
                        }}>
                            <Loader2 size={11} className="animate-spin" />
                            <span>Enhancing this summary...</span>
                        </div>
                    )}
                    {summaryEnhanceError && (
                        <div style={{
                            padding: '4px 8px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '5px',
                            fontSize: '11px',
                            color: '#b91c1c',
                            lineHeight: 1.4,
                        }}>
                            {summaryEnhanceError}
                        </div>
                    )}
                </div>
            </div>

            {/* Contact Info Section */}
            <div className="section-card" style={{ 
                background: '#ffffff', 
                borderRadius: '10px', 
                border: '1px solid #e8ebef', 
                boxShadow: '0 3px 10px rgba(0,0,0,0.03)', 
                padding: '16px',
                transition: 'all 0.15s ease'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 2 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        Contact Information
                    </h3>
                    <button
                        onClick={() => setEditingContact(!editingContact)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            border: 'none',
                            background: editingContact ? '#3b82f6' : '#f3f4f6',
                            color: editingContact ? '#ffffff' : '#6b7280'
                        }}
                    >
                        {editingContact ? (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Save Changes
                            </>
                        ) : (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                Edit Profile
                            </>
                        )}
                    </button>
                </div>

                {editingContact ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Core fields — name, email, phone, location — not draggable */}
                        {[
                            { key: 'name', label: 'Full Name', type: 'text', value: resume.contact.name, placeholder: 'John Doe', alwaysVisible: true },
                            { key: 'email', label: 'Email Address', type: 'email', value: resume.contact.email, placeholder: 'john@example.com', alwaysVisible: false },
                            { key: 'phone', label: 'Phone Number', type: 'tel', value: resume.contact.phone, placeholder: '+1 (555) 000-0000', alwaysVisible: false },
                            { key: 'location', label: 'Location', type: 'text', value: resume.contact.location || '', placeholder: 'New York, NY', alwaysVisible: false },
                        ].map(field => {
                            const isHidden = !field.alwaysVisible && (resume.contact.hiddenContactFields || []).includes(field.key);
                            return (
                                <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {field.label}
                                        </label>
                                        <input
                                            type={field.type}
                                            value={field.value}
                                            onChange={(e) => updateContact(field.key as keyof ResumeContactInfo, e.target.value)}
                                            placeholder={field.placeholder}
                                            style={{
                                                width: '100%',
                                                background: isHidden ? '#f9fafb' : '#ffffff',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '10px',
                                                padding: '10px 12px',
                                                fontSize: '14px',
                                                fontWeight: 400,
                                                color: isHidden ? '#9ca3af' : '#111827',
                                                outline: 'none',
                                                transition: 'all 0.15s ease',
                                                opacity: isHidden ? 0.6 : 1,
                                            }}
                                            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                                            onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                                        />
                                    </div>
                                    {!field.alwaysVisible && (
                                        <button
                                            onClick={() => toggleContactFieldVisibility(field.key)}
                                            title={isHidden ? 'Show on resume' : 'Hide from resume'}
                                            style={{
                                                marginTop: '22px',
                                                padding: '8px',
                                                border: 'none',
                                                borderRadius: '8px',
                                                background: isHidden ? '#fee2e2' : '#f0fdf4',
                                                color: isHidden ? '#ef4444' : '#22c55e',
                                                cursor: 'pointer',
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <EyeIcon visible={!isHidden} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Link rows — linkedin, website, github, custom fields — draggable */}
                        <DndContext collisionDetection={closestCenter} onDragEnd={handleContactLinkDragEnd}>
                            <SortableContext
                                items={deriveContactLinkRows(resume.contact).map(r => r.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {deriveContactLinkRows(resume.contact).map(row => {
                                    const isHidden = (resume.contact.hiddenContactFields || []).includes(row.fieldKey);
                                    return (
                                        <SortableContactLinkRow
                                            key={row.id}
                                            row={row}
                                            isHidden={isHidden}
                                            onToggleHide={() => toggleContactFieldVisibility(row.fieldKey)}
                                            onValueChange={(value) => {
                                                if (row.id === 'github') {
                                                    updateContact('github', value.split(',').map(s => s.trim()).filter(Boolean));
                                                } else if (row.isCustom && row.customFieldId) {
                                                    updateCustomField(row.customFieldId, 'value', value);
                                                } else {
                                                    updateContact(row.fieldKey as keyof ResumeContactInfo, value);
                                                }
                                            }}
                                            onLabelChange={
                                                row.isCustom && row.customFieldId
                                                    ? (label) => updateCustomField(row.customFieldId!, 'label', label)
                                                    : undefined
                                            }
                                            onRemove={
                                                row.isCustom && row.customFieldId
                                                    ? () => removeCustomField(row.customFieldId!)
                                                    : undefined
                                            }
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>

                        {/* Quick-add chips */}
                        <div style={{ marginTop: '4px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quick Add</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {QUICK_ADD_FIELDS
                                    .filter(f => !(resume.contact.customFields || []).some(cf => cf.label === f.label))
                                    .map(f => (
                                        <button
                                            key={f.label}
                                            onClick={() => addCustomField(f.label)}
                                            style={{
                                                padding: '5px 10px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                borderRadius: '20px',
                                                border: '1px solid #e5e7eb',
                                                background: '#f9fafb',
                                                color: '#374151',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}
                                            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
                                            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                                        >
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                            {f.label}
                                        </button>
                                    ))
                                }
                                <button
                                    onClick={() => addCustomField('Custom')}
                                    style={{
                                        padding: '5px 10px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        borderRadius: '20px',
                                        border: '1px dashed #d1d5db',
                                        background: 'transparent',
                                        color: '#6b7280',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                    }}
                                >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    Add custom
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '13px', fontWeight: 500, color: '#6b7280', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontWeight: 700, color: '#111827' }}>{resume.contact.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#d1d5db' }}>•</span>
                            <span>{resume.contact.email}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#d1d5db' }}>•</span>
                            <span>{resume.contact.phone}</span>
                        </div>
                        {resume.contact.location && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#d1d5db' }}>•</span>
                                <span>{resume.contact.location}</span>
                            </div>
                        )}
                        {resume.contact.website && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#d1d5db' }}>•</span>
                                <span>{resume.contact.website}</span>
                            </div>
                        )}
                        {resume.contact.github && resume.contact.github.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#d1d5db' }}>•</span>
                                <span>{resume.contact.github.length} GitHub Link(s)</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Resume Sections */}
            <DndContext collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                <SortableContext
                    items={resume.sections.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {resume.sections.map((section) => (
                    <SortableSectionCard key={section.id} id={section.id}>
                    {(handleProps) => (<>
                    {/* Section Header */}
                    <div
                        onClick={() => toggleSection(section.id)}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '14px 16px',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Drag handle */}
                            <div
                                {...handleProps}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    cursor: 'grab',
                                    color: '#d1d5db',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 2px',
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                    touchAction: 'none',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#9ca3af';
                                    e.currentTarget.style.background = '#f3f4f6';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#d1d5db';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <GripVertical size={16} />
                            </div>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontSize: '16px',
                                background: collapsedSections.has(section.id) ? '#f3f4f6' : '#eff6ff',
                                color: collapsedSections.has(section.id) ? '#9ca3af' : '#3b82f6',
                                transition: 'all 0.15s ease'
                            }}>
                                {section.type === 'education' && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>
                                )}
                                {section.type === 'experience' && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                                )}
                                {section.type === 'projects' && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                                )}
                                {section.type === 'community' && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 2 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                )}
                                {section.type === 'skills' && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m6.8 14-3.5 2"/><path d="m20.7 16-3.5-2"/><path d="M6.8 10 3.3 8"/><path d="m20.7 8-3.5 2"/><path d="m9 22 3-8 3 8"/><path d="M8 6h8"/></svg>
                                )}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{section.title}</h3>
                                <span style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {section.items.length} {section.items.length === 1 ? 'Entry' : 'Entries'}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Hide/Unhide Toggle Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSectionVisibility(section.id);
                                }}
                                title={section.visible === false ? 'Show in resume' : 'Hide from resume'}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    height: '28px',
                                    borderRadius: '16px',
                                    border: '1px solid #e5e7eb',
                                    background: section.visible === false ? '#fef3c7' : '#f3f4f6',
                                    color: section.visible === false ? '#b45309' : '#6b7280',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = section.visible === false ? '#fde68a' : '#e5e7eb';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = section.visible === false ? '#fef3c7' : '#f3f4f6';
                                }}
                            >
                                {section.visible === false ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>
                                ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                                {section.visible === false ? 'Unhide' : 'Hide'}
                            </button>
                            {/* Collapse Toggle */}
                            <div style={{ 
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '6px', 
                                border: '1px solid #e5e7eb',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                background: collapsedSections.has(section.id) ? '#f9fafb' : '#ffffff',
                                transition: 'all 0.15s ease',
                                cursor: 'pointer'
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{
                                    transform: collapsedSections.has(section.id) ? 'rotate(-90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s ease'
                                }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Section Content */}
                    {!collapsedSections.has(section.id) && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
                            {section.type === 'skills' ? (
                                <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {Object.entries(resume.skills || {}).map(([category, items]) => (
                                        <div key={category}>
                                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{category}</label>
                                            <textarea
                                                value={category in skillDrafts ? skillDrafts[category] : (Array.isArray(items) ? items.join(', ') : '')}
                                                onChange={(e) => handleSkillChange(category, e.target.value)}
                                                style={{ 
                                                    width: '100%', 
                                                    background: '#ffffff', 
                                                    border: '1px solid #e5e7eb', 
                                                    borderRadius: '10px', 
                                                    padding: '10px 12px', 
                                                    fontSize: '14px', 
                                                    fontWeight: 400,
                                                    color: '#111827',
                                                    outline: 'none',
                                                    transition: 'all 0.15s ease',
                                                    minHeight: '80px',
                                                    lineHeight: 1.6,
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = '#3b82f6';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = '#e5e7eb';
                                                    e.target.style.boxShadow = 'none';
                                                    handleSkillBlur(category);
                                                }}
                                                placeholder={`List ${category} separated by commas...`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {section.items.map((item) => (
                                        <div
                                            key={item.id}
                                            style={{ 
                                                position: 'relative',
                                                paddingLeft: '16px',
                                                borderLeft: '2px solid #f3f4f6'
                                            }}
                                        >
                                            <div style={{ position: 'absolute', left: '-5px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#d1d5db' }}></div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                <input
                                                        type="text"
                                                        value={item.title}
                                                        onChange={(e) => updateSectionItem(section.id, item.id, { title: e.target.value })}
                                                        placeholder="Title / Organization"
                                                        style={{ 
                                                            flex: 1, 
                                                            background: 'transparent', 
                                                            border: '1px solid transparent', 
                                                            borderRadius: '6px', 
                                                            padding: '6px 8px', 
                                                            fontSize: '14px', 
                                                            fontWeight: 600,
                                                            color: '#111827',
                                                            outline: 'none',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        onFocus={(e) => {
                                                            e.target.style.background = '#ffffff';
                                                            e.target.style.borderColor = '#e5e7eb';
                                                            e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
                                                        }}
                                                        onBlur={(e) => {
                                                            e.target.style.background = 'transparent';
                                                            e.target.style.borderColor = 'transparent';
                                                            e.target.style.boxShadow = 'none';
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button
                                                            onClick={() => toggleItemVisibility(section.id, item.id)}
                                                            title={item.visible === false ? 'Show in resume' : 'Hide from resume'}
                                                            aria-label={item.visible === false ? 'Show item in resume' : 'Hide item from resume'}
                                                            style={{
                                                                padding: '4px 8px',
                                                                height: '28px',
                                                                borderRadius: '14px',
                                                                border: '1px solid #e5e7eb',
                                                                background: item.visible === false ? '#fef3c7' : '#f3f4f6',
                                                                color: item.visible === false ? '#b45309' : '#6b7280',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                        >
                                                            {item.visible === false ? (
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>
                                                            ) : (
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => deleteSectionItem(section.id, item.id)}
                                                            style={{
                                                                padding: '4px',
                                                                color: '#9ca3af',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                opacity: 0,
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                            title="Delete item"
                                                            onMouseOver={(e) => {
                                                                e.currentTarget.style.color = '#ef4444';
                                                                e.currentTarget.style.background = '#fef2f2';
                                                                e.currentTarget.style.opacity = '1';
                                                            }}
                                                            onMouseOut={(e) => {
                                                                e.currentTarget.style.color = '#9ca3af';
                                                                e.currentTarget.style.background = 'transparent';
                                                                e.currentTarget.style.opacity = '0';
                                                            }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {item.subtitle !== undefined && (
                                                        <input
                                                            type="text"
                                                            value={item.subtitle || ''}
                                                            onChange={(e) => updateSectionItem(section.id, item.id, { subtitle: e.target.value })}
                                                            placeholder="Location / Subtitle"
                                                            style={{ 
                                                                flex: 1, 
                                                                background: '#ffffff', 
                                                                border: '1px solid #e5e7eb', 
                                                                borderRadius: '6px', 
                                                                padding: '6px 10px', 
                                                                fontSize: '13px', 
                                                                fontWeight: 500,
                                                                color: '#374151',
                                                                outline: 'none',
                                                                transition: 'all 0.15s ease',
                                                                minWidth: '120px'
                                                            }}
                                                            onFocus={(e) => {
                                                                e.target.style.borderColor = '#3b82f6';
                                                                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
                                                            }}
                                                            onBlur={(e) => {
                                                                e.target.style.borderColor = '#e5e7eb';
                                                                e.target.style.boxShadow = 'none';
                                                            }}
                                                        />
                                                    )}
                                                    <input
                                                        type="text"
                                                        value={item.dates || ''}
                                                        onChange={(e) => updateSectionItem(section.id, item.id, { dates: e.target.value })}
                                                        placeholder="Dates (e.g. 2022 - Present)"
                                                        style={{ 
                                                            width: '160px', 
                                                            background: '#ffffff', 
                                                            border: '1px solid #e5e7eb', 
                                                            borderRadius: '6px', 
                                                            padding: '6px 10px', 
                                                            fontSize: '13px', 
                                                            fontWeight: 500,
                                                            color: '#374151',
                                                            outline: 'none',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        onFocus={(e) => {
                                                            e.target.style.borderColor = '#3b82f6';
                                                            e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
                                                        }}
                                                        onBlur={(e) => {
                                                            e.target.style.borderColor = '#e5e7eb';
                                                            e.target.style.boxShadow = 'none';
                                                        }}
                                                    />
                                                </div>

                                                {item.technologies !== undefined && (
                                                    <input
                                                        type="text"
                                                        value={item.technologies || ''}
                                                        onChange={(e) => updateSectionItem(section.id, item.id, { technologies: e.target.value })}
                                                        placeholder="Technologies (JavaScript, React, etc.)"
                                                        style={{ 
                                                            width: '100%', 
                                                            background: '#f0f9ff', 
                                                            border: '1px solid transparent', 
                                                            borderRadius: '6px', 
                                                            padding: '8px 12px', 
                                                            fontSize: '13px', 
                                                            fontWeight: 500,
                                                            color: '#0369a1',
                                                            outline: 'none',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        onFocus={(e) => {
                                                            e.target.style.background = '#ffffff';
                                                            e.target.style.borderColor = '#bae6fd';
                                                            e.target.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.1)';
                                                        }}
                                                        onBlur={(e) => {
                                                            e.target.style.background = '#f0f9ff';
                                                            e.target.style.borderColor = 'transparent';
                                                            e.target.style.boxShadow = 'none';
                                                        }}
                                                    />
                                                )}
                                            </div>

                                            {/* Bullets */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '4px' }}>
                                                {(item.bullets || []).map((bullet) => (
                                                    (() => {
                                                        const isEnhancing = enhancingBulletId === bullet.id;
                                                        const enhanceCount = enhanceCounts[bullet.id] ?? 0;
                                                        const canEnhance = !!onEnhanceBullet && enhanceCount < 10 && !!bullet.text.trim();
                                                        const enhanceError = enhanceErrorByBullet[bullet.id];
                                                        return (
                                                    <div
                                                        key={bullet.id}
                                                        style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                                                    >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '8px',
                                                            padding: '10px',
                                                            borderRadius: '10px',
                                                            background: isEnhancing ? '#f0f9ff' : (bullet.isSuggested ? '#fffbeb' : (bullet.visible === false ? '#fef3c7' : '#f9fafb')),
                                                            border: isEnhancing ? '1px solid #7dd3fc' : (bullet.isSuggested ? '1px dashed #fcd34d' : (bullet.visible === false ? '1px dashed #fbbf24' : '1px solid transparent')),
                                                            opacity: bullet.visible === false ? 0.7 : 1,
                                                            transition: 'all 0.15s ease',
                                                            boxShadow: bullet.visible === false ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)'
                                                        }}
                                                    >
                                                        <div style={{ display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr)', gap: '8px', alignItems: 'start' }}>
                                                            <div style={{
                                                                width: '5px',
                                                                height: '5px',
                                                                borderRadius: '50%',
                                                                background: bullet.visible === false ? '#f59e0b' : (bullet.isSuggested ? '#d97706' : '#64748b'),
                                                                marginTop: '9px',
                                                                flexShrink: 0
                                                            }} />
                                                            <textarea
                                                                value={bullet.text}
                                                                ref={fitTextareaToContent}
                                                                onChange={(e) => {
                                                                    updateBullet(section.id, item.id, bullet.id, e.target.value);
                                                                    fitTextareaToContent(e.currentTarget);
                                                                }}
                                                                disabled={isEnhancing}
                                                                style={{ 
                                                                    width: '100%',
                                                                    minHeight: '60px',
                                                                    height: 'auto',
                                                                    background: '#ffffff',
                                                                    border: '1px solid #e5e7eb',
                                                                    borderRadius: '8px',
                                                                    padding: '9px 12px',
                                                                    fontSize: '13px',
                                                                    fontWeight: 400,
                                                                    color: '#334155',
                                                                    outline: 'none',
                                                                    resize: 'none',
                                                                    overflow: 'hidden',
                                                                    lineHeight: 1.5,
                                                                    fontFamily: 'inherit',
                                                                    opacity: isEnhancing ? 0.75 : 1,
                                                                    boxShadow: '0 1px 1px rgba(15, 23, 42, 0.03)',
                                                                }}
                                                                rows={1}
                                                                onFocus={(e) => {
                                                                    fitTextareaToContent(e.currentTarget);
                                                                    e.target.style.borderColor = '#93c5fd';
                                                                    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
                                                                }}
                                                                onBlur={(e) => {
                                                                    e.target.style.borderColor = '#e5e7eb';
                                                                    e.target.style.boxShadow = '0 1px 1px rgba(15, 23, 42, 0.03)';
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingLeft: '18px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {onEnhanceBullet && (
                                                                <button
                                                                    type="button"
                                                                    className={`resume-ai-enhance-btn${isEnhancing ? ' is-loading' : ''}`}
                                                                    onClick={() => handleEnhanceBullet(section, item, bullet)}
                                                                    disabled={!canEnhance || !!enhancingBulletId}
                                                                    title={enhanceCount >= 10 ? 'Enhancement limit reached' : 'Enhance bullet with AI'}
                                                                    aria-label="Enhance bullet with AI"
                                                                    style={{
                                                                        ['--ai-size' as string]: '0.5',
                                                                        cursor: canEnhance && !enhancingBulletId ? 'pointer' : 'not-allowed',
                                                                        opacity: canEnhance || isEnhancing ? 1 : 0.48,
                                                                    }}
                                                                >
                                                                    {isEnhancing ? (
                                                                        <Loader2 className="resume-ai-enhance-spark animate-spin" aria-hidden="true" />
                                                                    ) : (
                                                                        <Sparkles className="resume-ai-enhance-spark" fill="currentColor" strokeWidth={1.8} aria-hidden="true" />
                                                                    )}
                                                                    <span className="resume-ai-enhance-label">AI</span>
                                                                </button>
                                                            )}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <button
                                                                type="button"
                                                                className="resume-bullet-action-btn"
                                                                onClick={() => toggleBulletVisibility(section.id, item.id, bullet.id)}
                                                                title={bullet.visible === false ? 'Show bullet' : 'Hide bullet'}
                                                                aria-label={bullet.visible === false ? 'Show bullet in resume' : 'Hide bullet from resume'}
                                                                style={{
                                                                    color: bullet.visible === false ? '#f59e0b' : '#d1d5db',
                                                                }}
                                                            >
                                                                {bullet.visible === false ? (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>
                                                                ) : (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                                                )}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="resume-bullet-action-btn resume-bullet-delete-btn"
                                                                onClick={() => removeBullet(section.id, item.id, bullet.id)}
                                                                title="Delete bullet"
                                                                aria-label="Delete bullet"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                            </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isEnhancing && (
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '4px 8px',
                                                            background: '#eff6ff',
                                                            border: '1px solid #bfdbfe',
                                                            borderRadius: '5px',
                                                            fontSize: '11px',
                                                            color: '#1d4ed8',
                                                            lineHeight: 1.4,
                                                        }}>
                                                            <Loader2 size={11} className="animate-spin" />
                                                            <span>Enhancing this bullet...</span>
                                                        </div>
                                                    )}
                                                    {enhanceError && (
                                                        <div style={{
                                                            padding: '4px 8px',
                                                            background: '#fef2f2',
                                                            border: '1px solid #fecaca',
                                                            borderRadius: '5px',
                                                            fontSize: '11px',
                                                            color: '#b91c1c',
                                                            lineHeight: 1.4,
                                                        }}>
                                                            {enhanceError}
                                                        </div>
                                                    )}
                                                    {/* Metric / scope suggestion hint */}
                                                    {bullet.suggestion && (
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            gap: '5px',
                                                            padding: '4px 8px',
                                                            background: '#fefce8',
                                                            border: '1px solid #fde68a',
                                                            borderRadius: '5px',
                                                            fontSize: '11px',
                                                            color: '#92400e',
                                                            lineHeight: 1.4,
                                                        }}>
                                                            <Lightbulb size={11} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
                                                            <span>{bullet.suggestion}</span>
                                                        </div>
                                                    )}
                                                    </div>
                                                        );
                                                    })()
                                                ))}
                                                <button
                                                    onClick={() => addBullet(section.id, item.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 12px',
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        color: '#2563eb',
                                                        background: '#e8f4ff',
                                                        border: '1px solid #bfdbfe',
                                                        borderRadius: '20px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        alignSelf: 'flex-start'
                                                    }}
                                                    onMouseOver={(e) => {
                                                        e.currentTarget.style.background = '#dbeafe';
                                                    }}
                                                    onMouseOut={(e) => {
                                                        e.currentTarget.style.background = '#e8f4ff';
                                                    }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                    Add Bullet
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => addSectionItem(section.id, section.type)}
                                        style={{
                                            width: '100%',
                                            padding: '14px 20px',
                                            border: '2px dashed #bfdbfe',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: '#2563eb',
                                            background: '#eff6ff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.borderColor = '#2563eb';
                                            e.currentTarget.style.background = '#dbeafe';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.15)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.borderColor = '#bfdbfe';
                                            e.currentTarget.style.background = '#eff6ff';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.08)';
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Add Title
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
            </>)}
            </SortableSectionCard>
            ))}
                </SortableContext>
            </DndContext>
            <style jsx global>{`
                .resume-ai-enhance-btn {
                    --ai-size: 0.43;
                    --ai-h: calc(64px * var(--ai-size));
                    --ai-pad-x: calc(28px * var(--ai-size));
                    --ai-gap: calc(10px * var(--ai-size));
                    --ai-radius: calc(var(--ai-h) / 2);
                    --ai-border: max(2.5px, calc(5px * var(--ai-size)));
                    --ai-font: calc(24px * var(--ai-size));
                    --ai-c1: #00c2ff;
                    --ai-c2: #3bdcc6;
                    --ai-c3: #b6ee3a;
                    --ai-c4: #f6e94a;
                    --ai-angle: 135deg;
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--ai-gap);
                    height: var(--ai-h);
                    min-width: calc(112px * var(--ai-size));
                    padding: 0 var(--ai-pad-x);
                    border-radius: var(--ai-radius);
                    background: #ffffff;
                    border: 0;
                    font: 700 var(--ai-font)/1 Inter, system-ui, sans-serif;
                    letter-spacing: 0;
                    color: #0b0b0f;
                    isolation: isolate;
                    flex-shrink: 0;
                    box-shadow:
                        0 1px 0 rgba(255,255,255,.9) inset,
                        0 10px 22px -12px rgba(20,40,60,.18),
                        0 2px 4px rgba(20,40,60,.06);
                    transition: transform .35s cubic-bezier(.2,.7,.2,1), box-shadow .35s ease, opacity .2s ease;
                }

                .resume-ai-enhance-btn::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    padding: var(--ai-border);
                    background: linear-gradient(var(--ai-angle), var(--ai-c1), var(--ai-c2), var(--ai-c3), var(--ai-c4));
                    background-size: 300% 300%;
                    -webkit-mask:
                        linear-gradient(#000 0 0) content-box,
                        linear-gradient(#000 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    pointer-events: none;
                    z-index: 1;
                    animation: resume-ai-border-flow 5s ease-in-out infinite;
                }

                .resume-ai-enhance-btn::after {
                    content: "";
                    position: absolute;
                    inset: calc(var(--ai-border) * -1);
                    border-radius: inherit;
                    background: linear-gradient(var(--ai-angle), var(--ai-c1), var(--ai-c3));
                    filter: blur(10px);
                    opacity: 0;
                    transition: opacity .35s ease;
                    z-index: -1;
                }

                .resume-ai-enhance-btn:not(:disabled):hover {
                    box-shadow:
                        0 1px 0 rgba(255,255,255,.9) inset,
                        0 16px 28px -14px rgba(20,40,60,.22),
                        0 3px 6px rgba(20,40,60,.08);
                }

                .resume-ai-enhance-btn:not(:disabled):hover::after,
                .resume-ai-enhance-btn.is-loading::after {
                    opacity: .35;
                }

                .resume-ai-enhance-btn:active {
                    transform: none;
                }

                .resume-ai-enhance-btn:focus-visible {
                    outline: 2px solid #0b0b0f;
                    outline-offset: 3px;
                }

                .resume-ai-enhance-btn:disabled {
                    box-shadow: none;
                }

                .resume-ai-enhance-btn > * {
                    position: relative;
                    z-index: 2;
                }

                .resume-ai-enhance-spark {
                    width: calc(var(--ai-font) * .95);
                    height: calc(var(--ai-font) * .95);
                    flex: none;
                    transform-origin: center;
                    transition: filter .25s ease, opacity .25s ease;
                }

                .resume-ai-enhance-btn:not(:disabled):hover .resume-ai-enhance-spark {
                    animation: resume-ai-spark-twinkle 1.45s ease-in-out infinite;
                }

                @keyframes resume-ai-border-flow {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                @keyframes resume-ai-spark-twinkle {
                    0%, 100% {
                        opacity: 1;
                        filter: drop-shadow(0 0 0 rgba(11, 11, 15, 0));
                    }
                    34% {
                        opacity: .72;
                        filter: drop-shadow(0 0 2px rgba(59, 220, 198, .18));
                    }
                    58% {
                        opacity: 1;
                        filter: drop-shadow(0 0 5px rgba(182, 238, 58, .38));
                    }
                    76% {
                        opacity: .86;
                        filter: drop-shadow(0 0 2px rgba(0, 194, 255, .28));
                    }
                }

                .resume-bullet-action-btn {
                    width: 26px;
                    height: 26px;
                    padding: 0;
                    border: 1px solid transparent;
                    border-radius: 999px;
                    background: transparent;
                    cursor: pointer;
                    transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .resume-bullet-action-btn:hover {
                    background: #f8fafc;
                    border-color: #e2e8f0;
                    color: #64748b !important;
                    transform: translateY(-1px);
                }

                .resume-bullet-delete-btn {
                    color: #ef4444;
                }

                .resume-bullet-delete-btn:hover {
                    background: #fef2f2;
                    border-color: #fecaca;
                    color: #dc2626 !important;
                }
            `}</style>
            {/* Delete Confirmation Modal */}
            {bulletToDelete && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(2px)'
                }}>
                    <div style={{
                        background: '#fff',
                        padding: '24px',
                        borderRadius: '16px',
                        width: '320px',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '24px',
                            background: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            color: '#ef4444'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                        </div>
                        <h4 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Delete Bullet?</h4>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>Are you sure you want to remove this bullet point? This action cannot be undone.</p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setBulletToDelete(null)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    background: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#374151',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteBullet}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#ef4444',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
