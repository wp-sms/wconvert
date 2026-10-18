/** Disposable native WordPress integration, with HTTP intercepted inside the verifier. */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'wconvert-download-native-'));
try {
 mkdirSync(join(temp, 'mu'));
 writeFileSync(join(temp, 'mu/boot.php'), `<?php
 define('WCONVERT_LICENSE_KEY', 'local-fixture-key');
 define('WCONVERT_TEMPLATE_API_ORIGIN', 'https://templates.example');
 require '/wordpress/wp-content/plugins/wconvert/wconvert.php';
 require '/wordpress/wp-content/plugins/wconvert-pro/wconvert-pro.php';
 `);
 writeFileSync(join(temp, 'runner.php'), `<?php
 define('WP_DEBUG', true);
 define('WP_DEBUG_DISPLAY', true);
 register_shutdown_function(static function () { if ($e = error_get_last()) echo json_encode($e); });
 require '/wordpress/wp-load.php';
 require '/wordpress/wp-content/plugins/wconvert/bin/verify-template-downloads.php';
 `);
 const output = execFileSync(resolve(root, 'node_modules/.bin/wp-playground-cli'), ['php', '--php=8.1',
  '--mount', `${root}:/wordpress/wp-content/plugins/wconvert`,
  '--mount', `${resolve(root, 'pro')}:/wordpress/wp-content/plugins/wconvert-pro`,
  '--mount', `${join(temp, 'mu')}:/wordpress/wp-content/mu-plugins`,
  '--mount', `${temp}:/scratch`, '--', '/scratch/runner.php'], { cwd: root, encoding: 'utf8', maxBuffer: 16777216, timeout: 180000 });
 if (!output.includes('PASS: WordPress boot')) throw Error(`Native verification failed:\n${output}`);
 console.log(output.trim());
} finally { rmSync(temp, { recursive: true, force: true }); }
