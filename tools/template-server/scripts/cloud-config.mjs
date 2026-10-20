import { readFileSync, lstatSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { loadEnvFile } from 'node:process';

export const wranglerConfig = () => JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const bucketName = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/**
 * Deployment and publishing share one account, origin, bucket mapping and
 * download dataset: the one hosted service while WConvert is prelaunch.
 */
export function cloudTarget(config = wranglerConfig()) {
  const account = config.account_id;
  const domains = (config.routes ?? []).filter(route => route.custom_domain === true);
  const bucket = binding => config.r2_buckets?.find(item => item.binding === binding)?.bucket_name;
  const publicBucket = bucket('PUBLIC_TEMPLATES'), privateBucket = bucket('PRIVATE_TEMPLATES');
  const dataset = config.analytics_engine_datasets?.find(item => item.binding === 'DOWNLOADS')?.dataset;
  if (!/^[a-f0-9]{32}$/.test(account ?? '') || domains.length !== 1
    || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(domains[0].pattern)
    || ![publicBucket, privateBucket].every(name => bucketName.test(name ?? ''))
    || publicBucket === privateBucket || !/^[a-z0-9_]{1,64}$/.test(dataset ?? '')
    || config.workers_dev !== false || config.preview_urls !== false) {
    throw Error('Configure one account, custom domain, download dataset and two distinct private buckets in wrangler.jsonc');
  }
  return { account, origin: `https://${domains[0].pattern}`, publicBucket, privateBucket, dataset };
}

/** Load an operator credentials file: an absolute path to a private regular file (mode 600). */
export function loadCredentials(path) {
  if (!path || !isAbsolute(path)) throw Error('Use an absolute credentials-file path');
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Credentials must be a private regular file (chmod 600)');
  loadEnvFile(path);
}
