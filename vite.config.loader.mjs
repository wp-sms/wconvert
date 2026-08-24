import { loaderConfig } from './vite.loader-config.mjs';

export default loaderConfig({
  entry: 'resources/loader/src/main.ts',
  outDir: 'public/loader',
  name: 'wconvertLoader',
});
