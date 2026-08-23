// Shared harness plumbing. The interesting part is `diff()`: leakage is defined as
// a computed-style delta from the reference render, never as a human eyeballing it.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { PROBED, ELEMENTS } from '../src/template.js';

export const SITE = process.env.WCV_SITE || 'http://wconvert.local';
export const WP = process.env.WCV_WP || '/private/tmp/claude-501/-Users-navidkashani-Local-Sites-wconvert-app-public-wp-content-plugins-wconvert/864f57f9-ba41-48b9-9b3c-551bfa5e5930/scratchpad/wpc';

export const MODES = ['shadow', 'shadow-dir', 'shadow-fixed', 'shadow-armour', 'shadow-bare', 'shadow-open', 'scoped', 'scoped-imp', 'iframe', 'shadow-html', 'dialog'];

export function wp(...args) {
  return execFileSync(WP, args, { encoding: 'utf8' }).trim();
}

export function useTheme(slug) {
  wp('theme', 'activate', slug);
}

export async function browser() {
  return chromium.launch();
}

export function url(params) {
  const q = new URLSearchParams(params).toString();
  return `${SITE}/?${q}`;
}

async function settle(page) {
  await page.waitForSelector('html[data-wcv10-ready]', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(250); // shadow/iframe font faces land on their own clock
}

/** The reference render: same markup, same CSS, no theme. Ground truth. */
export async function reference(ctx, extra = {}) {
  const page = await ctx.newPage();
  await page.goto(url({ wcv10_ref: 1, ...extra }));
  await settle(page);
  const styles = await page.evaluate(([els, props]) => {
    const out = {};
    for (const sel of els) {
      const el = document.querySelector(sel);
      if (!el) { out[sel] = null; continue; }
      const cs = getComputedStyle(el);
      const p = {};
      for (const k of props) p[k] = cs.getPropertyValue(k).trim();
      out[sel] = p;
    }
    return out;
  }, [ELEMENTS, PROBED]);
  const font = await page.evaluate(() => {
    const t = document.querySelector('.wcv-title');
    const r = document.createRange();
    r.selectNodeContents(t);
    return { textWidth: Math.round(r.getBoundingClientRect().width * 100) / 100 };
  });
  const rects = await page.evaluate(([els]) => {
    const out = {};
    for (const sel of els) {
      const el = document.querySelector(sel);
      if (!el) { out[sel] = null; continue; }
      const r = el.getBoundingClientRect();
      out[sel] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  }, [ELEMENTS]);
  await page.close();
  return { styles, font, rects };
}

/** One (theme, mode, hostility) cell. */
export async function probe(ctx, params, { collect = ['styles', 'rects', 'hitTest', 'font', 'a11y', 'exposure', 'dir'] } = {}) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(url(params), { waitUntil: 'domcontentloaded' });
  try {
    await settle(page);
  } catch (e) {
    await page.close();
    return { failed: 'never mounted', errors };
  }
  const out = { errors };
  for (const k of collect) {
    try {
      out[k] = await page.evaluate((key) => window.__WCV10[key](), k);
    } catch (e) {
      out[k] = { error: String(e.message || e) };
    }
  }
  out._page = page;
  return out;
}

/** Property-level deltas from the reference. This is the leakage measure. */
export function diff(ref, got) {
  const deltas = [];
  for (const sel of ELEMENTS) {
    const a = ref[sel], b = got && got[sel];
    if (!a || !b) { deltas.push({ sel, prop: '@element', want: a ? 'present' : 'absent', got: b ? 'present' : 'absent' }); continue; }
    for (const p of PROBED) {
      if (a[p] !== b[p]) deltas.push({ sel, prop: p, want: a[p], got: b[p] });
    }
  }
  return deltas;
}

export function pad(s, n) { return String(s).padEnd(n); }
export function padl(s, n) { return String(s).padStart(n); }
