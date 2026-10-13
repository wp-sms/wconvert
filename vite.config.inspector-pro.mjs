import { loaderConfig } from './vite.loader-config.mjs';

/** Pro's eligibility inspector, beside Pro's loader (ADR 0048). */
export default loaderConfig({
  entry: 'pro/resources/loader/src/inspect/main.ts',
  outDir: 'pro/public/inspector',
  name: 'wconvertProInspector',
  fileName: 'inspector.js',
});
