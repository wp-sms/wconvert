import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// Use real MySQL: capture receipts and queued handoff require InnoDB transactions.
const site = process.env.WCONVERT_DEMO_SITE;
if (!site || !/define\s*\(\s*['"]WCONVERT_LIBRARY_DEMO['"]\s*,\s*true\s*\)/.test(readFileSync(resolve(site, 'wp-config.php'), 'utf8'))) {
  throw new Error('Set WCONVERT_DEMO_SITE to a disposable WordPress with WCONVERT_LIBRARY_DEMO=true. See demo/README.md.');
}
const child = spawn(process.env.WCONVERT_DEMO_PHP || 'php', [
  '-d', 'memory_limit=512M', '-S', '127.0.0.1:9421', '-t', resolve(site), resolve(import.meta.dirname, 'router.php'),
], { stdio: 'inherit', env: { ...process.env, PHP_CLI_SERVER_WORKERS: '4' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
