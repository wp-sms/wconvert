/**
 * The Screens group: every reading screen, in all four situations, both ways
 * round.
 *
 * Boots a throwaway WordPress under Playground with the plugin mounted, drives
 * it with Playwright, and writes one standalone preview card per capture into
 * `out/previews/`.
 *
 * ============================================================================
 * WHERE EACH OF THE FOUR SITUATIONS COMES FROM.
 * ============================================================================
 * ADR 0060 says a screen is empty, loading, failed and full. A seed produces
 * two of them and the other two are properties of a REQUEST, so they are
 * forced — and the two are forced on opposite sides of the wire, which is the
 * one design decision in this file:
 *
 * - **empty** — the site before `seed()` runs.
 * - **full**  — the site after it. One boot, two phases, in order: the two
 *               differ in rows rather than in anything about a request, so a
 *               second Playground boot would buy nothing but a minute.
 * - **failed** — the mu-plugin's `rest_pre_dispatch`, off a cookie. It has to
 *               be the SERVER, because `messageOf()` exists to read WordPress's
 *               REST error body — a 500 synthesised in the browser would prove
 *               the error path against a shape WordPress does not send.
 * - **loading** — a Playwright route that is never fulfilled. It has to be the
 *               BROWSER: Playground runs `--workers=1` (its default six all
 *               write one SQLite file and corrupt it), so a request held open
 *               in PHP deadlocks the whole server instead of rendering a
 *               skeleton.
 *
 * ============================================================================
 * AND WHY THE CARDS ARE DOM RATHER THAN SCREENSHOTS.
 * ============================================================================
 * A capture is the live `#wconvert-admin` subtree, its real ancestor chain, and
 * the three stylesheets the real page loads in the order it loads them —
 * WordPress's `forms`, WordPress's `buttons`, then the admin's `main.css`.
 * That ordering is not incidental: the un-converted controls take their box
 * model from WordPress and only their colour and radius from WConvert, so a
 * card built from the admin's stylesheet alone renders every native input with
 * no border at all.
 *
 * What that does NOT buy is a verdict. These render on a blank page; the real
 * admin owns wp-admin's page with preflight on and unlayered `!important`
 * utilities, and a design still has to be verified there (ADR 0035).
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRATCH = resolve(HERE, '..');
// The plugin tree. `build.sh` passes it; the fallback is the cwd, because the
// scratchpad this bundle is built in is deliberately not inside the repo.
const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();
const OUT = resolve(SCRATCH, 'out/previews');
const PORT = Number(process.env.WCONVERT_DS_PORT ?? 9412);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SEED_SECRET = 'design-system-capture';

/** The four reading screens. The builder is the `Today` group and a different question. */
const SCREENS = [
  { id: 'optins', label: 'Optins' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'leads', label: 'Leads' },
  { id: 'destinations', label: 'Destinations' },
];

const DIRECTIONS = process.env.WCONVERT_DS_DIRECTIONS?.split(',') ?? ['ltr', 'rtl'];

/*
 * A smoke run: `WCONVERT_DS_ONLY=optins` captures one screen rather than
 * sixteen, so a change to this file is checked against a boot rather than
 * against a guess.
 */
const ONLY = process.env.WCONVERT_DS_ONLY?.split(',') ?? null;
const CHOSEN = ONLY ? SCREENS.filter((s) => ONLY.includes(s.id)) : SCREENS;

/** Every WConvert read, which is what `loading` holds and `failed` refuses. */
const REST = '**/wp-json/**wconvert/v1/**';

/*
 * 1200×900. Wide enough that nothing is in its restacked form — the 360px
 * behaviour is §16's and is not what this grid is comparing — and tall enough
 * that a seeded table is not cut off mid-row.
 */
const VIEWPORT = { width: 1200, height: 900 };

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  mkdirSync(OUT, { recursive: true });

  const playground = await bootPlayground();

  try {
    const browser = await chromium.launch();

    try {
      const auth = await logIn(browser);
      const assets = await browser.newContext({ storageState: auth });
      const stylesheets = {};

      for (const direction of DIRECTIONS) {
        stylesheets[direction] = await readStylesheets(assets, direction);
      }

      await assets.close();

      const written = [];

      // Empty first, because it is the site before the seed and there is no
      // way back to it once rows exist.
      for (const direction of DIRECTIONS) {
        for (const screen of CHOSEN) {
          written.push(await capture({ browser, auth, stylesheets, screen, state: 'empty', direction }));
        }
      }

      // The two forced states do not care which phase they are captured in —
      // no read of theirs ever returns — so they ride along with `empty`.
      for (const direction of DIRECTIONS) {
        for (const screen of CHOSEN) {
          for (const state of ['loading', 'failed']) {
            written.push(await capture({ browser, auth, stylesheets, screen, state, direction }));
          }
        }
      }

      console.log(await seed());

      for (const direction of DIRECTIONS) {
        for (const screen of CHOSEN) {
          written.push(await capture({ browser, auth, stylesheets, screen, state: 'full', direction }));
        }
      }

      console.log(`\n${written.length} cards written to ${OUT}`);
    } finally {
      await browser.close();
    }
  } finally {
    playground.kill('SIGTERM');
  }
}

/**
 * Playground, with the plugin mounted and the harness as an mu-plugin.
 *
 * **Free only, and Pro deliberately unmounted.** Mounting Pro dequeues free's
 * admin bundle and enqueues its own, so every card would be Pro's build — and
 * ADR 0060 §14 is about what a merchant sees when something is `locked`, which
 * is a state only a free install is ever in.
 */
function bootPlayground() {
  const child = spawn(
    'npx',
    [
      '@wp-playground/cli',
      'server',
      '--workers=1',
      `--port=${PORT}`,
      '--mount', `${PLUGIN}:/wordpress/wp-content/plugins/wconvert`,
      '--mount', `${resolve(SCRATCH, 'seed')}:/wordpress/wp-content/mu-plugins`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  return new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('Playground did not become ready in 180s')), 180_000);

    child.stdout.on('data', (chunk) => {
      const line = String(chunk);

      process.stdout.write(line);

      if (line.includes('Ready!')) {
        clearTimeout(timer);
        ok(child);
      }
    });

    child.stderr.on('data', (chunk) => process.stderr.write(String(chunk)));
    child.on('exit', (code) => fail(new Error(`Playground exited with ${code}`)));
  });
}

/**
 * The three stylesheets, in the order the real page loads them.
 *
 * WordPress's `forms` and `buttons`, then the admin's `main.css`. Only those
 * two of wp-admin's, because the un-converted controls take their BOX MODEL
 * from them and only their colour and radius from WConvert — a card built from
 * the admin's stylesheet alone renders every native input with no border at
 * all, which is Tailwind's preflight winning a fight it does not win on the
 * real page. The rest of wp-admin's stylesheets dress WordPress's own chrome,
 * which is not in these cards and is not ours to design (ADR 0035).
 *
 * ============================================================================
 * A STYLESHEET IS RESOLVED, NOT NAMED, AND THE RESPONSE IS CHECKED.
 * ============================================================================
 * The first version asked for `/wp-admin/css/buttons.css` by name. That path
 * 301s under this WordPress — it ships no such file, and WordPress's canonical
 * redirect answers with the site's FRONT PAGE at status 200. `fetch` followed
 * it, the card inlined a WordPress home page inside a `<style>` tag, that
 * page's own `</style>` closed the tag early, and the rest landed in the card
 * as visible text.
 *
 * The cards still looked plausible. That is the part worth remembering: a
 * stylesheet that silently is not there does not produce a broken card, it
 * produces a card that is confidently wrong — which in a design system is the
 * expensive kind. So each handle is resolved against a list of candidates, and
 * `content-type: text/css` is what decides, because it is the one thing a
 * redirect into an HTML page cannot fake.
 */
const WP_HANDLES = ['forms', 'buttons'];

async function readStylesheets(context, direction) {
  const sheets = [];

  for (const handle of WP_HANDLES) {
    const candidates = [
      ...(direction === 'rtl'
        ? [`/wp-admin/css/${handle}-rtl.min.css`, `/wp-admin/css/${handle}-rtl.css`]
        : []),
      `/wp-admin/css/${handle}.min.css`,
      `/wp-admin/css/${handle}.css`,
      // WordPress's own concatenator, which serves a handle whose file this
      // build does not ship separately. It does not honour `dir`, so it is
      // last: a real `-rtl` file beats it wherever there is one.
      `/wp-admin/load-styles.php?c=0&dir=${direction}&load%5B%5D=${handle}`,
    ];

    const found = await resolve_(context, candidates);

    if (!found) {
      throw new Error(`no stylesheet for '${handle}' (${direction}); tried ${candidates.join(', ')}`);
    }

    console.log(`    ${direction}: ${handle} ← ${found.from}${found.rtl ? '' : direction === 'rtl' ? ' (no RTL variant)' : ''}`);
    sheets.push(found.css);
  }

  sheets.push(readFileSync(resolve(PLUGIN, 'public/admin/main.css'), 'utf8'));

  return sheets;
}

async function resolve_(context, candidates) {
  for (const path of candidates) {
    const response = await context.request.get(`${ORIGIN}${path}`, { maxRedirects: 0 });

    if (response.status() !== 200) {
      continue;
    }

    if (!/text\/css/i.test(response.headers()['content-type'] ?? '')) {
      continue;
    }

    const css = await response.text();

    if (/<html|<!DOCTYPE/i.test(css)) {
      continue;
    }

    return { css, from: path, rtl: path.includes('-rtl') };
  }

  return null;
}

/**
 * A logged-in storage state, once.
 *
 * The harness does not fake this. `auth_redirect()` validates the auth cookie
 * directly rather than asking `determine_current_user`, so the filter that
 * would short-circuit it is the one thing wp-admin does not consult — and
 * redefining a pluggable function would make every card a measurement of a
 * WordPress this harness modified.
 */
async function logIn(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${ORIGIN}/wp-login.php`);
  await page.fill('#user_login', 'admin');
  await page.fill('#user_pass', 'password');
  await page.click('#wp-submit');
  await page.waitForURL(/wp-admin/);

  const state = await context.storageState();

  await context.close();

  return state;
}

async function seed() {
  const response = await fetch(`${ORIGIN}/?wconvert_ds_seed=${SEED_SECRET}`);

  if (!response.ok) {
    throw new Error(`seeding failed: ${response.status}`);
  }

  return response.text();
}

async function capture({ browser, auth, stylesheets, screen, state, direction }) {
  const context = await browser.newContext({ storageState: auth, viewport: VIEWPORT });

  await context.addCookies(
    [
      { name: 'wconvert_ds_dir', value: direction, url: ORIGIN },
      state === 'failed' ? { name: 'wconvert_ds_state', value: 'failed', url: ORIGIN } : null,
    ].filter(Boolean),
  );

  const page = await context.newPage();

  /*
   * The hold. `route.abort` would reject the fetch — which is `failed`, not
   * `loading` — and fulfilling it late is a timer racing the capture. Never
   * calling anything leaves the request in flight, which is exactly the
   * situation a skeleton answers.
   */
  if (state === 'loading') {
    await page.route(REST, () => {});
  }

  await page.goto(`${ORIGIN}/wp-admin/admin.php?page=wconvert#${screen.id}`, {
    waitUntil: state === 'loading' ? 'commit' : 'load',
  });

  await settle(page, state);

  const card = await page.evaluate(() => {
    const mount = document.getElementById('wconvert-admin');

    if (!mount) {
      return null;
    }

    // The real ancestor chain rather than a guessed one, so any rule keyed on
    // a wp-admin wrapper still applies in the card.
    const chain = [];

    for (let el = mount.parentElement; el && el !== document.body; el = el.parentElement) {
      chain.unshift({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        className: typeof el.className === 'string' ? el.className : '',
      });
    }

    return {
      subtree: mount.outerHTML,
      chain,
      bodyClass: document.body.className,
      dir: getComputedStyle(document.documentElement).direction,
      lang: document.documentElement.getAttribute('lang') ?? 'en',
    };
  });

  await context.close();

  if (!card) {
    throw new Error(`no mount node on ${screen.id}/${state}/${direction}`);
  }

  if (card.dir !== direction) {
    throw new Error(`asked for ${direction}, page computed ${card.dir} on ${screen.id}/${state}`);
  }

  const name = `screen-${screen.id}-${state}${direction === 'rtl' ? '-rtl' : ''}`;
  const path = resolve(OUT, `${name}.html`);

  writeFileSync(path, wrap({ card, screen, state, direction, stylesheets: stylesheets[direction] }));

  console.log(`  ${name}`);

  return name;
}

/**
 * Waiting for the situation rather than for the network.
 *
 * Each of the four has something on screen that is only true of it, so the
 * capture waits for that thing rather than for a duration — which is what
 * keeps a slow boot from being captured as a skeleton.
 */
async function settle(page, state) {
  const app = page.locator('#wconvert-admin');

  await app.waitFor({ state: 'attached', timeout: 30_000 });

  if (state === 'loading') {
    /*
     * Past the 160ms in `shell/skeletonDelay.ts`, because the delayed
     * skeletons are the ones a capture taken too early would miss — and a
     * `role="status"` is what every skeleton in this admin announces itself
     * with, so it is the one selector that finds all six.
     */
    await page.locator('#wconvert-admin [role="status"]').first().waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);

    return;
  }

  if (state === 'failed') {
    await page
      .locator('#wconvert-admin [role="alert"], #wconvert-admin [data-slot="alert"]')
      .first()
      .waitFor({ timeout: 30_000 });

    return;
  }

  // empty and full are both "the fetch finished", and the skeletons leaving is
  // what says so.
  await page.waitForLoadState('networkidle');
  await page.locator('#wconvert-admin [role="status"]').first().waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/**
 * One standalone card.
 *
 * The `@dsCard` marker is the literal first line: the Design System pane builds
 * its index from it, so a byte before it is a card that does not appear.
 */
function wrap({ card, screen, state, direction, stylesheets }) {
  const open = card.chain
    .map(({ tag, id, className }) => `<${tag}${id ? ` id="${id}"` : ''}${className ? ` class="${className}"` : ''}>`)
    .join('');
  const close = card.chain.map(({ tag }) => `</${tag}>`).reverse().join('');
  const title = `${screen.label} — ${state}${direction === 'rtl' ? ' (RTL)' : ''}`;

  return `<!-- @dsCard group="Screens" name="${title}" viewport="1200x900" -->
<!DOCTYPE html>
<html lang="${card.lang}" dir="${direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${stylesheets.map((css) => `<style>\n${css}\n</style>`).join('\n')}
<style>
  /* wp-admin's own body rule, without which every control inherits 13px
     instead of the admin's 14px — one of the three details the Today capture
     had to get right before it matched live. */
  body { margin: 0; background: #f0f0f1; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; font-size: 13px; line-height: 1.4em; }
</style>
</head>
<body class="${card.bodyClass}">
${open}
${card.subtree}
${close}
</body>
</html>
`;
}
