import { loaderConfig } from './vite.loader-config.mjs';

export default loaderConfig({
  entry: 'resources/loader/src/inspect/main.ts',
  outDir: 'public/inspector',
  name: 'wconvertInspector',
  fileName: 'inspector.js',
});
