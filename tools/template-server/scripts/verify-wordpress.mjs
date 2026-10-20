/** Disposable WordPress: intercepted local release fixtures or real HTTPS acceptance. */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const remote = process.argv[2] === '--remote';
const expected = remote ? process.argv[3] : null;
const releaseDirectory = remote ? null : process.argv[2];
if (remote ? (process.argv.length !== 4 || !/^[a-f0-9]{64}$/.test(expected ?? '')) : (process.argv.length !== 3 || !isAbsolute(releaseDirectory ?? ''))) throw Error('Use an absolute release directory, or --remote EXPECTED_RELEASE_ID');
// The PHP side owns these verifiers; this runner only boots them in Playground.
const verifier = remote ? 'verify-template-api.php' : 'verify-template-release.php';
if (!existsSync(resolve(root, 'bin', verifier))) throw Error(`bin/${verifier} is not in this checkout; the plugin's v3 verifier must exist before this check can run`);
const premiumFixtures = Boolean(releaseDirectory && process.env.WCONVERT_VERIFY_PREMIUM_FIXTURES === '1');
const commerceDirectory = premiumFixtures && process.env.WCONVERT_VERIFY_WOOCOMMERCE ? resolve(process.env.WCONVERT_VERIFY_WOOCOMMERCE) : null;
if (commerceDirectory && !existsSync(join(commerceDirectory, 'woocommerce.php'))) throw Error('WCONVERT_VERIFY_WOOCOMMERCE must point to a WooCommerce plugin directory');
const temp = mkdtempSync(join(tmpdir(), 'wconvert-download-native-'));
try {
  mkdirSync(join(temp, 'mu'));
  writeFileSync(join(temp, 'mu/boot.php'), `<?php
 ${remote ? '' : "define('WCONVERT_LICENSE_KEY', 'local-fixture-key');"}
 ${remote ? '' : "define('WCONVERT_TEMPLATE_API_ORIGIN', 'https://templates.example');"}
 ${commerceDirectory ? "require '/wordpress/wp-content/plugins/woocommerce/woocommerce.php';" : ''}
 require '/wordpress/wp-content/plugins/wconvert/wconvert.php';
 ${remote ? '' : "require '/wordpress/wp-content/plugins/wconvert-pro/wconvert-pro.php';"}
 `);
  writeFileSync(join(temp, 'runner.php'), `<?php
 define('WP_DEBUG', true);
 define('WP_DEBUG_DISPLAY', true);
 register_shutdown_function(static function () { if ($e = error_get_last()) echo json_encode($e); });
 require '/wordpress/wp-load.php';
 ${releaseDirectory ? "putenv('WCONVERT_RELEASE_DIRECTORY=/release');" : ''}
 ${premiumFixtures ? "putenv('WCONVERT_VERIFY_PREMIUM_FIXTURES=1');" : ''}
 ${remote ? `putenv('WCONVERT_EXPECTED_RELEASE=${expected}');` : ''}
 require '/wordpress/wp-content/plugins/wconvert/bin/${verifier}';
 `);
  const output = execFileSync(resolve(root, 'node_modules/.bin/wp-playground-cli'), ['php', '--php=8.1',
    ...(commerceDirectory ? ['--mount', `${commerceDirectory}:/wordpress/wp-content/plugins/woocommerce`] : []),
    '--mount', `${root}:/wordpress/wp-content/plugins/wconvert`,
    '--mount', `${resolve(root, 'pro')}:/wordpress/wp-content/plugins/wconvert-pro`,
    '--mount', `${join(temp, 'mu')}:/wordpress/wp-content/mu-plugins`,
    '--mount', `${temp}:/scratch`, ...(releaseDirectory ? ['--mount', `${releaseDirectory}:/release`] : []), '--', '/scratch/runner.php'], { cwd: root, encoding: 'utf8', maxBuffer: 16777216, timeout: 180000 });
  if (!output.includes(remote ? 'PASS live HTTPS catalogue' : 'no site settings or campaigns changed.') || /Fatal error|Uncaught/.test(output)) throw Error(`Native verification failed:\n${output}`);
  console.log(output.trim());
} finally { rmSync(temp, { recursive: true, force: true }); }
