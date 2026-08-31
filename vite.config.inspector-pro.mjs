import { loaderConfig } from './vite.loader-config.mjs';

export default loaderConfig({
  entry: 'pro/resources/loader/src/inspect/main.ts',
  outDir: 'pro/public/inspector',
  name: 'wconvertProInspector',
  fileName: 'inspector.js',
});
