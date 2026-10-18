import { readFileSync } from 'node:fs';

/** Deployment and publishing share one account, origin and bucket mapping. */
export function cloudTarget(config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))) {
  const account = config.account_id;
  const domains = (config.routes ?? []).filter(route => route.custom_domain === true);
  const bucket = binding => config.r2_buckets?.find(item => item.binding === binding)?.bucket_name;
  const publicBucket = bucket('PUBLIC_TEMPLATES'), privateBucket = bucket('PRIVATE_TEMPLATES');
  if (!/^[a-f0-9]{32}$/.test(account ?? '') || domains.length !== 1
    || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(domains[0].pattern)
    || ![publicBucket, privateBucket].every(name => /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name ?? ''))
    || publicBucket === privateBucket || config.workers_dev !== false || config.preview_urls !== false) {
    throw Error('Configure one account, custom domain and two distinct private buckets in wrangler.jsonc');
  }
  return { account, origin: `https://${domains[0].pattern}`, publicBucket, privateBucket };
}
