/**
 * DesignPanel - Design controls for resume customization
 * Features: Template selector, font family, font size, accent color, margins
 */

'use client';

import type { TailoredResumeData, ResumeDesign } from '@/types';
import { AVAILABLE_FONTS, ACCENT_COLORS } from '@/lib/resume-templates';

interface DesignPanelProps {
    design: ResumeDesign;
    onChange: (design: ResumeDesign) => void;
    onReset: () => void;
}

export function DesignPanel({ design, onChange, onReset }: DesignPanelProps) {
    const updateDesign = (field: keyof ResumeDesign, value: any) => {
        onChange({ ...design, [field]: value });
    };

    const updateMargin = (side: 'top' | 'right' | 'bottom' | 'left', value: number) => {
        onChange({
            ...design,
            margins: { ...design.margins, [side]: value },
        });
    };

    return (
        <div className="design-panel" style={{
            padding: '16px',
            display: 'grid',
            gap: '16px',
        }}>
            {/* Template Selection */}
            <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Template
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => updateDesign('template', 'classic')}
                        className={`btn ${design.template === 'classic' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, fontSize: '12px' }}
                    >
                        📜 Classic
                    </button>
                    <button
                        onClick={() => updateDesign('template', 'modern')}
                        className={`btn ${design.template === 'modern' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, fontSize: '12px' }}
                    >
                        ✨ Modern
                    </button>
                </div>
            </div>

            {/* Font Family */}
            <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Font Family
                </label>
                <select
                    value={design.fontFamily}
                    onChange={(e) => updateDesign('fontFamily', e.target.value)}
                    className="input"
                    style={{ width: '100%', fontSize: '12px' }}
                >
                    {AVAILABLE_FONTS.map(font => (
                        <option key={font.value} value={font.value}>
                            {font.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Font Size */}
            <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Font Size: {design.fontSize}px
                </label>
                <input
                    type="range"
                    min="9"
                    max="14"
                    step="0.5"
                    value={design.fontSize}
                    onChange={(e) => updateDesign('fontSize', parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    <span>9px</span>
                    <span>14px</span>
                </div>
            </div>

            {/* Accent Color */}
            <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Accent Color
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {ACCENT_COLORS.map(color => (
                        <button
                            key={color.value}
                            onClick={() => updateDesign('accentColor', color.value)}
                            title={color.label}
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: color.value,
                                border: design.accentColor === color.value
                                    ? '3px solid var(--accent)'
                                    : '2px solid var(--border)',
                                cursor: 'pointer',
                            }}
                        />
                    ))}
                    <input
                        type="color"
                        value={design.accentColor}
                        onChange={(e) => updateDesign('accentColor', e.target.value)}
                        title="Custom color"
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    />
                </div>
            </div>

            {/* Margins */}
            <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Margins (inches)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Top</label>
                        <input
                            type="number"
                            min="0.25"
                            max="1.5"
                            step="0.125"
                            value={design.margins.top}
                            onChange={(e) => updateMargin('top', parseFloat(e.target.value))}
                            className="input"
                            style={{ fontSize: '12px' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Bottom</label>
                        <input
                            type="number"
                            min="0.25"
                            max="1.5"
                            step="0.125"
                            value={design.margins.bottom}
                            onChange={(e) => updateMargin('bottom', parseFloat(e.target.value))}
                            className="input"
                            style={{ fontSize: '12px' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Left</label>
                        <input
                            type="number"
                            min="0.25"
                            max="1.5"
                            step="0.125"
                            value={design.margins.left}
                            onChange={(e) => updateMargin('left', parseFloat(e.target.value))}
                            className="input"
                            style={{ fontSize: '12px' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Right</label>
                        <input
                            type="number"
                            min="0.25"
                            max="1.5"
                            step="0.125"
                            value={design.margins.right}
                            onChange={(e) => updateMargin('right', parseFloat(e.target.value))}
                            className="input"
                            style={{ fontSize: '12px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Reset Button */}
            <button
                onClick={onReset}
                className="btn btn-ghost"
                style={{ fontSize: '12px', marginTop: '8px' }}
            >
                🔄 Reset Design
            </button>
        </div>
    );
}
