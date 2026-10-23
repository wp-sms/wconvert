import { loaderConfig } from './vite.loader-config.mjs';

const config = loaderConfig({
  entry: 'resources/loader/src/main.ts',
  outDir: 'public/loader',
  name: 'wconvertLoader',
});

// The loader boots itself; no browser consumer reads its entry export.
config.build.rollupOptions = { preserveEntrySignatures: false };
// Measured against the Node 22 gzip contract; more inlining/passes grow this payload.
// Keep these artifact-specific settings out of the inspector builds.
config.build.terserOptions = {
  compress: { passes: 2, hoist_funs: true, inline: 1, sequences: false },
  format: { quote_style: 3 },
};

export default config;
