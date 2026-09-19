import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// A new, in-memory WordPress every run. Never attach this harness to a saved site.
const root = process.cwd();
const child = spawn(process.execPath, [
  resolve(root, 'node_modules/@wp-playground/cli/cli.js'), 'server',
  '--workers=1', '--php=8.1', '--wp=6.8.3', `--port=${process.env.WCONVERT_VISUAL_INLINE ? '9415' : process.env.WCONVERT_VISUAL_PRO ? '9414' : '9413'}`,
  '--mount', `${root}:/wordpress/wp-content/plugins/wconvert`,
  ...(process.env.WCONVERT_VISUAL_PRO ? ['--mount', `${root}/pro:/wordpress/wp-content/plugins/wconvert-pro`] : []),
  '--mount', `${resolve(root, 'tools/visual-tests/mu')}:/wordpress/wp-content/mu-plugins`,
], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
