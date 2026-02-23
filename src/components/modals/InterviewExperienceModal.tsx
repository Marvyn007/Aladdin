'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InterviewExperienceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialCompany?: string | null;
}

export function InterviewExperienceModal({ isOpen, onClose, onSuccess, initialCompany = null }: InterviewExperienceModalProps) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);

    // Form State
    const [companyName, setCompanyName] = useState(initialCompany || '');
    const [role, setRole] = useState('');
    const [location, setLocation] = useState('');
    const [workOption, setWorkOption] = useState<'Onsite' | 'Remote' | 'Hybrid'>('Onsite');
    const [offerStatus, setOfferStatus] = useState<'Yes' | 'No' | 'Pending'>('No');
    const [salaryHourly, setSalaryHourly] = useState<number | ''>('');
    const [appliedDate, setAppliedDate] = useState('');
    const [offerDate, setOfferDate] = useState('');
    const [processSteps, setProcessSteps] = useState([{ date: '', step: 'OA', type: 'Algorithms', durationMinutes: 10 }]);
    const [interviewDetails, setInterviewDetails] = useState<Record<string, string>>({});
    const [additionalComments, setAdditionalComments] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen && initialCompany) {
            setCompanyName(initialCompany);
        }
    }, [isOpen, initialCompany]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    if (!isOpen || !mounted) return null;

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => setStep(s => s - 1);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const payload = {
                companyName,
                role,
                location,
                workOption,
                offerStatus,
                salaryHourly: salaryHourly || null,
                appliedDate: appliedDate ? new Date(appliedDate).toISOString() : null,
                offerDate: offerDate ? new Date(offerDate).toISOString() : null,
                processSteps,
                interviewDetails,
                additionalComments
            };

            const res = await fetch('/api/interview-experiences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Failed to submit review');
                return;
            }

            setSuccessMessage('Review submitted successfully!');
            setTimeout(() => {
                setSuccessMessage('');
                onClose();
                if (onSuccess) onSuccess();
                setStep(1);
                // Reset form
                setCompanyName('');
                setRole('');
                setLocation('');
                setAdditionalComments('');
                setProcessSteps([{ date: '', step: 'OA', type: 'Algorithms', durationMinutes: 10 }]);
                setInterviewDetails({});
            }, 2000);
        } catch (err) {
            console.error('Submit error:', err);
            setError('An error occurred while submitting.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addProcess = () => {
        setProcessSteps([...processSteps, { date: '', step: 'Technical Interview', type: 'System Design', durationMinutes: 45 }]);
    };

    return createPortal(
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
        >
            <div style={{
                background: 'var(--background)',
                width: '100%',
                maxWidth: '650px',
                borderRadius: '16px',
                border: '1px solid var(--accent)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,255,255,0.1)'
            }}>
                <div style={{ padding: '24px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'space-between', paddingRight: '24px' }}>
                            {[1, 2, 3, 4].map((num) => (
                                <div key={num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: step >= num ? 'var(--background)' : 'transparent',
                                        border: `2px solid ${step >= num ? 'var(--accent)' : 'var(--text-tertiary)'}`,
                                        color: step > num ? 'transparent' : (step === num ? 'var(--accent)' : 'var(--text-tertiary)'),
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold',
                                        position: 'relative'
                                    }}>
                                        {step > num ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" style={{ position: 'absolute' }}>
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        ) : num}
                                    </div>
                                    <span style={{ fontSize: '10px', color: step >= num ? 'var(--text-primary)' : 'var(--text-tertiary)', textAlign: 'center' }}>
                                        {num === 1 ? 'Basic Information' : num === 2 ? 'Interview Process' : num === 3 ? 'Interview Information' : 'Additional Information'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>

                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
                        {step === 1 ? 'Basic Information' : step === 2 ? 'Interview Process' : step === 3 ? 'Interview Information' : 'Additional Information'}
                    </h2>

                    {error && <div style={{ color: 'var(--error)', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
                    {successMessage && <div style={{ color: 'var(--success)', marginBottom: '16px', fontSize: '13px' }}>{successMessage}</div>}

                    {/* Step 1: Basic Information */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>Company</label>
                                <input value={companyName} onChange={e => setCompanyName(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} placeholder="e.g. Google" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>Role</label>
                                <input value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} placeholder="e.g. Software Engineering Intern" />
                            </div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>Location</label>
                                    <input value={location} onChange={e => setLocation(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} placeholder="e.g. San Francisco, CA" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>Work Option</label>
                                    <select value={workOption} onChange={e => setWorkOption(e.target.value as any)} style={{ width: '100%', padding: '10px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                                        <option>Onsite</option>
                                        <option>Remote</option>
                                        <option>Hybrid</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>Received Offer?</label>
                                    <select value={offerStatus} onChange={e => setOfferStatus(e.target.value as any)} style={{ width: '100%', padding: '10px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                                        <option>Yes</option>
                                        <option>No</option>
                                        <option>Pending</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>Salary (Hourly)</label>
                                    <input type="number" value={salaryHourly} onChange={e => setSalaryHourly(e.target.value ? Number(e.target.value) : '')} style={{ width: '100%', padding: '10px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} placeholder="e.g. 50" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Interview Process */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>Applied Date</label>
                                    <input type="date" value={appliedDate} onChange={e => setAppliedDate(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' }}>Offer Date</label>
                                    <input type="date" value={offerDate} onChange={e => setOfferDate(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                                </div>
                            </div>

                            {processSteps.map((p, i) => (
                                <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                    <h4 style={{ fontSize: '13px', marginBottom: '12px' }}>Process {i + 1}</h4>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px' }}>Date</label>
                                            <input type="date" value={p.date} onChange={e => { const newP = [...processSteps]; newP[i].date = e.target.value; setProcessSteps(newP); }} style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px' }} />
                                        </div>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px' }}>Step</label>
                                            <input value={p.step} onChange={e => { const newP = [...processSteps]; newP[i].step = e.target.value; setProcessSteps(newP); }} style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px' }} placeholder="e.g. Technical Interview" />
                                        </div>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px' }}>Type</label>
                                            <input value={p.type} onChange={e => { const newP = [...processSteps]; newP[i].type = e.target.value; setProcessSteps(newP); }} style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px' }} placeholder="e.g. System Design" />
                                        </div>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px' }}>Duration (Mins)</label>
                                            <input type="number" value={p.durationMinutes} onChange={e => { const newP = [...processSteps]; newP[i].durationMinutes = Number(e.target.value); setProcessSteps(newP); }} style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px' }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={addProcess} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'right', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                + Add Process
                            </button>
                        </div>
                    )}

                    {/* Step 3: Interview Information */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                For each interview step, please describe what questions were asked, what skills were tested, and your experience.
                            </p>
                            {processSteps.map((p, i) => (
                                <div key={i}>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>{p.step} - {p.type}</label>
                                    <textarea
                                        value={interviewDetails[`${p.step}-${p.type}-${i}`] || ''}
                                        onChange={e => setInterviewDetails({ ...interviewDetails, [`${p.step}-${p.type}-${i}`]: e.target.value })}
                                        style={{ width: '100%', minHeight: '100px', padding: '12px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
                                        placeholder="Detailed description..."
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 4: Additional Information */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Share any additional details that might help others, such as work-life balance, team culture, or career growth.
                            </p>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>Any comments you would like to add?</label>
                                <textarea
                                    value={additionalComments}
                                    onChange={e => setAdditionalComments(e.target.value)}
                                    style={{ width: '100%', minHeight: '150px', padding: '12px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '32px' }}>
                        {step > 1 && (
                            <button onClick={handleBack} disabled={isSubmitting} style={{ padding: '12px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>
                                Back
                            </button>
                        )}
                        {step < 4 ? (
                            <button onClick={handleNext} style={{ padding: '12px', borderRadius: '8px', background: 'var(--background-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>
                                Next
                            </button>
                        ) : (
                            <button onClick={handleSubmit} disabled={isSubmitting} style={{ padding: '12px', borderRadius: '8px', background: 'var(--background-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                                {isSubmitting ? 'Saving...' : 'Save Review'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
