import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { capturesKey, roleKey } from '../../resources/admin/src/builder/slots';
import type { Mounted } from '../../resources/renderer/src/mount';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * The preview as an INPUT (ADR 0040), against the two things about it that are
 * not layout: that a slot is reachable without a mouse, and that reaching one
 * writes nothing.
 *
 * ============================================================================
 * IT REACHES THE TREE THE ONE WAY ANYTHING CAN, AND THAT IS THE ASSERTION.
 * ============================================================================
 * The rendered step lives inside a **closed** shadow root, so
 * `screen.getByRole` cannot see it and `host.shadowRoot` is null — deliberately,
 * and unchanged by this work (ADR 0009). What `mount()` does offer is the
 * rendered element, handed to whoever mounted it: *"handed to the caller rather
 * than the shadow root itself, so `closed` still means what it says to
 * everything that did not mount this."*
 *
 * So this test becomes a caller. It wraps `mount` and keeps what it returned,
 * which is exactly the affordance `Preview` uses — and if that affordance ever
 * stopped being enough, these tests would fail for the same reason the feature
 * would.
 */

const mounts = vi.hoisted(() => [] as Mounted[]);

vi.mock('@renderer/mount', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../resources/renderer/src/mount')>();

  return {
    ...real,
    mount: (options: Parameters<typeof real.mount>[0]) => {
      const mounted = real.mount(options);

      mounts.push(mounted);

      return mounted;
    },
  };
});

const { Preview } = await import('../../resources/admin/src/builder/Preview');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

/** The step currently on screen — a getter, because `showStep` replaces it. */
const drawn = () => mounts.at(-1)?.root as HTMLElement;

const slots = () => [...drawn().querySelectorAll<HTMLElement>('[data-role],[data-captures]')];

beforeEach(() => {
  mounts.length = 0;
});

describe('a slot in the preview', () => {
  /**
   * **A click handler on a heading is a pointer-only affordance**, and this is
   * an editing surface rather than a picture — so WCAG 2.1 AA's first criterion
   * applies to it directly (ADR 0038). A heading is focusable by nothing, so it
   * is made so, and named for what it says rather than "button 3 of 5".
   */
  it('is a named, keyboard-reachable control where the design gave it none', () => {
    render(<Preview template={ENTRY} onSelect={vi.fn()} />);

    const headline = within(drawn()).getByRole('button', {
      name: 'Edit “Get 10% off your first order”',
    });

    expect(headline.tabIndex).toBe(0);
  });

  it('reports itself on Enter and on Space, the way its role promises', () => {
    const chosen = vi.fn();

    render(<Preview template={ENTRY} onSelect={chosen} />);

    /*
     * Dispatched at the element rather than typed at `document.activeElement`,
     * because a CLOSED root does not publish its focus: the document's active
     * element is the host, so a keystroke aimed there never reaches the slot.
     * The browser has no such problem — it delivers to the real target — and
     * this is that delivery.
     */
    const headline = within(drawn()).getByRole('button', { name: /Get 10% off/ });

    headline.focus();

    fireEvent.keyDown(headline, { key: 'Enter' });
    expect(chosen).toHaveBeenCalledWith(roleKey('headline'));

    chosen.mockClear();

    // Space scrolls the page otherwise, which on a sticky preview moves the
    // thing the merchant was aiming at.
    const space = fireEvent.keyDown(headline, { key: ' ', cancelable: true });

    expect(chosen).toHaveBeenCalledWith(roleKey('headline'));
    expect(space).toBe(false);
  });

  /**
   * **The field and the CTA are already controls**, because the preview is the
   * real render — so they are selected by being FOCUSED rather than wrapped in
   * a `role="button"` that would announce an input as a button.
   */
  it('is selected by focus where the design already made it focusable', () => {
    const chosen = vi.fn();

    render(<Preview template={ENTRY} onSelect={chosen} />);

    const field = slots().find((slot) => slot.dataset.captures === 'email');

    expect(field?.getAttribute('role')).toBeNull();

    field?.querySelector('input')?.focus();

    expect(chosen).toHaveBeenCalledWith(capturesKey('email'));
  });

  /**
   * **Selection edits nothing**, which is what keeps ADR 0010's boundary where
   * it was. A click reports which slot was clicked and stops there; the panel
   * is still the only thing that writes.
   */
  it('reports the slot and changes nothing about the design', async () => {
    const chosen = vi.fn();
    const before = JSON.stringify(ENTRY.tree);

    render(<Preview template={ENTRY} onSelect={chosen} />);

    await userEvent.click(within(drawn()).getByRole('button', { name: /No spam/ }));

    expect(chosen).toHaveBeenCalledWith(roleKey('fine_print'));
    expect(JSON.stringify(ENTRY.tree)).toBe(before);
  });

  /**
   * The converting act is a real submit button and a real `<a>`, because the
   * preview is the real render. Neither may act: a navigation would take the
   * merchant off the builder mid-edit.
   */
  it('does not let the converting act convert', () => {
    render(<Preview template={ENTRY} onSelect={vi.fn()} />);

    const cta = slots().find((slot) => slot.dataset.role === 'cta_label');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });

    cta?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  /**
   * With no `onSelect` — which is the gallery, where a card is a picture and
   * the stylesheet turns every pointer event off — nothing is bound at all.
   */
  it('binds nothing when nobody is listening', () => {
    render(<Preview template={ENTRY} />);

    expect(within(drawn()).queryByRole('button', { name: /^Edit/ })).toBeNull();
    // The CTA is a real `<button>` and is focusable whatever this file does, so
    // what is asserted is that nothing here MADE anything focusable or renamed
    // it — not that the design has no controls of its own.
    expect(slots().some((slot) => slot.hasAttribute('aria-label'))).toBe(false);
  });

  /** The outline is the admin's, painted over a tree it does not own. */
  it('outlines the selected slot and only that one', () => {
    render(<Preview template={ENTRY} selected={roleKey('headline')} onSelect={vi.fn()} />);

    const outlined = slots().filter((slot) => slot.style.outline !== '');

    expect(outlined.map((slot) => slot.dataset.role)).toEqual(['headline']);
  });
});

/**
 * ============================================================================
 * THE SITE'S PRIVACY POLICY, RESOLVED WHERE IT IS DRAWN AND NOWHERE ELSE (#77).
 * ============================================================================
 * `PolicyLink::into()` has two call sites — the published payload and the
 * capture path — and neither is a path the admin reads. So `link.href` was
 * always absent here, the renderer did the right thing for an unresolved link
 * (no anchor at all, never a dead `#`, ADR 0032), and every preview, every
 * gallery card and the creation flow's last step read:
 *
 *     No spam, and you can unsubscribe at any time. See our.
 *
 * — under a field labelled *"leave empty for your privacy policy"*.
 *
 * **The fix could not be server-side, and that is the half worth asserting.**
 * `GET /optins/{id}` hands the builder a config it PATCHes straight back, and
 * `href` is a content key the vocabulary keeps — so an href resolved on the way
 * out is an href STORED on the way back, frozen at publish, which is exactly
 * what ADR 0032 exists to prevent. So the admin owns the link at the render,
 * the same way the renderer does, and what it produces is thrown away with the
 * render.
 */
describe('the consent link the admin draws', () => {
  const POLICY = 'https://example.test/privacy';

  /**
   * **A Template carries no words, so the sentence comes from a [[Playbook]]**
   * — `welcome-discount.php` binds `fine_print` to *"No spam, and you can
   * unsubscribe at any time. See our %s."* and the site supplies the
   * destination (ADR 0032). That is the exact shape #77 reported, so it is the
   * shape asserted rather than a shipped Template's own placeholder, which
   * carries no `%s` at all.
   */
  const prefilled = (): TemplateEntry =>
    ({
      ...ENTRY,
      tree: {
        steps: [
          {
            type: 'stack',
            children: [
              {
                type: 'text',
                role: 'fine_print',
                text: 'No spam, and you can unsubscribe at any time. See our %s.',
                link: { label: 'Privacy Policy' },
              },
              { type: 'button', role: 'cta_label', label: 'Go', action: 'submit' },
            ],
          },
          { type: 'stack', children: [] },
        ],
      },
    }) as unknown as TemplateEntry;

  const fineOf = (root: HTMLElement) =>
    root.querySelector<HTMLElement>('[data-role="fine_print"]');

  beforeEach(() => {
    window.wconvertAdmin = { exportUrl: '', policyUrl: POLICY };
  });

  it('renders the site’s policy rather than a sentence ending in “See our.”', () => {
    render(<Preview template={prefilled()} />);

    const anchor = fineOf(drawn())?.querySelector('a');

    expect(anchor?.getAttribute('href')).toBe(POLICY);
    expect(fineOf(drawn())?.textContent).toBe(
      'No spam, and you can unsubscribe at any time. See our Privacy Policy.',
    );
  });

  /**
   * **The tree the builder would SAVE is untouched.** This is the assertion the
   * whole placement rests on: resolve it into the config and the merchant's
   * next save freezes last month's policy URL into their Optin.
   */
  it('writes the resolved link nowhere the builder could save it', () => {
    const template = prefilled();
    const before = JSON.stringify(template);

    render(<Preview template={template} />);

    expect(JSON.stringify(template)).toBe(before);
    expect(fineOf(drawn())?.querySelector('a')).not.toBeNull();
  });

  /**
   * A site with no policy configured has no link to offer, and offering a
   * broken one is worse than offering none (ADR 0032). The renderer's rule is
   * untouched; what is asserted is that nothing here invents a destination.
   */
  it('adds nothing where the site has no policy', () => {
    window.wconvertAdmin = { exportUrl: '' };

    render(<Preview template={prefilled()} />);

    expect(fineOf(drawn())?.querySelector('a')).toBeNull();
  });

  /**
   * A link that names its OWN destination was written by the merchant and
   * scheme-validated at write (ADR 0013). The rule is about the link and not
   * about the node, which is why consent wording and fine print resolve
   * identically with no table of Slot Roles to keep in step.
   */
  it('leaves a link the merchant addressed alone', () => {
    const own = 'https://example.test/ours';
    const template = {
      ...ENTRY,
      tree: {
        steps: [
          {
            type: 'stack',
            children: [
              {
                type: 'text',
                role: 'fine_print',
                text: 'See our %s.',
                link: { label: 'Terms', href: own },
              },
              { type: 'button', role: 'cta_label', label: 'Go', action: 'submit' },
            ],
          },
          { type: 'stack', children: [] },
        ],
      },
    } as unknown as TemplateEntry;

    render(<Preview template={template} />);

    expect(drawn().querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe(own);
  });
});
