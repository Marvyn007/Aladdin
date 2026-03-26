import type { Metadata } from 'next';
import { Lato, JetBrains_Mono } from 'next/font/google';

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-lato',
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
      className={`${lato.variable} ${jetbrains.variable}`}
      style={{ minHeight: '100vh', background: '#fafaf8' }}
    >
      {children}
    </div>
  );
}
