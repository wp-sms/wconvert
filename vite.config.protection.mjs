import { loaderConfig } from './vite.loader-config.mjs';
const config = loaderConfig({ entry: 'resources/protection/src/challenge.ts', outDir: 'public/protection', name: 'WConvertProtection', fileName: 'protection.js' });
config.build.lib.formats = ['es'];
export default config;
