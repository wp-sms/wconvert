import { proTierConfig } from './vite.config.pro-tier.mjs';

export default proTierConfig({
  tier: 'elite',
  entry: 'pro/resources/loader/src/inspect/elite.ts',
  kind: 'inspector',
});
