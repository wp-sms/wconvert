import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@renderer/render';
import { exportEntry, importEntry } from '../../resources/admin/src/builder/entry';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * **Authoring is the settings panel plus a dev-only export, not hand-written
 * JSON** (ADR 0010).
 *
 * That is what makes the vocabulary self-testing: every shipped Template is
 * provably expressible in the panel, so we never ship a design the merchant
 * cannot adjust. The export is the half that closes the loop — a design
 * arrived at in the panel comes back out as the library entry it would ship
 * as, and going round again renders the same thing.
 *
 * Rendering is the comparison rather than deep-equalling the trees, because
 * the claim is about what a visitor sees. A round trip that reordered keys or
 * dropped a param the renderer ignores would pass a structural comparison and
 * mean nothing.
 */

const LIBRARY = resolve(import.meta.dirname, '../../resources/templates/library');

const SHIPPED: [string, TemplateEntry][] = readdirSync(LIBRARY)
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const entry = JSON.parse(readFileSync(resolve(LIBRARY, file), 'utf8')) as TemplateEntry;

    return [entry.id, entry];
  });

/** Every step of a design, drawn. */
const drawn = (entry: TemplateEntry): string[] =>
  entry.tree.steps.map((_step, index) => render(entry.tree, entry.tokens, index).outerHTML);

describe('the dev export', () => {
  it('has shipped entries to round-trip, so this is not asserted about nothing', () => {
    expect(SHIPPED.length).toBeGreaterThan(0);
  });

  it.each(SHIPPED)('round-trips a shipped template and renders it identically: %s', (_id, entry) => {
    const back = importEntry(exportEntry(entry));

    expect(back).not.toBeNull();
    expect(drawn(back as TemplateEntry)).toEqual(drawn(entry));
  });
});
