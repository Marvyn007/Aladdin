import type { NextConfig } from "next";

/**
 * Build output stays at `.next`. On Windows + OneDrive, `npm run dev` runs
 * `scripts/ensure-next-dir.js` first, which makes `.next` a junction to
 * `%LOCALAPPDATA%\Aladdin\.next` so the real cache lives outside synced folders.
 * Do not set NEXT_DIST_DIR — Next 16 can mis-resolve absolute `distDir` on Windows.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'puppeteer-core', '@sparticuz/chromium-min'],
  // Dev defaults to Turbopack; this project uses webpack in npm scripts to avoid
  // Turbopack persistent-cache corruption on Windows (esp. OneDrive-synced paths).
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.logo.dev',
      },
      {
        protocol: 'https',
        hostname: 'logo.dev',
      }
    ]
  }
};

export default nextConfig;
