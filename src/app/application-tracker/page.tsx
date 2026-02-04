// Application Tracker View

import React, { Suspense } from 'react';
import { Dashboard } from '@/components/Dashboard';

export default function ApplicationTrackerPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '8px' }}>
                <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading Tracker...</span>
            </div>
        }>
            <Dashboard defaultActiveView="tracker" />
        </Suspense>
    );
}
