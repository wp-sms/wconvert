import { loaderConfig } from './vite.loader-config.mjs';

export default loaderConfig({
  entry: 'resources/phone/src/main.ts',
  outDir: 'public/phone',
  name: 'wconvertPhone',
  fileName: 'phone.js',
});
