import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FREQUENCY_FIELDS } from '../../resources/admin/src/builder/api';

/**
 * ============================================================================
 * ONE ALLOWANCE, THREE LANGUAGES, AND NOTHING ASSERTED THEY AGREED.
 * ============================================================================
 * `resources/loader/src/types.ts` declares the four fields for the engine that
 * reads them, `src/Optin/Frequency.php` normalises them on the way in, and
 * `builder/rules/HowOften.tsx` is the surface that writes them. The payload is
 * inlined into every matching page verbatim, so all three must spell the same
 * names in the same casing — a translation layer between any two of them would
 * be a second vocabulary.
 *
 * **They were two spellings with no reader for years.** The loader has honoured
 * all four since #3; nothing wrote any of them, and
 * `PublishedProjectionTest` fixtured `['once_per' => 'session']` — a key
 * neither side has ever read — while passing, because it asserted which keys
 * travel rather than what is in them.
 *
 * This is the assertion that stops the three drifting. It reads the source of
 * the other two rather than importing them: the loader is a separate build
 * with its own `tsconfig` path, PHP cannot be imported at all, and a TypeScript
 * interface is erased before a test could look at it. That is why
 * {@link FREQUENCY_FIELDS} exists as a value.
 */
const ROOT = resolve(import.meta.dirname, '../..');

const source = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** The body of one `interface X { … }`, as text. */
function interfaceBody(text: string, name: string): string {
  const start = text.indexOf(`export interface ${name} {`);

  expect(start, `no interface ${name} to read`).toBeGreaterThan(-1);

  const body = text.slice(start);

  return body.slice(0, body.indexOf('\n}'));
}

describe('the allowance', () => {
  it('spells the same four fields in the engine that reads it', () => {
    const declared = interfaceBody(source('resources/loader/src/types.ts'), 'Frequency');

    for (const field of FREQUENCY_FIELDS) {
      expect(declared, field).toMatch(new RegExp(`readonly ${field}\\?:`));
    }
  });

  /**
   * Both directions. A field the loader gained and this bundle did not is a
   * setting no merchant can reach; one this bundle gained and the loader did
   * not is a control that decides nothing.
   */
  it('declares nothing the engine does not read', () => {
    const declared = interfaceBody(source('resources/loader/src/types.ts'), 'Frequency');
    const found = [...declared.matchAll(/readonly (\w+)\?:/g)].map((match) => match[1]);

    expect(found.sort()).toEqual([...FREQUENCY_FIELDS].sort());
  });

  /** And the value object that normalises it on the way in names them too. */
  it('spells the same four fields in the value object that stores it', () => {
    const php = source('src/Optin/Frequency.php');

    for (const field of FREQUENCY_FIELDS) {
      expect(php, field).toContain(`'${field}'`);
    }
  });

  /**
   * **The two switches default ON, in all three.** `frequency.ts` tests
   * `!== false` because closing a popup and completing one are the two
   * strongest "stop showing me this" a visitor has (ADR 0017) — so a surface
   * that read them as `=== true` would turn every untouched Optin into one
   * that reappears after the visitor closed it.
   */
  it('reads the two switches as on-unless-false, everywhere they are read', () => {
    for (const path of [
      'resources/loader/src/frequency.ts',
      'resources/admin/src/builder/rules/HowOften.tsx',
      'resources/admin/src/builder/rules/sentence.ts',
    ]) {
      const text = source(path);

      expect(text, path).toMatch(/stopAfterDismiss[^\n]*!==\s*false/);
      expect(text, path).toMatch(/stopAfterConversion[^\n]*!==\s*false/);
    }
  });
});
