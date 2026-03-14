/**
 * ContentPanel - Left panel for editing resume sections
 * Features: Collapsible sections, drag-and-drop reordering, inline editing
 */

'use client';

import { useState } from 'react';
import type {
    TailoredResumeData,
    ResumeSection,
    ResumeSectionItem,
    ResumeBullet,
    ResumeContactInfo,
} from '@/types';

interface ContentPanelProps {
    resume: TailoredResumeData;
    onChange: (resume: TailoredResumeData) => void;
}

export function ContentPanel({ resume, onChange }: ContentPanelProps) {
    const [editingContact, setEditingContact] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

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

    const updateContact = (field: keyof ResumeContactInfo, value: string | string[]) => {
        onChange({
            ...resume,
            contact: { ...resume.contact, [field]: value },
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

    const updateSkills = (category: string, value: string) => {
        onChange({
            ...resume,
            skills: {
                ...resume.skills,
                [category]: value.split(',').map(s => s.trim()).filter(Boolean),
            },
            updatedAt: new Date().toISOString(),
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
                <div>
                    <textarea
                        value={resume.summary || ''}
                        onChange={(e) => updateSummary(e.target.value)}
                        placeholder="Write a compelling professional summary that highlights your best skills and experiences..."
                        style={{ 
                            width: '100%', 
                            background: '#ffffff', 
                            border: '1px solid #e5e7eb', 
                            borderRadius: '10px', 
                            padding: '10px 12px', 
                            fontSize: '14px', 
                            fontWeight: 400,
                            outline: 'none',
                            transition: 'all 0.15s ease',
                            minHeight: '120px',
                            lineHeight: 1.6,
                            color: '#111827',
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
                        }}
                    />
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
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</label>
                            <input
                                type="text"
                                value={resume.contact.name}
                                onChange={(e) => updateContact('name', e.target.value)}
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
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</label>
                            <input
                                type="email"
                                value={resume.contact.email}
                                onChange={(e) => updateContact('email', e.target.value)}
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
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</label>
                            <input
                                type="tel"
                                value={resume.contact.phone}
                                onChange={(e) => updateContact('phone', e.target.value)}
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
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LinkedIn Profile</label>
                            <input
                                type="text"
                                value={resume.contact.linkedin}
                                onChange={(e) => updateContact('linkedin', e.target.value)}
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
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</label>
                            <input
                                type="text"
                                value={resume.contact.location || ''}
                                onChange={(e) => updateContact('location', e.target.value)}
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
                                    transition: 'all 0.15s ease'
                                }}
                                placeholder="e.g. New York, NY"
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
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Website</label>
                            <input
                                type="url"
                                value={resume.contact.website || ''}
                                onChange={(e) => updateContact('website', e.target.value)}
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
                                    transition: 'all 0.15s ease'
                                }}
                                placeholder="https://"
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
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GitHub URLs</label>
                            <input
                                type="text"
                                value={resume.contact.github?.join(', ') || ''}
                                onChange={(e) => updateContact('github', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
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
                                    transition: 'all 0.15s ease'
                                }}
                                placeholder="Comma separated links"
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
            {resume.sections.map((section) => (
                <div
                    key={section.id}
                    className="section-card"
                    style={{ 
                        background: '#ffffff', 
                        borderRadius: '10px', 
                        border: '1px solid #e8ebef', 
                        boxShadow: '0 3px 10px rgba(0,0,0,0.03)', 
                        overflow: 'hidden',
                        transition: 'all 0.15s ease'
                    }}
                >
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
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
                                                value={Array.isArray(items) ? items.join(', ') : ''}
                                                onChange={(e) => updateSkills(category, e.target.value)}
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
                                                    <div
                                                        key={bullet.id}
                                                        style={{ 
                                                            display: 'flex', 
                                                            gap: '8px', 
                                                            padding: '6px 8px',
                                                            borderRadius: '6px',
                                                            background: bullet.isSuggested ? '#fffbeb' : '#f9fafb',
                                                            border: bullet.isSuggested ? '1px dashed #fcd34d' : '1px solid transparent',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#9ca3af', marginTop: '6px', flexShrink: 0 }}></div>
                                                        <textarea
                                                            value={bullet.text}
                                                            onChange={(e) => updateBullet(section.id, item.id, bullet.id, e.target.value)}
                                                            style={{ 
                                                                flex: 1, 
                                                                background: 'transparent', 
                                                                border: 'none', 
                                                                padding: '0',
                                                                fontSize: '13px', 
                                                                fontWeight: 400, 
                                                                color: '#4b5563',
                                                                outline: 'none',
                                                                resize: 'none',
                                                                lineHeight: 1.5,
                                                                fontFamily: 'inherit'
                                                            }}
                                                            rows={1}
                                                        />
                                                        <button
                                                            onClick={() => removeBullet(section.id, item.id, bullet.id)}
                                                            style={{
                                                                padding: '2px',
                                                                color: '#d1d5db',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                borderRadius: '2px',
                                                                cursor: 'pointer',
                                                                opacity: 0,
                                                                transition: 'all 0.15s ease',
                                                                flexShrink: 0
                                                            }}
                                                            onMouseOver={(e) => {
                                                                e.currentTarget.style.color = '#ef4444';
                                                                e.currentTarget.style.opacity = '1';
                                                            }}
                                                            onMouseOut={(e) => {
                                                                e.currentTarget.style.color = '#d1d5db';
                                                                e.currentTarget.style.opacity = '0';
                                                            }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addBullet(section.id, item.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 10px',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        color: '#9ca3af',
                                                        background: '#f3f4f6',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        alignSelf: 'flex-start'
                                                    }}
                                                    onMouseOver={(e) => {
                                                        e.currentTarget.style.background = '#e5e7eb';
                                                        e.currentTarget.style.color = '#3b82f6';
                                                    }}
                                                    onMouseOut={(e) => {
                                                        e.currentTarget.style.background = '#f3f4f6';
                                                        e.currentTarget.style.color = '#9ca3af';
                                                    }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                    Add Achievement
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => addSectionItem(section.id, section.type)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '2px dashed #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: '#9ca3af',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.borderColor = '#3b82f6';
                                            e.currentTarget.style.color = '#3b82f6';
                                            e.currentTarget.style.background = '#f0f9ff';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.color = '#9ca3af';
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Add {section.type === 'education' ? 'School' :
                                            section.type === 'experience' ? 'Position' :
                                                section.type === 'projects' ? 'Project' :
                                                    section.type === 'community' ? 'Experience' : 'Entry'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
