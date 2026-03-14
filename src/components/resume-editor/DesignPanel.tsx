/**
 * DesignPanel - Design controls for resume customization
 * Features: Template selector, font family, font size, accent color, margins, and template picker modal
 */

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TailoredResumeData, ResumeDesign } from '@/types';
import { AVAILABLE_FONTS, ACCENT_COLORS, TEMPLATE_META } from '@/lib/resume-templates';
import { Palette, LayoutTemplate, Type, Maximize2, X, Check } from 'lucide-react';

interface DesignPanelProps {
    design: ResumeDesign;
    onChange: (design: ResumeDesign) => void;
    onReset: () => void;
}

export function DesignPanel({ design, onChange, onReset }: DesignPanelProps) {
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const updateDesign = (field: keyof ResumeDesign, value: any) => {
        onChange({ ...design, [field]: value });
    };

    const updateMargin = (side: 'top' | 'right' | 'bottom' | 'left', value: number) => {
        onChange({
            ...design,
            margins: { ...design.margins, [side]: value },
        });
    };

    // Helper to change template and reset to its default font/color
    const selectTemplate = (templateId: string) => {
        const meta = TEMPLATE_META.find(t => t.id === templateId);
        if (meta) {
            onChange({
                ...design,
                template: templateId as any,
                fontFamily: meta.defaultFont,
                accentColor: meta.defaultAccent
            });
        } else {
            updateDesign('template', templateId);
        }
        setIsTemplateModalOpen(false);
    };

    const currentTemplateMeta = TEMPLATE_META.find(t => t.id === design.template) || TEMPLATE_META[0];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e6e9ee', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                                <Palette size={18} />
                            </div>
                            Design Settings
                        </h2>
                        <p style={{ marginTop: '6px', fontSize: '12px', fontWeight: 500, color: '#64748b' }}>
                            Personalize your resume's aesthetic.
                        </p>
                    </div>
                    {/* Applied Template Indicator */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: '#eff6ff',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#3b82f6'
                    }}>
                        <span>Applied:</span>
                        <span>{currentTemplateMeta.name}</span>
                    </div>
                </div>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                
                {/* Visual Template Selector */}
                <div className="form-group" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e6e9ee', boxShadow: '0 4px 10px rgba(11,24,40,0.04)', padding: '16px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#1e293b' }}>
                        <LayoutTemplate size={16} /> Template
                    </label>
                    
                    {/* Current Template Card */}
                    <div style={{
                        border: '1px solid #e6e9ee',
                        borderRadius: '8px',
                        padding: '16px',
                        background: '#f8fafc',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{currentTemplateMeta.name}</h3>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                    {currentTemplateMeta.tags.map(tag => (
                                        <span key={tag} style={{
                                            fontSize: '11px', padding: '2px 8px', background: '#f1f5f9', 
                                            border: '1px solid #e2e8f0', borderRadius: '4px', color: '#64748b'
                                        }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                            {currentTemplateMeta.description}
                        </p>
                        <button 
                            onClick={() => setIsTemplateModalOpen(true)}
                            style={{ 
                                width: '100%', 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                gap: '6px',
                                padding: '10px 16px',
                                background: '#fff',
                                border: '1px solid #e6e9ee',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#475569',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.borderColor = '#e6e9ee';
                            }}
                        >
                            <Maximize2 size={14} /> Browse Templates
                        </button>
                    </div>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid #e6e9ee', margin: 0 }} />

                {/* Typography Settings */}
                <div className="form-group" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e6e9ee', boxShadow: '0 4px 10px rgba(11,24,40,0.04)', padding: '16px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#1e293b' }}>
                        <Type size={16} /> Typography
                    </label>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', display: 'block', marginBottom: '6px' }}>Font Family</label>
                            <select
                                value={design.fontFamily}
                                onChange={(e) => updateDesign('fontFamily', e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    fontSize: '13px',
                                    padding: '10px 12px',
                                    border: '1px solid #e6e9ee',
                                    borderRadius: '8px',
                                    background: '#fff',
                                    color: '#1e293b',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {AVAILABLE_FONTS.map(font => (
                                    <option key={font.value} value={font.value}>{font.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Font Size</label>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>{design.fontSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="9"
                                max="14"
                                step="0.5"
                                value={design.fontSize}
                                onChange={(e) => updateDesign('fontSize', parseFloat(e.target.value))}
                                style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                <span>Small (9px)</span>
                                <span>Large (14px)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid #e6e9ee', margin: 0 }} />

                {/* Color Settings */}
                <div className="form-group" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e6e9ee', boxShadow: '0 4px 10px rgba(11,24,40,0.04)', padding: '16px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#1e293b' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: design.accentColor, border: '1px solid #e6e9ee' }} /> 
                        Accent Color
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {ACCENT_COLORS.map(color => {
                            const isSelected = design.accentColor === color.value;
                            return (
                                <button
                                    key={color.value}
                                    onClick={() => updateDesign('accentColor', color.value)}
                                    title={color.label}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        background: color.value,
                                        border: isSelected ? '2px solid #fff' : '1px solid #e6e9ee',
                                        outline: isSelected ? '2px solid #3b82f6' : 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        transition: 'all 0.2s',
                                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                                    }}
                                >
                                    {isSelected && <Check size={16} />}
                                </button>
                            );
                        })}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid #e6e9ee' }}>
                            <input
                                type="color"
                                value={design.accentColor}
                                onChange={(e) => updateDesign('accentColor', e.target.value)}
                                title="Custom color"
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    padding: '0',
                                    border: '1px solid #e6e9ee',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    background: 'none'
                                }}
                            />
                        </div>
                    </div>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid #e6e9ee', margin: 0 }} />

                {/* Margins */}
                <div className="form-group" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e6e9ee', boxShadow: '0 4px 10px rgba(11,24,40,0.04)', padding: '16px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#1e293b' }}>
                        <Maximize2 size={16} /> Page Margins (inches)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {(['top', 'bottom', 'left', 'right'] as const).map(side => (
                            <div key={side}>
                                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', textTransform: 'capitalize' }}>{side}</label>
                                <input
                                    type="number"
                                    min="0.25"
                                    max="1.5"
                                    step="0.125"
                                    value={design.margins[side]}
                                    onChange={(e) => updateMargin(side, parseFloat(e.target.value))}
                                    style={{ 
                                        width: '100%', 
                                        fontSize: '13px',
                                        padding: '8px 12px',
                                        border: '1px solid #e6e9ee',
                                        borderRadius: '8px',
                                        background: '#fff',
                                        color: '#1e293b',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Reset Button */}
                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                    <button 
                        onClick={onReset} 
                        style={{ 
                            width: '100%', 
                            padding: '10px 16px',
                            background: '#fff',
                            border: '1px solid #e6e9ee',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.color = '#475569';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.borderColor = '#e6e9ee';
                            e.currentTarget.style.color = '#64748b';
                        }}
                    >
                        Reset Design to Defaults
                    </button>
                </div>
            </div>

            {isMounted && isTemplateModalOpen && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                    background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(6px)'
                }}>
                    <div 
                        style={{
                            background: '#fff', borderRadius: '12px', 
                            width: '90%', maxWidth: '900px', maxHeight: '90vh',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 20px 60px rgba(12,24,40,0.35)',
                            overflow: 'hidden', border: '1px solid #e6e9ee'
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e6e9ee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexShrink: 0 }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59,130,246,0.15)' }}>
                                        <LayoutTemplate size={20} />
                                    </div>
                                    Select Your Resume Template
                                </h2>
                                <p style={{ marginTop: '4px', marginLeft: '52px', fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Choose a layout optimized for your career level and target industry.</p>
                            </div>
                            <button 
                                onClick={() => setIsTemplateModalOpen(false)}
                                style={{
                                    width: '40px', height: '40px', borderRadius: '8px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#94a3b8', background: 'transparent', border: 'none',
                                    cursor: 'pointer', transition: 'all 0.2s ease'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.color = '#64748b';
                                    e.currentTarget.style.background = '#f1f5f9';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.color = '#94a3b8';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content - Scrollable Grid */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
                            <div 
                                className="template-grid"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '20px'
                                }}
                            >
                                {TEMPLATE_META.map((template) => {
                                    const isSelected = template.id === design.template;
                                    return (
                                        <div 
                                            key={template.id}
                                            onClick={() => selectTemplate(template.id)}
                                            style={{
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                background: '#fff',
                                                borderRadius: '12px',
                                                border: isSelected ? '2px solid #3b82f6' : '1px solid #e6e9ee',
                                                transition: 'all 0.12s ease',
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                                boxShadow: isSelected ? '0 8px 30px rgba(59,130,246,0.2)' : '0 2px 8px rgba(0,0,0,0.04)'
                                            }}
                                            onMouseOver={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.transform = 'translateY(-6px)';
                                                    e.currentTarget.style.boxShadow = '0 14px 40px rgba(12,24,40,0.18)';
                                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                                }
                                            }}
                                            onMouseOut={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                                                    e.currentTarget.style.borderColor = '#e6e9ee';
                                                }
                                            }}
                                        >
                                            {/* Template Preview Section */}
                                            <div style={{
                                                height: '180px',
                                                background: '#f8fafc',
                                                overflow: 'hidden',
                                                position: 'relative',
                                                borderBottom: '1px solid #f1f5f9',
                                                padding: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    transform: 'scale(1.02)',
                                                    transition: 'transform 0.3s ease',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                    borderRadius: '6px',
                                                    overflow: 'hidden',
                                                    background: '#fff'
                                                }}>
                                                    {template.id === 'classic' && (
                                                        <img src="/templates/classic.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} alt="Classic Template" />
                                                    )}
                                                    {template.id === 'modern' && (
                                                        <img src="/templates/modern.png" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} alt="Modern Template" />
                                                    )}
                                                    {template.id === 'executive' && (
                                                        <img src="/templates/executive.png" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} alt="Executive Template" />
                                                    )}
                                                    {template.id === 'professional' && (
                                                        <img src="/templates/professional.png" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} alt="Professional Template" />
                                                    )}
                                                    {template.id === 'minimal' && (
                                                        <img src="/templates/minimal.png" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} alt="Minimal Template" />
                                                    )}
                                                </div>

                                                {/* Hover Overlay */}
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    background: 'linear-gradient(to top, rgba(59,130,246,0.6), rgba(59,130,246,0.2))',
                                                    opacity: 0,
                                                    transition: 'all 0.3s ease',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <div style={{
                                                        background: '#fff', color: '#3b82f6', fontWeight: 700,
                                                        padding: '10px 24px', borderRadius: '8px',
                                                        boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                                                        transform: 'translateY(8px)',
                                                        transition: 'all 0.3s ease'
                                                    }}>
                                                        Apply Template
                                                    </div>
                                                </div>

                                                {/* Selected Badge */}
                                                {isSelected && (
                                                    <div style={{
                                                        position: 'absolute', top: '12px', right: '12px',
                                                        background: '#3b82f6', color: '#fff',
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: '0 4px 12px rgba(59,130,246,0.4)'
                                                    }}>
                                                        <Check size={18} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Template Info Section */}
                                            <div style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                    <div>
                                                        <h3 style={{ 
                                                            fontSize: '16px', 
                                                            fontWeight: 700, 
                                                            color: isSelected ? '#3b82f6' : '#1e293b',
                                                            margin: 0,
                                                            transition: 'color 0.2s ease'
                                                        }}>{template.name}</h3>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                                            {template.tags.map(tag => (
                                                                <span key={tag} style={{ 
                                                                    fontSize: '10px', 
                                                                    fontWeight: 600, 
                                                                    padding: '3px 8px', 
                                                                    background: '#f1f5f9', 
                                                                    color: '#64748b', 
                                                                    borderRadius: '4px',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.5px'
                                                                }}>{tag}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <p style={{ 
                                                    fontSize: '13px', 
                                                    color: '#64748b', 
                                                    lineHeight: 1.5, 
                                                    fontWeight: 500,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    margin: 0
                                                }}>
                                                    {template.description}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #e6e9ee', display: 'flex', justifyContent: 'flex-end', background: '#fff', flexShrink: 0 }}>
                            <button
                                onClick={() => setIsTemplateModalOpen(false)}
                                style={{
                                    padding: '10px 20px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#64748b',
                                    background: '#fff',
                                    border: '1px solid #e6e9ee',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>, 
                document.body
            )}
        </div>
    );
}
