'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CompanyAutocomplete } from '@/components/shared/CompanyAutocomplete';
import { LocationAutocomplete } from '@/components/shared/LocationAutocomplete';
import { CompanyLogo } from '@/components/shared/CompanyLogo';
import { Check, Building2, Home, Briefcase, Clock, Ban, CheckCircle2, X } from 'lucide-react';

interface InterviewExperienceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialData?: any; // For editing
}

export function InterviewExperienceModal({ isOpen, onClose, onSuccess, initialData = null }: InterviewExperienceModalProps) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [mounted, setMounted] = useState(false);

    // Form State
    const [companyName, setCompanyName] = useState('');
    const [companyLogoUrl, setCompanyLogoUrl] = useState('');
    const [role, setRole] = useState('');
    const [location, setLocation] = useState('');
    const [workOption, setWorkOption] = useState<'Onsite' | 'Remote' | 'Hybrid'>('Onsite');
    const [offerStatus, setOfferStatus] = useState<'Yes' | 'No' | 'Pending'>('No');
    const [salaryHourly, setSalaryHourly] = useState<number | ''>('');
    const [appliedDate, setAppliedDate] = useState('');
    const [offerDate, setOfferDate] = useState('');
    const [processSteps, setProcessSteps] = useState([{ date: '', step: 'OA', type: 'Algorithms', durationMinutes: 30 }]);
    const [interviewDetails, setInterviewDetails] = useState<Record<string, string>>({});
    const [additionalComments, setAdditionalComments] = useState('');
    const [outcome, setOutcome] = useState('Pending');
    const [offerDetails, setOfferDetails] = useState('');
    const [isRemote, setIsRemote] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setCompanyName(initialData.companyName || '');
                setRole(initialData.role || '');
                setLocation(initialData.location || '');
                setWorkOption(initialData.workOption || 'Onsite');
                setOfferStatus(initialData.offerStatus || 'No');
                setSalaryHourly(initialData.salaryHourly || '');
                setAppliedDate(initialData.appliedDate ? initialData.appliedDate.split('T')[0] : '');
                setOfferDate(initialData.offerDate ? initialData.offerDate.split('T')[0] : '');
                setProcessSteps(initialData.processSteps || [{ date: '', step: 'OA', type: 'Algorithms', durationMinutes: 30 }]);
                setInterviewDetails(initialData.interviewDetails || {});
                setAdditionalComments(initialData.additionalComments || '');
                setOutcome(initialData.outcome || 'Pending');
                setOfferDetails(initialData.offerDetails || '');
                setIsRemote(initialData.isRemote || false);
                setCompanyLogoUrl(initialData.company?.logoUrl || '');
            } else {
                // Reset for new entry
                setStep(1);
                setCompanyName('');
                setRole('');
                setLocation('');
                setWorkOption('Onsite');
                setOfferStatus('No');
                setSalaryHourly('');
                setAppliedDate('');
                setOfferDate('');
                setProcessSteps([{ date: '', step: 'OA', type: 'Algorithms', durationMinutes: 30 }]);
                setInterviewDetails({});
                setAdditionalComments('');
            }
            setError('');
            setFieldErrors({});
        }
    }, [isOpen, initialData]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        // Only close via X button as requested
    };

    if (!isOpen || !mounted) return null;

    const validateStep = (currentStep: number) => {
        const errors: Record<string, string> = {};
        if (currentStep === 1) {
            if (!companyName.trim()) errors.companyName = "Company is required";
            if (!role.trim()) errors.role = "Role is required";
            if (!location.trim()) errors.location = "Location is required";
            if (salaryHourly === '') errors.salaryHourly = "Pay is required (enter 0 if N/A)";
            else if (salaryHourly < 0) errors.salaryHourly = "Salary cannot be negative";
        } else if (currentStep === 2) {
            if (!appliedDate.trim()) errors.appliedDate = "Start date is required";
            if (!offerDate.trim()) errors.offerDate = "End date is required";
            
            if (appliedDate && offerDate) {
                const start = new Date(appliedDate);
                const end = new Date(offerDate);
                if (end <= start) {
                    errors.offerDate = "End date cannot be before or on the start date";
                }
            }

            let hasProcessErrors = false;
            let dateRangeError = false;
            processSteps.forEach((s, i) => {
                if (!s.step.trim()) { errors[`step_${i}`] = "Round name is required"; hasProcessErrors = true; }
                if (!s.type.trim()) { errors[`type_${i}`] = "Type is required"; hasProcessErrors = true; }
                if (!s.date.trim()) { errors[`date_${i}`] = "Date is required"; hasProcessErrors = true; }
                
                if (s.date && appliedDate && offerDate) {
                    const stepDate = new Date(s.date);
                    const start = new Date(appliedDate);
                    const end = new Date(offerDate);
                    if (stepDate < start || stepDate > end) {
                        errors[`date_${i}`] = "Must be between start and end";
                        hasProcessErrors = true;
                        dateRangeError = true;
                    }
                }
            });
            if (hasProcessErrors) {
                errors.process = dateRangeError ? "Interview dates MUST be between the start and the end date" : "Please fill out all visible fields in the rounds timeline";
            }
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(step)) {
            setStep(s => s + 1);
        }
    };
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
                additionalComments,
                outcome,
                offerDetails,
                isRemote
            };

            const url = initialData ? `/api/interview-experiences/${initialData.id}` : '/api/interview-experiences';
            const method = initialData ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Failed to submit review');
                if (data.details) setFieldErrors(data.details);
                return;
            }

            setSuccessMessage(initialData ? 'Review updated!' : 'Review submitted!');
            setTimeout(() => {
                onClose();
                if (onSuccess) onSuccess();
            }, 1500);
        } catch (err) {
            console.error('Submit error:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addProcess = () => {
        setProcessSteps([...processSteps, { date: '', step: '', type: '', durationMinutes: 45 }]);
    };

    const removeProcess = (index: number) => {
        if (processSteps.length > 1) {
            const newSteps = [...processSteps];
            newSteps.splice(index, 1);
            setProcessSteps(newSteps);
        }
    };

    const renderInput = (label: string, value: string, onChange: (val: string) => void, placeholder?: string, errorKey?: string) => (
        <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
            <input 
                value={value} 
                onChange={e => onChange(e.target.value)} 
                style={{ 
                    width: '100%', padding: '10px', background: 'var(--background)', 
                    border: `1px solid ${fieldErrors[errorKey || ''] ? 'var(--error)' : 'var(--border)'}`, 
                    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                }} 
                placeholder={placeholder} 
            />
            {errorKey && fieldErrors[errorKey] && <p style={{ color: 'var(--error)', fontSize: '11px', marginTop: '4px' }}>{fieldErrors[errorKey]}</p>}
        </div>
    );

    return createPortal(
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
        >
            <div style={{
                background: 'var(--background)', width: '100%', maxWidth: '680px', maxHeight: '90vh',
                borderRadius: '20px', border: '1px solid var(--border)', display: 'flex',
                flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    {/* Progress Bar (Stepper) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', position: 'relative', padding: '0 20px' }}>
                        <div style={{ position: 'absolute', top: '16px', left: '40px', right: '40px', height: '2px', background: 'var(--border)', zIndex: 0 }} />
                        
                        {[
                            { num: 1, label: 'Basic Info' },
                            { num: 2, label: 'Process' },
                            { num: 3, label: 'Details' },
                            { num: 4, label: 'Notes' },
                            { num: 5, label: 'Review' }
                        ].map(({ num, label }) => {
                            const isCompleted = step > num;
                            const isActive = step === num;
                            return (
                                <div key={num} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: isCompleted ? 'var(--accent)' : isActive ? 'var(--background)' : 'var(--background-secondary)',
                                        border: `2px solid ${isCompleted || isActive ? 'var(--accent)' : 'var(--border)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: isCompleted ? 'white' : isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                                        fontWeight: 700, fontSize: '14px', transition: 'all 0.3s'
                                    }}>
                                        {isCompleted ? <Check size={16} strokeWidth={3} /> : num}
                                    </div>
                                    <span style={{
                                        fontSize: '11px', fontWeight: isActive ? 600 : 500,
                                        color: isActive || isCompleted ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                        position: 'absolute', top: '40px', whiteSpace: 'nowrap'
                                    }}>
                                        {label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', marginTop: '24px', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {companyName && (
                                <div style={{ 
                                    width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', 
                                    border: '1px solid var(--border)', background: 'var(--background-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <CompanyLogo companyName={companyName} logoUrl={companyLogoUrl} size={24} />
                                </div>
                            )}
                            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
                                {step === 1 ? 'Tell us about the role' : step === 2 ? 'Interview Rounds' : step === 3 ? 'Deep Dive' : step === 4 ? 'Final Thoughts' : 'Preview Submission'}
                            </h2>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>

                    {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid var(--error)' }}>{error}</div>}
                    {successMessage && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid var(--success)' }}>{successMessage}</div>}

                    {/* Step 1: Basic Information */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <CompanyAutocomplete 
                                value={companyName} 
                                onSelect={(data) => {
                                    setCompanyName(data.name);
                                    setCompanyLogoUrl(data.logoUrl || '');
                                    if (fieldErrors.companyName) setFieldErrors(prev => {
                                        const n = {...prev};
                                        delete n.companyName;
                                        return n;
                                    });
                                }} 
                                error={fieldErrors.companyName}
                            />
                            {renderInput('Role / Position', role, setRole, 'e.g. Software Engineer Intern', 'role')}
                            <LocationAutocomplete
                                value={location}
                                onSelect={(val) => {
                                    setLocation(val);
                                    if (fieldErrors.location) setFieldErrors(prev => { const n = {...prev}; delete n.location; return n; });
                                }}
                                error={fieldErrors.location}
                            />
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 600, color: 'var(--text-secondary)' }}>Work Option</label>
                                    <select value={workOption} onChange={e => setWorkOption(e.target.value as any)} style={{ width: '100%', padding: '10px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                                        <option value="Onsite">Onsite</option>
                                        <option value="Remote">Remote</option>
                                        <option value="Hybrid">Hybrid</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 600, color: 'var(--text-secondary)' }}>Outcome</label>
                                    <select value={offerStatus} onChange={e => setOfferStatus(e.target.value as any)} style={{ width: '100%', padding: '10px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                                        <option value="Yes">Received Offer</option>
                                        <option value="No">No Offer</option>
                                        <option value="Pending">Pending</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    {renderInput('Pay (Hourly USD) *', salaryHourly.toString(), (val) => setSalaryHourly(val ? Number(val) : ''), 'e.g. 50', 'salaryHourly')}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Interview Process */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Date</label>
                                    <input type="date" value={appliedDate} onChange={e => setAppliedDate(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--background)', border: `1px solid ${fieldErrors.appliedDate ? '#ef4444' : 'var(--border)'}`, borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }} />
                                    {fieldErrors.appliedDate && <p style={{ color: 'var(--error)', fontSize: '11px', marginTop: '4px' }}>{fieldErrors.appliedDate}</p>}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 600, color: 'var(--text-secondary)' }}>End Date</label>
                                    <input type="date" value={offerDate} onChange={e => setOfferDate(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--background)', border: `1px solid ${fieldErrors.offerDate ? '#ef4444' : 'var(--border)'}`, borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }} />
                                    {fieldErrors.offerDate && <p style={{ color: 'var(--error)', fontSize: '11px', marginTop: '4px' }}>{fieldErrors.offerDate}</p>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Rounds Timeline</h4>
                                {fieldErrors.process && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: '1px solid var(--error)' }}>{fieldErrors.process}</div>}
                                {processSteps.map((p, i) => (
                                    <div key={i} style={{ background: 'var(--surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', position: 'relative' }}>
                                        {processSteps.length > 1 && (
                                            <button onClick={() => removeProcess(i)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                                <X size={16} />
                                            </button>
                                        )}
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            <div style={{ flex: '1 1 120px' }}>
                                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Round Name *</label>
                                                <input placeholder="e.g. Technical Interview" value={p.step} onChange={e => { const newP = [...processSteps]; newP[i].step = e.target.value; setProcessSteps(newP); }} style={{ width: '100%', padding: '8px', background: 'transparent', border: 'none', borderBottom: `1px solid ${fieldErrors[`step_${i}`] ? '#ef4444' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                            </div>
                                            <div style={{ flex: '1 1 100px' }}>
                                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Type *</label>
                                                <input placeholder="e.g. DSA" value={p.type} onChange={e => { const newP = [...processSteps]; newP[i].type = e.target.value; setProcessSteps(newP); }} style={{ width: '100%', padding: '8px', background: 'transparent', border: 'none', borderBottom: `1px solid ${fieldErrors[`type_${i}`] ? '#ef4444' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                            </div>
                                            <div style={{ flex: '1 1 120px' }}>
                                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Date *</label>
                                                <input type="date" value={p.date} onChange={e => { const newP = [...processSteps]; newP[i].date = e.target.value; setProcessSteps(newP); }} style={{ width: '100%', padding: '8px', background: 'transparent', border: 'none', borderBottom: `1px solid ${fieldErrors[`date_${i}`] ? '#ef4444' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                            </div>
                                            <div style={{ flex: '1 1 80px' }}>
                                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Mins</label>
                                                <input type="number" placeholder="45" value={p.durationMinutes} onChange={e => { const newP = [...processSteps]; newP[i].durationMinutes = Number(e.target.value); setProcessSteps(newP); }} style={{ width: '100%', padding: '8px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addProcess} style={{ padding: '10px', background: 'transparent', border: '1px dashed var(--accent)', color: 'var(--accent)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                    + Add Interview Round
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Deep Dive */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Expand on the specific questions that were asked, what must the user prepare for. (Optional but recommended)</p>
                            {processSteps.map((p, i) => (
                                <div key={i}>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>{p.step || `Round ${i+1}`} ({p.type || 'General'})</label>
                                    <textarea 
                                        value={interviewDetails[`step_${i}`] || ''} 
                                        onChange={e => setInterviewDetails({...interviewDetails, [`step_${i}`]: e.target.value})}
                                        style={{ width: '100%', minHeight: '120px', padding: '12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                                        placeholder="Specific questions, topics, difficulty..."
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 4: Final Thoughts */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', marginBottom: '12px', fontWeight: 600 }}>Overall Experience & Advice (Optional)</label>
                                <textarea 
                                    value={additionalComments} 
                                    onChange={e => setAdditionalComments(e.target.value)}
                                    style={{ width: '100%', minHeight: '200px', padding: '16px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                                    placeholder="Tips for future candidates, team culture, work-life balance..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 5: Preview */}
                    {step === 5 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            
                            {/* Row 1: Basic Info */}
                            <div style={{ padding: '20px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '16px', position: 'relative' }}>
                                <button onClick={() => setStep(1)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Basic Information</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                    <div><strong style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Company:</strong> <span style={{ fontWeight: 500 }}>{companyName}</span></div>
                                    <div><strong style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Role:</strong> <span style={{ fontWeight: 500 }}>{role}</span></div>
                                    <div><strong style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Location:</strong> <span style={{ fontWeight: 500 }}>{location}</span></div>
                                    <div><strong style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Work Option:</strong> <span style={{ fontWeight: 500 }}>{workOption}</span></div>
                                    <div><strong style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Outcome:</strong> <span style={{ fontWeight: 500 }}>{offerStatus === 'Yes' ? 'Received Offer' : offerStatus === 'No' ? 'No Offer' : 'Pending'}</span></div>
                                    <div><strong style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Pay:</strong> <span style={{ fontWeight: 500 }}>{salaryHourly ? `$${salaryHourly}/hr` : 'N/A'}</span></div>
                                </div>
                            </div>

                            {/* Row 2: Interview Process */}
                            <div style={{ padding: '20px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '16px', position: 'relative' }}>
                                <button onClick={() => setStep(2)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Interview Process</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                                    <div><strong style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Start Date:</strong> <span style={{ fontWeight: 500 }}>{appliedDate || 'N/A'}</span></div>
                                    <div><strong style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>End Date:</strong> <span style={{ fontWeight: 500 }}>{offerDate || 'N/A'}</span></div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <strong style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Timeline:</strong>
                                    {processSteps.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--background)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-muted)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{i + 1}</span>
                                            <span style={{ fontWeight: 600 }}>{p.step} ({p.type})</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{p.date} • {p.durationMinutes} mins</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Row 3: Deep Dive */}
                            <div style={{ padding: '20px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '16px', position: 'relative' }}>
                                <button onClick={() => setStep(3)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Interview Information</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {processSteps.map((p, i) => (
                                        <div key={i}>
                                            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>{p.step}:</strong>
                                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', background: 'var(--background)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                {interviewDetails[`step_${i}`] || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>No details provided.</span>}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Row 4: Final Thoughts */}
                            <div style={{ padding: '20px', background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: '16px', position: 'relative' }}>
                                <button onClick={() => setStep(4)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Additional Information</h4>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                                    {additionalComments || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>No additional comments provided.</span>}
                                </p>
                            </div>

                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', gap: '12px' }}>
                        {step > 1 && (
                            <button onClick={handleBack} disabled={isSubmitting} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}>
                                Back
                            </button>
                        )}
                        {step < 5 ? (
                            <button onClick={handleNext} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: 'var(--accent)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                                Continue
                            </button>
                        ) : (
                            <button onClick={handleSubmit} disabled={isSubmitting} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: 'var(--success, #10b981)', border: 'none', color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                                {isSubmitting ? 'Submitting...' : initialData ? 'Update Review' : 'Submit Review'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
