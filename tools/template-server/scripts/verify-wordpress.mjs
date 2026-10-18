/** Disposable native WordPress integration, with HTTP intercepted inside the verifier. */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { cloudTarget } from './cloud-config.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const remote = process.argv[2] === '--remote';
const expected = remote ? process.argv[3] : null;
const releaseDirectory = remote ? null : process.argv[2];
if (remote ? (process.argv.length !== 4 || !/^[a-f0-9]{64}$/.test(expected ?? '')) : (process.argv.length > 3 || (releaseDirectory && !isAbsolute(releaseDirectory)))) throw Error('Use an optional absolute release directory, or --remote EXPECTED_RELEASE_ID');
const temp = mkdtempSync(join(tmpdir(), 'wconvert-download-native-'));
try {
 mkdirSync(join(temp, 'mu'));
 writeFileSync(join(temp, 'mu/boot.php'), `<?php
 ${remote ? '' : "define('WCONVERT_LICENSE_KEY', 'local-fixture-key');"}
 define('WCONVERT_TEMPLATE_API_ORIGIN', '${remote ? cloudTarget().origin : 'https://templates.example'}');
 require '/wordpress/wp-content/plugins/wconvert/wconvert.php';
 ${remote ? '' : "require '/wordpress/wp-content/plugins/wconvert-pro/wconvert-pro.php';"}
 `);
 writeFileSync(join(temp, 'runner.php'), `<?php
 define('WP_DEBUG', true);
 define('WP_DEBUG_DISPLAY', true);
 register_shutdown_function(static function () { if ($e = error_get_last()) echo json_encode($e); });
 require '/wordpress/wp-load.php';
 ${releaseDirectory ? "putenv('WCONVERT_RELEASE_DIRECTORY=/release');" : ''}
 ${remote ? `putenv('WCONVERT_EXPECTED_RELEASE=${expected}');` : ''}
 require '/wordpress/wp-content/plugins/wconvert/bin/${remote ? 'verify-template-api.php' : releaseDirectory ? 'verify-template-release.php' : 'verify-template-downloads.php'}';
 `);
 const output = execFileSync(resolve(root, 'node_modules/.bin/wp-playground-cli'), ['php', '--php=8.1',
  '--mount', `${root}:/wordpress/wp-content/plugins/wconvert`,
  '--mount', `${resolve(root, 'pro')}:/wordpress/wp-content/plugins/wconvert-pro`,
  '--mount', `${join(temp, 'mu')}:/wordpress/wp-content/mu-plugins`,
  '--mount', `${temp}:/scratch`, ...(releaseDirectory ? ['--mount', `${releaseDirectory}:/release`] : []), '--', '/scratch/runner.php'], { cwd: root, encoding: 'utf8', maxBuffer: 16777216, timeout: 180000 });
 if (!output.includes(remote ? 'PASS live HTTPS catalogue' : releaseDirectory ? 'no site settings or campaigns changed.' : 'PASS: WordPress boot') || /Fatal error|Uncaught/.test(output)) throw Error(`Native verification failed:\n${output}`);
 console.log(output.trim());
} finally { rmSync(temp, { recursive: true, force: true }); }
