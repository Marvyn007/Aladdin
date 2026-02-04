import React, { useState, useEffect } from 'react';
import { Loader2, Search } from 'lucide-react';

export function JobLoadingState() {
    const [message, setMessage] = useState('Connecting to job database...');

    useEffect(() => {
        const messages = [
            'Connecting to job database...',
            'Fetching fresh opportunities...',
            'Analyzing job relevance...',
            'Sorting by best match...',
            'Finalizing your list...'
        ];
        let i = 0;
        const interval = setInterval(() => {
            i = (i + 1) % messages.length;
            setMessage(messages[i]);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            gap: '24px'
        }}>
            {/* Animated Icon Circle */}
            <div style={{
                position: 'relative',
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {/* Outer pulsing rings */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: '2px solid var(--accent)',
                    opacity: 0.2,
                    animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
                }} />
                <div style={{
                    position: 'absolute',
                    inset: '10px',
                    borderRadius: '50%',
                    border: '2px solid var(--accent)',
                    opacity: 0.4,
                    animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s'
                }} />

                {/* Center Icon */}
                <div style={{
                    position: 'relative',
                    width: '48px',
                    height: '48px',
                    background: 'var(--surface)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 10
                }}>
                    <Search className="animate-pulse" size={24} color="var(--accent)" />
                </div>
            </div>

            {/* Status Text */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    minHeight: '24px'
                }}>
                    {message}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    Please wait while we curate your feed
                </p>
            </div>

            {/* Progress Bar */}
            <div style={{
                width: '200px',
                height: '4px',
                background: 'var(--surface-hover)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginTop: '16px'
            }}>
                <div style={{
                    height: '100%',
                    background: 'var(--accent)',
                    width: '50%',
                    borderRadius: '2px',
                    animation: 'shimmer 1.5s infinite linear',
                    transformOrigin: '0% 50%'
                }} />
            </div>

            <style jsx>{`
                @keyframes ping {
                    75%, 100% {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}</style>
        </div>
    );
}
