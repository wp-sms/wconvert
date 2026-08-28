import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateEntry, TemplateLabels } from '../../resources/admin/src/templates/api';

/**
 * The settings panel, against the boundary it exists to hold: **tokens, slot
 * content and slot visibility — never arrangement** (ADR 0010).
 *
 * The model underneath has its own tests (`tests/js/builder-panel.test.ts`),
 * including the property that no edit can reshape a tree. What is only visible
 * here is the other half of the same claim: that the SCREEN offers no control
 * for it either, and that theme inheritance is something the merchant asks for
 * rather than something that happens.
 */
const api = vi.hoisted(() => ({ getThemeTokens: vi.fn(), getRules: vi.fn(), getOptin: vi.fn(), saveOptin: vi.fn() }));

vi.mock('../../resources/admin/src/builder/api', () => api);

const { SettingsPanel } = await import('../../resources/admin/src/builder/SettingsPanel');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

/**
 * Stand-ins for the words the gallery route serves. The real ones are PHP's,
 * where `wp i18n make-pot` can see them, and are asserted against the manifest
 * in `tests/unit/Template/TemplateLabelParityTest.php`.
 */
const LABELS: TemplateLabels = {
  roles: { headline: 'Headline', fine_print: 'Fine print', consent_text: 'Consent wording' },
  nodes: { image: 'Image' },
  layouts: { stack: 'Column', row: 'Row', split: 'Side by side', grid: 'Grid' },
  fields: { email: 'Email address' },
  keys: { text: 'Text', label: 'Label', placeholder: 'Placeholder', link: 'Link', href: 'Where the button goes' },
  tokens: { bg: 'Background', accent: 'Button' },
};

function panel(props: Partial<Parameters<typeof SettingsPanel>[0]> = {}) {
  const onChange = vi.fn();

  render(
    <SettingsPanel entry={ENTRY} labels={LABELS} dev={false} onChange={onChange} onError={vi.fn()} {...props} />,
  );

  return onChange;
}

beforeEach(() => {
  api.getThemeTokens.mockResolvedValue({ tokens: { bg: '#101820', accent: '#f2aa4c' } });
});

describe('the settings panel', () => {
  it('heads each slot with the Slot Role it fills', () => {
    panel();

    expect(screen.getByText('Headline')).toBeInTheDocument();
    expect(screen.getByText('Fine print')).toBeInTheDocument();
  });

  /**
   * **A `field`'s Roles are derived rather than declared** — they are named
   * for what it captures, so the slot is headed by the kind it captures rather
   * than by a `role` key it does not carry (CONTEXT.md, Slot Role).
   */
  it('heads a field with what it captures', () => {
    panel();

    expect(screen.getByText('Email address')).toBeInTheDocument();
  });

  /**
   * **Consent capture ships off and is one click from on** (ADR 0032). The
   * node is present and hidden, so the panel — which never changes
   * arrangement — can switch it on without the merchant knowing the
   * vocabulary has such a thing.
   */
  it('shows consent as an unticked visibility control rather than as a missing slot', async () => {
    const changed = panel();
    const slot = screen.getByText('Consent wording').closest('fieldset') as HTMLElement;
    const consent = within(slot).getByRole('checkbox', { name: 'Show this' });

    expect(consent).not.toBeChecked();

    await userEvent.click(consent);

    expect(changed).toHaveBeenCalled();
  });

  /**
   * **No way to change arrangement.** The vocabulary is the ceiling on design
   * variety and the gallery IS the design surface; a panel that could add,
   * remove or reorder a node would move that ceiling into a builder nobody
   * designed, and would cost the no-migration guarantee a canvas depends on.
   */
  it('offers nothing that adds, removes or moves a slot', () => {
    panel();

    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent ?? '').not.toMatch(/add|remove|delete|move|up|down/i);
    }
  });

  /**
   * **Theme inheritance is opt-in, and off until it is asked for.** A stored
   * "inherit" flag would restyle every running Optin the day the merchant
   * switches theme — the surprise ADR 0010 keeps a Template's snapshot away
   * from — so this is a button that copies values once, and nothing reads the
   * theme unless it is pressed.
   */
  it('reads nothing from the theme until the merchant asks for it', async () => {
    const changed = panel();

    expect(api.getThemeTokens).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Copy my theme/ }));

    expect(api.getThemeTokens).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(changed).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: expect.objectContaining({ bg: '#101820', accent: '#f2aa4c' }) }),
      ),
    );
  });

  /**
   * ========================================================================
   * SELECTION MOVES THE CARET ONE WAY ONLY.
   * ========================================================================
   * A click in the PREVIEW has to put the caret in the block that edits that
   * slot — otherwise the affordance is an outline and nothing else. A focus
   * that started HERE must not then drag the caret back to the top of the
   * block, which on every keystroke's re-render would take it out of the field
   * being typed in. Same key, opposite obligations, which is why the origin
   * travels with it (ADR 0040).
   */
  it('puts the caret in the block a preview click names', () => {
    panel({ selection: { key: 'role:headline', from: 'preview' } });

    const slot = screen.getByText('Headline').closest('fieldset') as HTMLElement;

    expect(within(slot).getAllByRole('textbox')[0]).toHaveFocus();
  });

  it('reaches a field by what it captures, which is the only key it has', () => {
    panel({ selection: { key: 'captures:email', from: 'preview' } });

    const slot = screen.getByText('Email address').closest('fieldset') as HTMLElement;

    expect(within(slot).getAllByRole('textbox')[0]).toHaveFocus();
  });

  it('does not move the caret for a selection that started in the panel', () => {
    panel({ selection: { key: 'role:headline', from: 'panel' } });

    expect(document.body).toHaveFocus();
  });

  /** Focusing a block is what tells the preview which slot to outline. */
  it('reports the slot a merchant focuses, so the preview can outline it', async () => {
    const chosen = vi.fn();

    panel({ onSelect: chosen });

    const slot = screen.getByText('Headline').closest('fieldset') as HTMLElement;

    await userEvent.click(within(slot).getAllByRole('textbox')[0]);

    expect(chosen).toHaveBeenCalledWith('role:headline');
  });

  /**
   * ========================================================================
   * PRESETS CARRY THE MEDIAN CASE; THE RAW TOKENS KEEP THE TAIL (#71).
   * ========================================================================
   * A preset is a bundle of token VALUES and nothing else, so it changes no
   * shape and needs no new vocabulary — which is what keeps ADR 0010's
   * boundary where it is while fixing the panel that asked a merchant for
   * `rgba(15, 23, 42, 0.55)` in a text box.
   */
  it('applies a preset as token values, and touches nothing else', async () => {
    const changed = panel();

    await userEvent.click(screen.getByRole('button', { name: /Midnight/ }));

    const [next] = changed.mock.calls[0] as [{ tokens: Record<string, string>; tree: unknown }];

    expect(next.tokens.bg).toBe('#0f172a');
    expect(next.tokens.accent).toBe('#38bdf8');
    // The tree is the SAME object: a preset cannot express arrangement, because
    // there is nowhere in a token bundle to put one.
    expect(next.tree).toBe(ENTRY.tree);
  });

  /** **Every raw token is still reachable**, behind the disclosure (#71). */
  it('keeps every token the manifest declares, once', () => {
    panel();

    // A colour is a picker rather than a text box; the rest keep the box they
    // had, because there is no visual control for `1.5rem` that is not a guess.
    expect(screen.getByRole('button', { name: /Choose a colour for Background/ })).toBeInTheDocument();
    // The stub names only two tokens, so the rest fall back to their raw key —
    // which is what `nameOf` does on a real install missing a label too.
    expect(screen.getByLabelText('font')).toBeInTheDocument();
  });

  /** **Authoring is the settings panel plus a DEV-ONLY export** (ADR 0010). */
  it('keeps the library entry behind WP_DEBUG', () => {
    panel();

    expect(screen.queryByText(/Library entry/)).toBeNull();

    panel({ dev: true });

    expect(screen.getByText(/Library entry/)).toBeInTheDocument();
  });
});
