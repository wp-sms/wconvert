import { proTierConfig } from './vite.config.pro-tier.mjs';

export default proTierConfig({
  tier: 'basic',
  entry: 'pro/resources/loader/src/inspect/basic.ts',
  kind: 'inspector',
});
