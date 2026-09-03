import { adminConfig } from './vite.admin-config.mjs';

export default adminConfig({
  entry: 'resources/admin/src/main.tsx',
  outDir: 'public/admin',
});
