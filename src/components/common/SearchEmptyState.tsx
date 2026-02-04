'use client';

import React from 'react';
import { useStoreActions } from '@/store/useStore';

export function SearchEmptyState() {
    const { exitSearchMode } = useStoreActions();

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px', // Matches existing empty state height
                textAlign: 'center',
                padding: '20px',
            }}
        >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧐</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                No jobs found
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '300px', marginBottom: '20px', lineHeight: 1.5 }}>
                Can’t find what you’re looking for? If you discover a job outside Aladdin, you can import it and still use all of Aladdin’s tools.
            </p>
            <button
                onClick={() => window.location.reload()}
                style={{
                    padding: '8px 16px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                Back to full job listings
            </button>
        </div>
    );
}
