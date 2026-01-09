// ThemeProvider - Applies theme class to document

'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useStore((state) => state.theme);

    useEffect(() => {
        // Apply theme class to document element
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    return <>{children}</>;
}
