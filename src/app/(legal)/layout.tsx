import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-playfair',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${playfair.variable} ${dmSans.variable} ${jetbrains.variable}`}
      style={{
        /* Hard-code light theme so ThemeRegistry dark-mode overrides don't bleed in */
        '--background': '#faf8f4',
        '--text-primary': '#37352f',
        '--text-secondary': '#5a5754',
        '--text-muted': '#8a8884',
        '--accent': '#2383e2',
        '--accent-gold': '#d4a853',
        '--border': 'rgba(55, 53, 47, 0.10)',
        backgroundColor: '#faf8f4',
        color: '#37352f',
        minHeight: '100vh',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
