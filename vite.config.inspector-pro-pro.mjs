import { proTierConfig } from './vite.config.pro-tier.mjs';

export default proTierConfig({
  tier: 'pro',
  entry: 'pro/resources/loader/src/inspect/pro.ts',
  kind: 'inspector',
});
