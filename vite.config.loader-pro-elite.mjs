import { proTierConfig } from './vite.config.pro-tier.mjs';

export default proTierConfig({
  tier: 'elite',
  entry: 'pro/resources/loader/src/elite.ts',
  kind: 'loader',
});
