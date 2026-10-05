// Disposable in-memory WordPress only. No merchant database or saved site is mounted.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const root = process.cwd();
const woo = process.env.WCONVERT_WOO_DIR;
if (!woo || !existsSync(resolve(woo, 'woocommerce.php'))) throw new Error('Set WCONVERT_WOO_DIR to an extracted official WooCommerce plugin directory.');
const temporary = mkdtempSync(resolve(tmpdir(), 'wconvert-rc-blueprint-'));
const blueprint = JSON.parse(readFileSync(resolve(root, 'tools/visual-tests/recommendations-spike/blueprint.json'), 'utf8'));
blueprint.preferredVersions = { wp: process.env.WCONVERT_TEST_WP || '7.1.2', php: process.env.WCONVERT_TEST_PHP || '8.3' };
writeFileSync(resolve(temporary, 'blueprint.json'), JSON.stringify(blueprint));
const child = spawn(process.execPath, [resolve(root, 'node_modules/@wp-playground/cli/cli.js'), 'server',
  `--wp=${process.env.WCONVERT_TEST_WP || '7.1.2'}`, `--php=${process.env.WCONVERT_TEST_PHP || '8.3'}`, '--port=9445', '--workers=6',
  '--blueprint', resolve(temporary, 'blueprint.json'),
  '--mount', `${resolve(process.env.WCONVERT_TEST_CORE || root)}:/wordpress/wp-content/plugins/wconvert`,
  '--mount', `${resolve(process.env.WCONVERT_TEST_PRO || `${root}/pro`)}:/wordpress/wp-content/plugins/wconvert-pro`,
  '--mount', `${resolve(woo)}:/wordpress/wp-content/plugins/woocommerce`,
  '--mount', `${root}/tools/visual-tests/mu/commerce.php:/wordpress/wp-content/mu-plugins/commerce.php`,
  '--mount', `${root}/tools/visual-tests/themes/recommendations-classic:/wordpress/wp-content/themes/recommendations-classic`,
  '--mount', `${root}/tools/visual-tests/recommendations-spike/product-fixture.php:/wordpress/wp-content/mu-plugins/product-recommendations.php`,
  '--mount', `${root}/tools/visual-tests/recommendations-spike/fixture.php:/wordpress/wp-content/mu-plugins/recommendations-spike.php`,
], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { rmSync(temporary, { recursive: true, force: true }); process.exit(code ?? 0); });
