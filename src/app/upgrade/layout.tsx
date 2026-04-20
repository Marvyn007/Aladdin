import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plans & Pricing | Aladdin',
  description: 'Plans that works best for you',
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
