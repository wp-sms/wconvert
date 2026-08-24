import { loaderConfig } from './vite.loader-config.mjs';

export default loaderConfig({
  entry: 'pro/resources/loader/src/main.ts',
  outDir: 'pro/public/loader',
  name: 'wconvertProLoader',
});
