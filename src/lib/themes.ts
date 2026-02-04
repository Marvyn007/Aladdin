export interface ColorPalette {
    background: string;
    backgroundSecondary: string;
    surface: string;
    surfaceHover: string;
    border: string;
    accent: string;
    accentHover: string;
    accentMuted: string;
}

export interface ThemeDefinition {
    id: string;
    name: string;
    description: string;
    colors: {
        light: ColorPalette;
        dark: ColorPalette;
    };
}

export const DEFAULT_THEME_ID = 'aladdin';

// Numeric codes for database storage (as requested by user)
// theme_mode: '0' = light, '1' = dark
export const THEME_MODE_CODES = {
    light: '0',
    dark: '1',
} as const;

// color_palette codes: '0' = aladdin, '1' = ocean, etc.
export const COLOR_PALETTE_CODES: Record<string, string> = {
    aladdin: '0',
    ocean: '1',
    sunset: '2',
    rose: '3',
    mint: '4',
    lavender: '5',
    charcoal: '6',
};

// Reverse mappings for loading from database
export const THEME_MODE_FROM_CODE: Record<string, 'light' | 'dark'> = {
    '0': 'light',
    '1': 'dark',
};

export const COLOR_PALETTE_FROM_CODE: Record<string, string> = {
    '0': 'aladdin',
    '1': 'ocean',
    '2': 'sunset',
    '3': 'rose',
    '4': 'mint',
    '5': 'lavender',
    '6': 'charcoal',
};

// Helper functions for encoding/decoding
export function encodeThemeMode(mode: 'light' | 'dark'): string {
    return THEME_MODE_CODES[mode];
}

export function decodeThemeMode(code: string | null | undefined): 'light' | 'dark' {
    if (!code) return 'light';
    // Support both numeric codes and legacy text values
    if (code === '0' || code === '1') {
        return THEME_MODE_FROM_CODE[code];
    }
    // Legacy: if it's already 'light' or 'dark', return as is
    if (code === 'light' || code === 'dark') {
        return code;
    }
    return 'light';
}

export function encodeColorPalette(themeId: string): string {
    return COLOR_PALETTE_CODES[themeId] || '0';
}

export function decodeColorPalette(code: string | null | undefined): string {
    if (!code) return 'aladdin';
    // Support both numeric codes and legacy text values
    if (COLOR_PALETTE_FROM_CODE[code]) {
        return COLOR_PALETTE_FROM_CODE[code];
    }
    // Legacy: if it's already a theme ID, return as is
    if (COLOR_PALETTE_CODES[code] !== undefined) {
        return code;
    }
    return 'aladdin';
}

export const THEMES: ThemeDefinition[] = [
    {
        id: 'aladdin',
        name: 'Aladdin',
        description: 'The classic warm and clean look.',
        colors: {
            light: {
                background: '#faf8f5',
                backgroundSecondary: '#f5f3ef',
                surface: '#faf8f5',
                surfaceHover: '#f0ede8',
                border: 'rgba(55, 53, 47, 0.12)',
                accent: '#2383e2',
                accentHover: '#0b6bcb',
                accentMuted: 'rgba(35, 131, 226, 0.1)',
            },
            dark: {
                background: '#191919',
                backgroundSecondary: '#202020',
                surface: '#252525',
                surfaceHover: '#2f2f2f',
                border: 'rgba(255, 255, 255, 0.09)',
                accent: '#529cca',
                accentHover: '#6eb3dc',
                accentMuted: 'rgba(82, 156, 202, 0.15)',
            }
        }
    },
    {
        id: 'ocean',
        name: 'Ocean Blue',
        description: 'Deep and calming blue tones.',
        colors: {
            light: {
                background: '#faf8f5',
                backgroundSecondary: '#f5f3ef',
                surface: '#faf8f5',
                surfaceHover: '#f0ede8',
                border: 'rgba(55, 53, 47, 0.12)',
                accent: '#0284c7', // Sky 600
                accentHover: '#0369a1', // Sky 700
                accentMuted: 'rgba(2, 132, 199, 0.1)',
            },
            dark: {
                background: '#191919',
                backgroundSecondary: '#202020',
                surface: '#252525',
                surfaceHover: '#2f2f2f',
                border: 'rgba(255, 255, 255, 0.09)',
                accent: '#38bdf8', // Sky 400
                accentHover: '#7dd3fc', // Sky 300
                accentMuted: 'rgba(56, 189, 248, 0.15)',
            }
        }
    },
    {
        id: 'sunset',
        name: 'Sunset Orange',
        description: 'Warm, energetic, and vibrant.',
        colors: {
            light: {
                background: '#faf8f5',
                backgroundSecondary: '#f5f3ef',
                surface: '#faf8f5',
                surfaceHover: '#f0ede8',
                border: 'rgba(55, 53, 47, 0.12)',
                accent: '#ea580c', // Orange 600
                accentHover: '#c2410c', // Orange 700
                accentMuted: 'rgba(234, 88, 12, 0.1)',
            },
            dark: {
                background: '#191919',
                backgroundSecondary: '#202020',
                surface: '#252525',
                surfaceHover: '#2f2f2f',
                border: 'rgba(255, 255, 255, 0.09)',
                accent: '#fb923c', // Orange 400
                accentHover: '#fdba74', // Orange 300
                accentMuted: 'rgba(251, 146, 60, 0.15)',
            }
        }
    },
    {
        id: 'rose',
        name: 'Soft Rose',
        description: 'Elegant pinks and soft surfaces.',
        colors: {
            light: {
                background: '#faf8f5',
                backgroundSecondary: '#f5f3ef',
                surface: '#faf8f5',
                surfaceHover: '#f0ede8',
                border: 'rgba(55, 53, 47, 0.12)',
                accent: '#e11d48', // Rose 600
                accentHover: '#be123c', // Rose 700
                accentMuted: 'rgba(225, 29, 72, 0.1)',
            },
            dark: {
                background: '#191919',
                backgroundSecondary: '#202020',
                surface: '#252525',
                surfaceHover: '#2f2f2f',
                border: 'rgba(255, 255, 255, 0.09)',
                accent: '#fb7185', // Rose 400
                accentHover: '#fda4af', // Rose 300
                accentMuted: 'rgba(251, 113, 133, 0.15)',
            }
        }
    },
    {
        id: 'mint',
        name: 'Mint Green',
        description: 'Fresh, natural, and productive.',
        colors: {
            light: {
                background: '#faf8f5',
                backgroundSecondary: '#f5f3ef',
                surface: '#faf8f5',
                surfaceHover: '#f0ede8',
                border: 'rgba(55, 53, 47, 0.12)',
                accent: '#16a34a', // Green 600
                accentHover: '#15803d', // Green 700
                accentMuted: 'rgba(22, 163, 74, 0.1)',
            },
            dark: {
                background: '#191919',
                backgroundSecondary: '#202020',
                surface: '#252525',
                surfaceHover: '#2f2f2f',
                border: 'rgba(255, 255, 255, 0.09)',
                accent: '#4ade80', // Green 400
                accentHover: '#86efac', // Green 300
                accentMuted: 'rgba(74, 222, 128, 0.15)',
            }
        }
    },
    {
        id: 'lavender',
        name: 'Lavender Mist',
        description: 'Creative and dreamy purple vibes.',
        colors: {
            light: {
                background: '#faf8f5',
                backgroundSecondary: '#f5f3ef',
                surface: '#faf8f5',
                surfaceHover: '#f0ede8',
                border: 'rgba(55, 53, 47, 0.12)',
                accent: '#9333ea', // Purple 600
                accentHover: '#7e22ce', // Purple 700
                accentMuted: 'rgba(147, 51, 234, 0.1)',
            },
            dark: {
                background: '#191919',
                backgroundSecondary: '#202020',
                surface: '#252525',
                surfaceHover: '#2f2f2f',
                border: 'rgba(255, 255, 255, 0.09)',
                accent: '#c084fc', // Purple 400
                accentHover: '#d8b4fe', // Purple 300
                accentMuted: 'rgba(192, 132, 252, 0.15)',
            }
        }
    },
    {
        id: 'charcoal',
        name: 'Charcoal Slate',
        description: 'Minimalist monochrome for focus.',
        colors: {
            light: {
                background: '#faf8f5',
                backgroundSecondary: '#f5f3ef',
                surface: '#faf8f5',
                surfaceHover: '#f0ede8',
                border: 'rgba(55, 53, 47, 0.12)',
                accent: '#475569', // Slate 600
                accentHover: '#334155', // Slate 700
                accentMuted: 'rgba(71, 85, 105, 0.1)',
            },
            dark: {
                background: '#191919',
                backgroundSecondary: '#202020',
                surface: '#252525',
                surfaceHover: '#2f2f2f',
                border: 'rgba(255, 255, 255, 0.09)',
                accent: '#94a3b8', // Slate 400
                accentHover: '#cbd5e1', // Slate 300
                accentMuted: 'rgba(148, 163, 184, 0.15)',
            }
        }
    }
];

export function getTheme(id: string | null | undefined): ThemeDefinition {
    return THEMES.find(t => t.id === id) || THEMES.find(t => t.id === DEFAULT_THEME_ID)!;
}
