import { readFileSync, lstatSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { loadEnvFile } from 'node:process';

export const wranglerConfig = () => JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const bucketName = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/**
 * Deployment and publishing share one account, origin, bucket mapping and
 * download dataset. `environment` is undefined for production or `staging`
 * for `env.staging`. Wrangler does not inherit bindings or routes into an
 * environment, so neither does this: staging must name its own.
 */
export function cloudTarget(config = wranglerConfig(), environment) {
  if (environment !== undefined && environment !== 'staging') throw Error('Use --env staging, or omit it for production');
  const section = environment ? config.env?.[environment] : config;
  if (!section) throw Error(`wrangler.jsonc has no env.${environment}`);
  const account = section.account_id ?? config.account_id;
  const domains = (section.routes ?? []).filter(route => route.custom_domain === true);
  const bucket = (from, binding) => from.r2_buckets?.find(item => item.binding === binding)?.bucket_name;
  const publicBucket = bucket(section, 'PUBLIC_TEMPLATES'), privateBucket = bucket(section, 'PRIVATE_TEMPLATES');
  const dataset = section.analytics_engine_datasets?.find(item => item.binding === 'DOWNLOADS')?.dataset;
  const production = environment ? [bucket(config, 'PUBLIC_TEMPLATES'), bucket(config, 'PRIVATE_TEMPLATES')] : [];
  if (!/^[a-f0-9]{32}$/.test(account ?? '') || domains.length !== 1
    || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(domains[0].pattern)
    || ![publicBucket, privateBucket].every(name => bucketName.test(name ?? ''))
    || publicBucket === privateBucket || production.includes(publicBucket) || production.includes(privateBucket)
    || !/^[a-z0-9_]{1,64}$/.test(dataset ?? '')
    || (section.workers_dev ?? config.workers_dev) !== false || (section.preview_urls ?? config.preview_urls) !== false) {
    throw Error('Configure one account, custom domain, download dataset and two distinct private buckets in wrangler.jsonc');
  }
  return { environment: environment ?? 'production', account, origin: `https://${domains[0].pattern}`, publicBucket, privateBucket, dataset };
}

/** Load an operator credentials file: an absolute path to a private regular file (mode 600). */
export function loadCredentials(path) {
  if (!path || !isAbsolute(path)) throw Error('Use an absolute credentials-file path');
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Credentials must be a private regular file (chmod 600)');
  loadEnvFile(path);
}
