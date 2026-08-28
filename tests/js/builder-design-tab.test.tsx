import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateEntry, TemplateLabels } from '../../resources/admin/src/templates/api';

/**
 * ============================================================================
 * THE LOOK, ON THE TAB THE WORD DESIGN ALREADY PROMISED.
 * ============================================================================
 * These assertions were `tests/js/builder-settings-panel.test.tsx`, over a
 * component that held two halves of two different questions: what the design
 * says, and how it looks. The first half moved to the inspector under the block
 * tree (`builder-structure-view.test.tsx`); this is the second.
 *
 * ============================================================================
 * ONE ASSERTION WAS DELETED RATHER THAN MOVED, AND IT IS NAMED HERE.
 * ============================================================================
 * **`'offers nothing that adds, removes or moves a slot'`** guarded ADR 0010's
 * *"the panel edits tokens, slot content and slot visibility — never
 * arrangement"* by sweeping every button on the screen for the words *add*,
 * *remove*, *delete*, *move*, *up* and *down*.
 *
 * It is gone because it stopped being true, deliberately: one surface now edits
 * words **and** arrangement, and the tab it guards has a Delete on every row.
 * The substance of ADR 0010 is untouched and is asserted elsewhere — the
 * vocabulary is still the ceiling (`builder-structure.test.ts`,
 * `catalogue.ts` reads the manifest), the gallery is still where a design comes
 * from, and a preset still cannot express a shape, which is the one clause this
 * file still holds.
 */

const api = vi.hoisted(() => ({ getThemeTokens: vi.fn() }));

vi.mock('../../resources/admin/src/builder/api', () => api);

const { Tokens } = await import('../../resources/admin/src/builder/Tokens');
const { DevExport } = await import('../../resources/admin/src/builder/DevExport');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

/**
 * Stand-ins for the words the gallery route serves. The real ones are PHP's,
 * where `wp i18n make-pot` can see them, and are asserted against the manifest
 * in `tests/unit/Template/TemplateLabelParityTest.php`.
 */
const LABELS: TemplateLabels = {
  roles: {},
  nodes: {},
  layouts: {},
  fields: {},
  keys: {},
  params: { submit: 'Sends the form', link: 'Goes somewhere else' },
  tokens: { bg: 'Background', accent: 'Button' },
};

function look(over: Partial<Parameters<typeof Tokens>[0]> = {}) {
  const onChange = vi.fn();

  render(
    <Tokens template={ENTRY} labels={LABELS} onChange={onChange} onError={vi.fn()} {...over} />,
  );

  return onChange;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getThemeTokens.mockResolvedValue({ tokens: { bg: '#101820', accent: '#f2aa4c' } });
});

describe('the look', () => {
  /**
   * ==========================================================================
   * PRESETS CARRY THE MEDIAN CASE; THE RAW TOKENS KEEP THE TAIL (#71).
   * ==========================================================================
   * A preset is a bundle of token VALUES and nothing else, so it changes no
   * shape and needs no new vocabulary — which is the clause of ADR 0010 that
   * survived the merge intact.
   */
  it('applies a preset as token values, and touches nothing else', async () => {
    const changed = look();

    await userEvent.click(screen.getByRole('button', { name: /Midnight/ }));

    const [next] = changed.mock.calls[0] as [{ tokens: Record<string, string>; tree: unknown }];

    expect(next.tokens.bg).toBe('#0f172a');
    expect(next.tokens.accent).toBe('#38bdf8');
    // The tree is the SAME object: a preset cannot express arrangement, because
    // there is nowhere in a token bundle to put one.
    expect(next.tree).toBe(ENTRY.tree);
  });

  /**
   * **Theme inheritance is opt-in, and off until it is asked for.** A stored
   * "inherit" flag would restyle every running Optin the day the merchant
   * switches theme — the surprise ADR 0010 keeps a Template's snapshot away
   * from — so this is a button that copies values once.
   */
  it('reads nothing from the theme until the merchant asks for it', async () => {
    const changed = look();

    expect(api.getThemeTokens).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Copy my theme/ }));

    expect(api.getThemeTokens).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(changed).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: expect.objectContaining({ bg: '#101820', accent: '#f2aa4c' }) }),
      ),
    );
  });

  /** **Every raw token is still reachable**, behind the disclosure (#71). */
  it('keeps every token the manifest declares, once', () => {
    look();

    // A colour is a picker rather than a text box.
    expect(screen.getByRole('button', { name: /Choose a colour for Background/ })).toBeInTheDocument();
    // The stub names only two tokens, so the rest fall back to their raw key —
    // which is what `nameOf` does on a real install missing a label too.
    expect(screen.getByLabelText('font')).toBeInTheDocument();
  });
});

/** **Authoring is the editor plus a DEV-ONLY export** (ADR 0010). */
describe('the library entry', () => {
  it('reads a design back out as the entry it would ship as', async () => {
    const changed = vi.fn();

    render(<DevExport entry={ENTRY} onChange={changed} />);

    // The entry as it would ship, in the key order the library files use — so
    // an export can be dropped into `resources/templates/library/` and diffed
    // against its neighbours rather than reformatted first.
    expect((screen.getByLabelText('Library entry JSON') as HTMLTextAreaElement).value).toContain(
      '"id": "centred-card"',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Load this design' }));

    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ tree: expect.anything() }));
  });

  it('says so rather than throwing when what was pasted is not one', async () => {
    const changed = vi.fn();

    render(<DevExport entry={ENTRY} onChange={changed} />);

    await userEvent.clear(screen.getByLabelText('Library entry JSON'));
    await userEvent.type(screen.getByLabelText('Library entry JSON'), 'not json');
    await userEvent.click(screen.getByRole('button', { name: 'Load this design' }));

    expect(screen.getByText('That is not a library entry.')).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
});
