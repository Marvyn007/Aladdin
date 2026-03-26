'use client';

import { useEffect } from 'react';
import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function SSOCallback() {
    const router = useRouter();
    const { isLoaded, isSignedIn } = useAuth();

    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;

        let cancelled = false;

        if (!cancelled) router.replace('/');

        return () => {
            cancelled = true;
        };
    }, [isLoaded, isSignedIn, router]);

    return <AuthenticateWithRedirectCallback />;
}
