import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRO_SCREENS } from '../../resources/admin/src/screens';

/**
 * =============================================================================
 * PRO'S ADMIN ENTRY IS FREE'S APP PLUS PRO'S, AND NEVER A FORK OF IT.
 * =============================================================================
 * The admin sibling of `loader-boundary.test.ts`, and it guards the same two
 * things one bundle over: the IMPORT DIRECTION (Pro reaches into free, free
 * never reaches into Pro) and the COMPOSITION (Pro's bundle carries every
 * screen free's carries, because Pro REPLACES it — ADR 0014, extended to the
 * admin).
 *
 * A Pro entry that reimplemented the shell would put a second admin app on the
 * installs that pay for support, free to drift from the one every other install
 * runs. The replacement makes that drift silent: free's screen is dequeued, so
 * nobody sees the two side by side.
 *
 * This file reads the entry as TEXT rather than importing it, and that is not
 * laziness. `main.tsx` calls `createRoot(...).render(...)` at module scope —
 * importing it would mount React into jsdom as a side effect of collecting the
 * suite, which is a test that passes or fails on whether a `<div>` happened to
 * be in the document.
 *
 * It lives under pro/ rather than under tests/js/, and that placement is the
 * point: it names Pro's tree, so putting it in free's would make the test
 * itself the leak `bin/verify-source-contract.sh` exists to catch.
 */
const ENTRY = resolve(import.meta.dirname, '../../resources/admin/src/main.tsx');

const source = readFileSync(ENTRY, 'utf8');

describe("Pro's admin entry", () => {
  /**
   * Through the `@` alias, which is free's admin source root and nothing wider
   * (ADR 0036). Pro composing free's `App` is the whole of "replaces rather
   * than augments" on this side.
   */
  it("renders free's App, imported from free's tree", () => {
    expect(source).toMatch(/import\s*\{\s*App\s*\}\s*from\s*'@\/App'/);
    expect(source).toContain('<App />');
  });

  /**
   * **And free's stylesheet, not a copy.** The admin's tokens, its frame and
   * its type are one design (ADR 0037); a Pro bundle building its own sheet
   * from a fork would drift by exactly the amount nobody looks at.
   */
  it("builds free's stylesheet rather than a second one", () => {
    expect(source).toContain("import '@/index.css'");
  });

  /**
   * It mounts the node free's PHP writes. Pro replaces the SCRIPT, not the
   * screen — `AdminMenu::renderScreen()` still runs — so inventing a second
   * mount id here would render Pro's app into nothing.
   */
  it("mounts free's own node, and does nothing when it is absent", () => {
    expect(source).toContain("getElementById('wconvert-admin')");
    expect(source).toMatch(/if\s*\(mount\)/);
  });

  /**
   * ==========================================================================
   * THE TRIPWIRE: THE FIRST PREMIUM SCREEN MAKES THIS BUILD PER-TIER.
   * ==========================================================================
   * Pro's admin bundle is ONE build shared by all three rungs today, and that
   * is honest only while `PRO_SCREENS` is empty: with no premium screen in it,
   * every rung's admin is free's admin and nothing is being withheld from
   * anybody. Nothing is hidden behind a flag, which is the distinction from
   * WSMS — its three tiers ship a byte-identical `main.js` that DOES contain
   * the Elite UI, gated client-side (ADR 0056).
   *
   * The moment a screen lands here that only some rungs supply, one shared
   * build becomes exactly that failure: a Basic customer's ZIP carrying an
   * Elite screen. So this test fails on the pull request that adds the first
   * one, and the message says what to do — the same shape the loader already
   * has, where `vite.config.pro-tier.mjs` builds one bundle per rung from one
   * entry per rung.
   *
   * It is deliberately a failing test rather than a comment. A comment saying
   * "remember to split the admin build" is read by nobody at the moment it
   * matters.
   */
  it('has no premium screen yet, and gains one only with a per-tier admin build', () => {
    expect(
      PRO_SCREENS,
      "Pro's admin now has screens of its own. Before this ships, give the admin " +
        'a build per tier the way the loader has one (vite.config.pro-tier.mjs): ' +
        'one shared bundle would put a higher rung’s screen inside a lower rung’s ZIP, ' +
        'which is the client-side gate ADR 0056 refuses.',
    ).toEqual([]);
  });
});
