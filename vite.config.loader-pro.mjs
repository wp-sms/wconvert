import { loaderConfig } from './vite.loader-config.mjs';

/**
 * Pro's shipped loader. Written to the one path an installed Pro reads —
 * `ProLoaderEnqueue::DIST` — so a source checkout and the ZIP run the same
 * bundle from the same place.
 */
export default loaderConfig({
  entry: 'pro/resources/loader/src/main.ts',
  outDir: 'pro/public/loader',
  name: 'wconvertProLoader',
  fileName: 'loader.js',
});
