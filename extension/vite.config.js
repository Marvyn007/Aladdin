import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, cpSync } from 'fs';

/**
 * Extension PNGs must end up in dist/assets/ (manifest web_accessible_resources + chrome.runtime.getURL).
 * Put files in either:
 *   - extension/public/assets/*.png  (recommended), or
 *   - extension/assets/*.png
 * Runs in closeBundle so copies survive emptyOutDir + Rollup output.
 *
 * Names used in panel.js / manifest (add any missing PNGs here, then npm run build):
 *   aladdin-logo.png, activity-icon.png, settings.png, home.png, play.png, pause.png,
 *   stop-button.png, fast-forward.png, no-connection.png, logout.png, reload.png,
 *   document.png, preview.png, icon16.png, icon48.png, icon128.png
 */
function copyExtensionStaticFiles() {
  return {
    name: 'copy-extension-static-files',
    closeBundle() {
      const root = resolve(__dirname);
      const dist = resolve(root, 'dist');
      const distAssets = resolve(dist, 'assets');
      mkdirSync(distAssets, { recursive: true });
      copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));

      const sources = [resolve(root, 'public/assets'), resolve(root, 'assets')];
      for (const src of sources) {
        if (existsSync(src)) {
          cpSync(src, distAssets, { recursive: true });
        }
      }
    }
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [copyExtensionStaticFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.js'),
        content: resolve(__dirname, 'src/content/index.js'),
        popup: resolve(__dirname, 'popup.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
