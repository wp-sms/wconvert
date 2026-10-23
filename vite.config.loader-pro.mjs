import { loaderConfig } from './vite.loader-config.mjs';

/**
 * Pro's shipped loader. Written to the one path an installed Pro reads —
 * `ProLoaderEnqueue::DIST` — so a source checkout and the ZIP run the same
 * bundle from the same place.
 */
const config = loaderConfig({
  entry: 'pro/resources/loader/src/main.ts',
  outDir: 'pro/public/loader',
  name: 'wconvertProLoader',
  fileName: 'loader.js',
});

// The entry boots itself; its exports exist for source-level composition tests.
// No browser consumer reads a generated wconvertProLoader namespace.
config.build.rollupOptions = { preserveEntrySignatures: false };
// Pro compresses better with helpers/statements retained than hoisted/inlined.
// Quote preservation and ASCII escapes change spelling, never string values.
// Free and the inspectors retain the factory's default compression settings.
config.build.terserOptions = {
  compress: { passes: 5, hoist_funs: false, inline: 0, sequences: false },
  format: { quote_style: 3, ascii_only: true },
};

export default config;
