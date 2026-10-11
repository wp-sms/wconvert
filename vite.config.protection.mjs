import { loaderConfig } from './vite.loader-config.mjs';
const config = loaderConfig({ entry: 'resources/protection/src/challenge.ts', outDir: 'public/protection', name: 'WConvertProtection', fileName: 'protection.js' });
config.build.lib.formats = ['es'];
// The challenge page's stylesheet, printed through wp_print_styles() rather
// than an inline <style> (ProtectionController::challenge()).
config.build.lib.cssFileName = 'protection';
export default config;
