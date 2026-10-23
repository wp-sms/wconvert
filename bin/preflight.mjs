#!/usr/bin/env node
//
// preflight.mjs — what CI would run for this diff, run here first.
//
//     npm run preflight                 the checks this diff triggers
//     npm run preflight -- --all        every check, whatever the diff
//     npm run preflight -- --visual     also the Playwright suites
//     npm run preflight -- --dry-run    list the steps, run none
//
// The diff is the branch against its merge-base with origin/main, plus the
// working tree and untracked files — what the pull request will carry once
// this is committed. It is matched against the `filters:` block of
// .github/workflows/ci.yml, read straight out of the workflow with the same
// matcher dorny/paths-filter uses, so the filters live in one place and a
// change there changes this too.
//
// Fails fast: the first failing step ends the run. The MySQL job stays in CI;
// it needs a database this machine may not have running.
//
// --visual IS OPT-IN. The suites take minutes, and popup and fullscreen fail
// locally with `spawn /bin/sh ENOENT` because of the space in "Local Sites" —
// a path problem, not a code one. CI runs them from a path without a space.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import picomatch from 'picomatch';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  const header = readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1);
  console.log(header.slice(0, header.findIndex(line => !line.startsWith('//'))).map(line => line.replace(/^\/\/ ?/, '')).join('\n').trim());
  process.exit(0);
}

const git = (...argv) => execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

// The `filters: |` block scalar: `name:` lines open a filter, `- 'glob'` lines
// add to it, comments are skipped, and the block ends at the first line
// indented no deeper than `filters:` itself.
function readFilters() {
  const lines = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8').split('\n');
  const at = lines.findIndex(line => /^\s*filters:\s*\|\s*$/.test(line));
  if (at < 0) throw new Error('No `filters: |` block in .github/workflows/ci.yml');
  const indent = lines[at].search(/\S/);
  const filters = {};
  let current = null;
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (line.search(/\S/) <= indent) break;
    const name = line.match(/^\s*([\w-]+):\s*$/);
    const glob = line.match(/^\s*-\s*'([^']+)'\s*$/) ?? line.match(/^\s*-\s*"([^"]+)"\s*$/) ?? line.match(/^\s*-\s*(\S+)\s*$/);
    if (name) filters[current = name[1]] = [];
    else if (glob && current) filters[current].push(glob[1]);
    else throw new Error(`Cannot read this filters line: ${line.trim()}`);
  }
  return filters;
}

function changedFiles() {
  const base = git('merge-base', 'origin/main', 'HEAD')[0];
  return [...new Set([
    ...git('diff', '--name-only', base),
    ...git('ls-files', '--others', '--exclude-standard'),
  ])];
}

const filters = readFilters();
const files = args.has('--all') ? [] : changedFiles();
const hit = Object.fromEntries(Object.entries(filters).map(([name, globs]) => {
  const match = picomatch(globs, { dot: true });
  return [name, args.has('--all') || files.some(file => match(file))];
}));

const dump = join(mkdtempSync(join(tmpdir(), 'wconvert-preflight-')), 'conversions.json');
const npm = (...argv) => ['npm', ...argv];

const steps = [
  ['Source contract', ['composer', 'verify:source']],
  ['Loader contract', npm('run', 'check:loader')],
  ['Admin contract', npm('run', 'check:admin')],
  ...(hit.php ? [
    ['PHPUnit', ['composer', 'test']],
    ['PHPStan', ['composer', 'phpstan']],
  ] : []),
  ...(hit.js ? [
    ['TypeScript', npm('run', 'typecheck')],
    ['ESLint', npm('run', 'lint')],
    ['Vitest', npm('test'), { WCONVERT_DUMP_CONVERSIONS: dump }],
    ['Converted designs', ['php', 'bin/verify-converted-designs.php', dump]],
  ] : []),
  // Every bundle, then the POTs read out of them. Needs wp-cli on the PATH;
  // without it the check exits 2 and says so rather than passing.
  ...(hit.php || hit.js ? [
    ['Build', npm('run', 'build')],
    ['POT coverage', npm('run', 'check:pot')],
  ] : []),
  ...(hit.service ? [
    ['Design library', ['bash', 'tools/design-library/build.sh', 'renderer']],
    ['Template studio', npm('run', 'test:template-studio')],
    ['Catalogue revisions', npm('run', 'templates:revisions:check')],
    ['Approvals current', npm('run', 'templates:releasable')],
    ['Worker check', npm('run', 'check'), {}, 'tools/template-server'],
    ['Worker tests', npm('test'), {}, 'tools/template-server'],
  ] : []),
  ...(hit.js && args.has('--visual') ? [
    ...['test:visual', 'test:visual:inline', 'test:visual:reopen', 'test:visual:content-lock', 'test:visual:popup', 'test:visual:events', 'test:visual:analytics', 'test:visual:fullscreen']
      .map(script => [`Visual: ${script.replace(/^test:visual:?/, '') || 'admin'}`, npm('run', script)]),
  ] : []),
];

console.log(args.has('--all')
  ? 'Every check (--all).'
  : `${files.length} changed file(s); filters hit: ${Object.entries(hit).filter(([, on]) => on).map(([name]) => name).join(', ') || 'none'}.`);

if (args.has('--dry-run')) {
  for (const [label, command, , cwd = '.'] of steps) console.log(`· ${label}: ${command.join(' ')}${cwd === '.' ? '' : ` (in ${cwd})`}`);
  process.exit(0);
}

const seconds = ms => `${(ms / 1000).toFixed(1)}s`;
const done = [];
let failed = null;
for (const [label, [command, ...argv], env = {}, cwd = '.'] of steps) {
  console.log(`\n── ${label}: ${[command, ...argv].join(' ')}${cwd === '.' ? '' : ` (in ${cwd})`}`);
  const started = Date.now();
  const run = spawnSync(command, argv, { cwd: join(ROOT, cwd), env: { ...process.env, ...env }, stdio: 'inherit' });
  done.push([label, Date.now() - started, run.status === 0]);
  if (run.status !== 0) { failed = label; break; }
}

const width = Math.max(...done.map(([label]) => label.length));
console.log('\n── Summary');
for (const [label, ms, ok] of done) console.log(`${ok ? '✓' : '✗'} ${label.padEnd(width)}  ${seconds(ms).padStart(7)}`);
console.log(`  ${'Total'.padEnd(width)}  ${seconds(done.reduce((sum, [, ms]) => sum + ms, 0)).padStart(7)}`);
if (failed) {
  console.log(`\n${failed} failed; ${steps.length - done.length} step(s) not run.`);
  process.exit(1);
}
