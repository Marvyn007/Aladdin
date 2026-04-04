// Root layout component with Clerk authentication

import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeRegistry } from "@/components/theme/ThemeRegistry";
import { Analytics } from '@vercel/analytics/next';
import { FilterProvider } from "@/contexts/FilterContext";
import { cn } from "@/lib/utils";
import { ProfileCompletionWidget } from "@/components/ProfileCompletionWidget";
import { ResumeGenerationProvider } from "@/contexts/ResumeGenerationContext";
import { ResumeGenerationWidget } from "@/components/ResumeGenerationWidget";
import { ResumeReadyToast } from "@/components/ResumeReadyToast";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Aladdin",
  description: "AI-powered job search companion. Features smart matching, cover letter generation, and application tracking.",
  keywords: ["job search", "software engineering", "internship", "entry-level", "AI", "resume"],
  authors: [{ name: "Marvin Chaudhary" }],
  icons: '/favicon-logo.png',
  openGraph: {
    title: "Aladdin",
    description: "AI-powered job search companion",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignUpUrl="/tour">
      <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
        <body className={inter.className} suppressHydrationWarning>
          <ThemeRegistry>
            <ResumeGenerationProvider>
              <Suspense>
                <FilterProvider>
                  {children}
                </FilterProvider>
              </Suspense>
              <ProfileCompletionWidget />
              <ResumeGenerationWidget />
              <ResumeReadyToast />
            </ResumeGenerationProvider>
          </ThemeRegistry>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
