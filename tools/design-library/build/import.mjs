/**
 * Take design JSON from anywhere and put it where the library keeps it.
 *
 *     node build/import.mjs new-designs.json      # a file
 *     pbpaste | node build/import.mjs             # or straight off the clipboard
 *
 * ============================================================================
 * THE RETURN LEG OF THE ONE-WAY TRIP `VOCABULARY.md` MAKES.
 * ============================================================================
 * `out/VOCABULARY.md` is pasted into a system that has never seen this repo,
 * precisely so the creative work happens without 61 ADRs and a closed
 * vocabulary loaded alongside it. What comes back is JSON, and until now
 * landing it meant deciding by hand which of two directories each entry goes
 * in and what its filename should be — per design, forty-two times over.
 *
 * The tier decides the directory and nothing else does: free designs are the
 * ones the free ZIP ships, and a paid one lives in the Pro module that owns
 * its Display Type (ADR 0056). Getting that wrong is not a small mistake —
 * a Pro tree in free's tree is the thing `bin/verify-source-contract.sh`
 * exists to catch, and a free design filed under Pro simply vanishes from
 * every free install.
 *
 * **It writes and then tells you to verify; it does not verify itself.**
 * `bin/verify-templates.php` is the authority on whether a design survives
 * registration and it reports six failures by name — wrapping it here would
 * put a second, worse summary in front of the one that actually explains
 * itself.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = process.env.WCONVERT_PLUGIN ?? resolve(HERE, '../../..');

const FREE = resolve(PLUGIN, 'resources/templates/library');
const PRO = resolve(PLUGIN, 'pro/modules/display-types/templates');

/** Read the argument as a path, or stdin when there is no argument. */
function source() {
  const path = process.argv[2];

  if (path !== undefined) {
    return readFileSync(resolve(process.cwd(), path), 'utf8');
  }

  return readFileSync(0, 'utf8');
}

let decoded;

try {
  decoded = JSON.parse(source());
} catch (error) {
  console.error(`not valid JSON: ${error.message}`);
  process.exit(2);
}

/*
 * One entry or many, because a session that produced one design and a session
 * that produced twelve should not need different commands.
 */
const entries = Array.isArray(decoded) ? decoded : [decoded];

/** Every id the library already holds, so a clash is reported and not written. */
const taken = new Map();

for (const directory of [FREE, PRO]) {
  if (!existsSync(directory)) {
    continue;
  }

  for (const file of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
    taken.set(file.replace(/\.json$/, ''), directory === FREE ? 'free' : 'Pro');
  }
}

const problems = [];
const written = [];

for (const [index, entry] of entries.entries()) {
  const where = `entry ${index + 1}`;

  if (entry === null || typeof entry !== 'object') {
    problems.push(`${where} is not an object`);
    continue;
  }

  const { id, tier, display_type: type } = entry;

  if (typeof id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    problems.push(`${where} has no usable \`id\` — kebab-case, lower case, no spaces`);
    continue;
  }

  /*
   * No `tree` is the DISCRIMINATOR for "a design this install did not get", so
   * an entry missing one does not fail — it silently becomes a Pro upsell card
   * for the design in the file. Refused here rather than written, because it is
   * the single most expensive typo this format has.
   */
  if (typeof entry.tree !== 'object' || entry.tree === null || !Array.isArray(entry.tree.steps)) {
    problems.push(`${where} (${id}) has no \`tree.steps\` — it would land as a locked Pro upsell card, silently`);
    continue;
  }

  const free = (tier ?? 'free') === 'free';

  // Free ships `popup` and `inline`. A bar or a slide-in there is a design no
  // install can use: free has no container to mount it in.
  if (free && type !== 'popup' && type !== 'inline') {
    problems.push(`${where} (${id}) is \`${type}\` at the free tier — only Pro ships bars and slide-ins`);
    continue;
  }

  const directory = free ? FREE : PRO;
  const already = taken.get(id);

  if (already !== undefined && !process.argv.includes('--overwrite')) {
    problems.push(`${where} (${id}) already exists in the ${already} library — pass --overwrite to replace it`);
    continue;
  }

  const path = resolve(directory, `${id}.json`);

  writeFileSync(path, `${JSON.stringify(entry, null, 2)}\n`);
  written.push(`  ${free ? 'free' : ' Pro'}  ${id}.json`);
  taken.set(id, free ? 'free' : 'Pro');
}

if (written.length > 0) {
  console.log(`Wrote ${written.length} design(s):`);
  console.log(written.join('\n'));
}

if (problems.length > 0) {
  console.error(`\nRefused ${problems.length}:`);
  console.error(problems.map((problem) => `  ✗ ${problem}`).join('\n'));
}

console.log('\nNow check what actually survives registration:');
console.log('  composer verify:templates');
console.log('  ./tools/design-library/build.sh designs sheet gallery');

if (entries.some((entry) => (entry?.tier ?? 'free') !== 'free')) {
  console.log('\nEvery Pro design also needs a stub in resources/templates/locked.json');
  console.log('and a live page at https://wconvert.com/designs/<slug>/ for its preview_url.');
}

process.exit(problems.length > 0 ? 1 : 0);
