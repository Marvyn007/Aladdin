/**
 * Ensures .next is a junction pointing to a local (non-OneDrive) directory.
 * OneDrive syncing causes EBUSY file-lock errors on the .next build cache,
 * so we redirect it to %LOCALAPPDATA%\Aladdin\.next via an NTFS junction.
 *
 * Also places a node_modules junction next to the .next target so that
 * Node.js `require()` calls from compiled server files (which resolve
 * relative to the real AppData path) can still find project dependencies.
 *
 * Idempotent — safe to run on every `npm run dev`.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const nextDir = path.join(projectRoot, '.next');
const nodeModulesDir = path.join(projectRoot, 'node_modules');
const appDataBase = path.join(
  process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'),
  'Aladdin'
);
const localTarget = path.join(appDataBase, '.next');
const localNodeModules = path.join(appDataBase, 'node_modules');

function ensureJunction(linkPath, targetPath, label) {
  let needsCreate = true;

  try {
    const stat = fs.lstatSync(linkPath);
    const isLink = stat.isSymbolicLink();
    let isJunction = false;
    try { fs.readlinkSync(linkPath); isJunction = true; } catch {}

    if (isLink || isJunction) {
      const currentTarget = fs.readlinkSync(linkPath);
      if (path.resolve(currentTarget) === path.resolve(targetPath)) {
        needsCreate = false;
      } else {
        fs.rmSync(linkPath, { force: true });
      }
    } else if (stat.isDirectory()) {
      fs.rmSync(linkPath, { recursive: true, force: true });
      console.log(`[ensure-next-dir] Removed plain ${label} directory (was not a junction)`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  if (!needsCreate) return;

  if (label === '.next') {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  try {
    fs.symlinkSync(targetPath, linkPath, 'junction');
    console.log(`[ensure-next-dir] Created junction: ${label} -> ${targetPath}`);
  } catch (err) {
    if (err.code === 'EPERM') {
      console.warn(`[ensure-next-dir] Junction creation failed (EPERM). Trying mklink /J ...`);
      execSync(`mklink /J "${linkPath}" "${targetPath}"`, { stdio: 'pipe' });
      console.log(`[ensure-next-dir] Created junction via mklink: ${label} -> ${targetPath}`);
    } else {
      throw err;
    }
  }
}

ensureJunction(nextDir, localTarget, '.next');
ensureJunction(localNodeModules, nodeModulesDir, 'node_modules');
