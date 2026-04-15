/**
 * Deletes the Next.js output/cache directory (.next).
 * Use when Turbopack/webpack cache gets corrupted (ENOENT on *.sst / app-paths-manifest, etc.).
 * Handles the junction to %LOCALAPPDATA% — clears the target contents, preserves the link.
 */
const fs = require('fs');
const path = require('path');

const nextDir = path.join(process.cwd(), '.next');

if (!fs.existsSync(nextDir)) {
  console.log('[clean-next-cache] No .next directory (nothing to remove)');
  process.exit(0);
}

let isJunction = false;
try {
  const stat = fs.lstatSync(nextDir);
  isJunction = stat.isSymbolicLink() || Boolean(fs.readlinkSync(nextDir));
} catch {}

if (isJunction) {
  const entries = fs.readdirSync(nextDir);
  for (const entry of entries) {
    fs.rmSync(path.join(nextDir, entry), { recursive: true, force: true });
  }
  console.log('[clean-next-cache] Cleared contents inside junction', nextDir);
} else {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('[clean-next-cache] Removed', nextDir);
}
