'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to sign-in page which handles both sign-in and sign-up
export default function SignUpPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to sign-in with signup mode
        router.replace('/sign-in?mode=signup');
    }, [router]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
        </div>
    );
}
