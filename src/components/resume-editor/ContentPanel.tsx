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

    const updateSkills = (category: 'languages' | 'frameworks' | 'tools' | 'databases', value: string) => {
        onChange({
            ...resume,
            skills: {
                ...resume.skills,
                [category]: value.split(',').map(s => s.trim()).filter(Boolean),
            },
            updatedAt: new Date().toISOString(),
        });
    };

    return (
        <div className="content-panel" style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            background: 'var(--background-secondary)',
            borderRight: '1px solid var(--border)',
        }}>
            {/* Contact Info Section */}
            <div className="section-card" style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '12px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600 }}>👤 Contact Info</h3>
                    <button
                        onClick={() => setEditingContact(!editingContact)}
                        className="btn btn-ghost"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                        {editingContact ? 'Done' : 'Edit'}
                    </button>
                </div>

                {editingContact ? (
                    <div style={{ display: 'grid', gap: '8px' }}>
                        <input
                            type="text"
                            value={resume.contact.name}
                            onChange={(e) => updateContact('name', e.target.value)}
                            placeholder="Name"
                            className="input"
                            style={{ fontSize: '13px' }}
                        />
                        <input
                            type="email"
                            value={resume.contact.email}
                            onChange={(e) => updateContact('email', e.target.value)}
                            placeholder="Email"
                            className="input"
                            style={{ fontSize: '13px' }}
                        />
                        <input
                            type="tel"
                            value={resume.contact.phone}
                            onChange={(e) => updateContact('phone', e.target.value)}
                            placeholder="Phone"
                            className="input"
                            style={{ fontSize: '13px' }}
                        />
                        <input
                            type="text"
                            value={resume.contact.linkedin}
                            onChange={(e) => updateContact('linkedin', e.target.value)}
                            placeholder="LinkedIn URL"
                            className="input"
                            style={{ fontSize: '13px' }}
                        />
                        <input
                            type="text"
                            value={resume.contact.github.join(', ')}
                            onChange={(e) => updateContact('github', e.target.value.split(',').map(s => s.trim()))}
                            placeholder="GitHub URLs (comma-separated)"
                            className="input"
                            style={{ fontSize: '13px' }}
                        />
                    </div>
                ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <p><strong>{resume.contact.name}</strong></p>
                        <p>{resume.contact.email} • {resume.contact.phone}</p>
                        <p>{resume.contact.linkedin}</p>
                    </div>
                )}
            </div>

            {/* Resume Sections */}
            {resume.sections.map((section) => (
                <div
                    key={section.id}
                    className="section-card"
                    style={{
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        marginBottom: '12px',
                    }}
                >
                    {/* Section Header */}
                    <div
                        onClick={() => toggleSection(section.id)}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ transform: collapsedSections.has(section.id) ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                            {section.type === 'education' && '🎓'}
                            {section.type === 'experience' && '💼'}
                            {section.type === 'projects' && '🚀'}
                            {section.type === 'community' && '🤝'}
                            {section.type === 'skills' && '🛠️'}
                            {section.title}
                        </h3>
                        <span className="badge" style={{ fontSize: '11px' }}>
                            {section.items.length} items
                        </span>
                    </div>

                    {/* Section Content */}
                    {!collapsedSections.has(section.id) && (
                        <div style={{ marginTop: '12px' }}>
                            {section.type === 'skills' ? (
                                // Skills section - special rendering
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Languages</label>
                                        <input
                                            type="text"
                                            value={resume.skills.languages.join(', ')}
                                            onChange={(e) => updateSkills('languages', e.target.value)}
                                            className="input"
                                            style={{ fontSize: '12px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Frameworks</label>
                                        <input
                                            type="text"
                                            value={resume.skills.frameworks.join(', ')}
                                            onChange={(e) => updateSkills('frameworks', e.target.value)}
                                            className="input"
                                            style={{ fontSize: '12px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tools</label>
                                        <input
                                            type="text"
                                            value={resume.skills.tools.join(', ')}
                                            onChange={(e) => updateSkills('tools', e.target.value)}
                                            className="input"
                                            style={{ fontSize: '12px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Databases</label>
                                        <input
                                            type="text"
                                            value={resume.skills.databases.join(', ')}
                                            onChange={(e) => updateSkills('databases', e.target.value)}
                                            className="input"
                                            style={{ fontSize: '12px' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                // Regular section items
                                <>
                                    {section.items.map((item) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                borderLeft: '3px solid var(--accent)',
                                                paddingLeft: '12px',
                                                marginBottom: '16px',
                                            }}
                                        >
                                            <div style={{ display: 'grid', gap: '6px', marginBottom: '8px' }}>
                                                <input
                                                    type="text"
                                                    value={item.title}
                                                    onChange={(e) => updateSectionItem(section.id, item.id, { title: e.target.value })}
                                                    placeholder="Title"
                                                    className="input"
                                                    style={{ fontSize: '13px', fontWeight: 600 }}
                                                />
                                                {item.subtitle !== undefined && (
                                                    <input
                                                        type="text"
                                                        value={item.subtitle || ''}
                                                        onChange={(e) => updateSectionItem(section.id, item.id, { subtitle: e.target.value })}
                                                        placeholder="Subtitle"
                                                        className="input"
                                                        style={{ fontSize: '12px' }}
                                                    />
                                                )}
                                                <input
                                                    type="text"
                                                    value={item.dates || ''}
                                                    onChange={(e) => updateSectionItem(section.id, item.id, { dates: e.target.value })}
                                                    placeholder="Dates"
                                                    className="input"
                                                    style={{ fontSize: '12px' }}
                                                />
                                                {item.technologies !== undefined && (
                                                    <input
                                                        type="text"
                                                        value={item.technologies || ''}
                                                        onChange={(e) => updateSectionItem(section.id, item.id, { technologies: e.target.value })}
                                                        placeholder="Technologies"
                                                        className="input"
                                                        style={{ fontSize: '12px', fontStyle: 'italic' }}
                                                    />
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => deleteSectionItem(section.id, item.id)}
                                                        className="btn btn-ghost"
                                                        style={{ fontSize: '11px', color: 'var(--error)', padding: '2px 6px' }}
                                                    >
                                                        Delete Item
                                                    </button>
                                                </div>

                                                {/* Link Input for Projects */}
                                                {section.type === 'projects' && (
                                                    <div style={{ marginTop: '4px' }}>
                                                        <input
                                                            type="text"
                                                            value={item.links?.[0]?.url || ''}
                                                            onChange={(e) => {
                                                                const newLinks = e.target.value
                                                                    ? [{ label: item.links?.[0]?.label || 'View Project', url: e.target.value }]
                                                                    : [];
                                                                updateSectionItem(section.id, item.id, { links: newLinks });
                                                            }}
                                                            placeholder="Project Link (e.g. www.example.com)"
                                                            className="input"
                                                            style={{ fontSize: '12px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Bullets */}
                                            <div style={{ marginLeft: '8px' }}>
                                                {(item.bullets || []).map((bullet) => (
                                                    <div
                                                        key={bullet.id}
                                                        style={{
                                                            display: 'flex',
                                                            gap: '8px',
                                                            alignItems: 'flex-start',
                                                            marginBottom: '6px',
                                                            background: bullet.isSuggested ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                                                            padding: bullet.isSuggested ? '4px' : '0',
                                                            borderRadius: '4px',
                                                        }}
                                                    >
                                                        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>•</span>
                                                        <textarea
                                                            value={bullet.text}
                                                            onChange={(e) => updateBullet(section.id, item.id, bullet.id, e.target.value)}
                                                            className="input"
                                                            style={{
                                                                flex: 1,
                                                                fontSize: '12px',
                                                                minHeight: '40px',
                                                                resize: 'vertical',
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => removeBullet(section.id, item.id, bullet.id)}
                                                            className="btn btn-ghost"
                                                            style={{ padding: '4px', color: 'var(--error)' }}
                                                            title="Remove bullet"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addBullet(section.id, item.id)}
                                                    className="btn btn-ghost"
                                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                                >
                                                    + Add Bullet
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => addSectionItem(section.id, section.type)}
                                        className="btn btn-secondary"
                                        style={{ width: '100%', fontSize: '12px', marginTop: '8px' }}
                                    >
                                        + Add {section.type === 'education' ? 'School' :
                                            section.type === 'experience' ? 'Job' :
                                                section.type === 'projects' ? 'Project' :
                                                    section.type === 'community' ? 'Involvement' : 'Item'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
