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

  /** **Authoring is the settings panel plus a DEV-ONLY export** (ADR 0010). */
  it('keeps the library entry behind WP_DEBUG', () => {
    panel();

    expect(screen.queryByText(/Library entry/)).toBeNull();

    panel({ dev: true });

    expect(screen.getByText(/Library entry/)).toBeInTheDocument();
  });
});
