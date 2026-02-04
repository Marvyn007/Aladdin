'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useStore, useTheme, useStoreActions } from '@/store/useStore';
import { getTheme } from '@/lib/themes';
import { useAuth } from '@clerk/nextjs';

/**
 * ThemeRegistry
 * 
 * Applies theme preferences (accent color, background overrides) to the document root
 * in real-time. It listens to the store's themePreferences slice.
 * 
 * Also handles hydrating theme settings from the database upon authentication.
 */
export function ThemeRegistry({ children }: { children: React.ReactNode }) {
    const theme = useTheme();
    const themeId = useStore((state) => state.themeId);
    const { loadSettings, resetTheme } = useStoreActions();
    const { isSignedIn, isLoaded } = useAuth();
    const themePreferences = getTheme(themeId).colors[theme];

    // Hydrate Theme Settings on Auth Change
    useEffect(() => {
        if (!isLoaded) return;

        console.log('[DEBUG-THEME-REGISTRY] Auth state changed:', { isSignedIn, isLoaded });

        if (isSignedIn) {
            console.log('[DEBUG-THEME-REGISTRY] User signed in, invoking loadSettings...');
            loadSettings();
        } else {
            // Optional: decide if we want to reset on sign-out or keep last preference?
            // "resetTheme" reverts to default Aladdin theme.
            console.log('[DEBUG-THEME-REGISTRY] User signed out, resetting theme to default...');
            resetTheme();
        }
    }, [isSignedIn, isLoaded, loadSettings, resetTheme]);

    // Use LayoutEffect to prevent FOUC (Flash of Unstyled Content)
    // Synchronously applies changes before browser paint
    const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

    useIsomorphicLayoutEffect(() => {
        const root = document.documentElement;
        console.log('[DEBUG-THEME-REGISTRY] Applying theme metrics:', { theme, themeId });

        // Apply Mode Class (Light / Dark)
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Apply Custom Colors (CSS Variables)
        if (themePreferences) {
            // Helper to safe set
            const setVar = (name: string, val: string) => root.style.setProperty(name, val);

            // Accent
            if (themePreferences.accent) {
                setVar('--accent', themePreferences.accent);
                // Derived values
                setVar('--accent-hover', `color-mix(in srgb, ${themePreferences.accent}, black 10%)`);
                setVar('--accent-muted', `color-mix(in srgb, ${themePreferences.accent}, transparent 90%)`);
            }

            // Backgrounds
            if (themePreferences.background) {
                setVar('--background', themePreferences.background);
                const mixColor = theme === 'dark' ? 'white' : 'black';
                setVar('--background-secondary', `color-mix(in srgb, ${themePreferences.background}, ${mixColor} 3%)`);
                setVar('--surface', themePreferences.background);
                setVar('--surface-hover', `color-mix(in srgb, ${themePreferences.background}, ${mixColor} 5%)`);
            }

            if (themePreferences.backgroundSecondary) {
                setVar('--background-secondary', themePreferences.backgroundSecondary);
            }

            if (themePreferences.border) {
                setVar('--border', themePreferences.border);
            }

        } else {
            // Fallback / Reset if no preferences found (shouldn't happen with valid themeId)
            const rootStyle = root.style;
            rootStyle.removeProperty('--accent');
            rootStyle.removeProperty('--accent-hover');
            rootStyle.removeProperty('--accent-muted');
            rootStyle.removeProperty('--background');
            rootStyle.removeProperty('--background-secondary');
            rootStyle.removeProperty('--surface');
            rootStyle.removeProperty('--surface-hover');
            rootStyle.removeProperty('--border');
        }

    }, [theme, themePreferences, themeId]); // Added themeId to deps to ensure re-run on palette change

    return <>{children}</>;
}
