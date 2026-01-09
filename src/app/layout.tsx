// Root layout component

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
