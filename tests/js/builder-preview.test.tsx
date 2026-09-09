import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keyOfElement } from '../../resources/admin/src/builder/slots';
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

/** Every addressable element, which is every node the renderer drew. */
const boxes = () => [...drawn().querySelectorAll<HTMLElement>('[data-path]')];

/** Where a Role sits, as the address both sides now speak in. */
const at = (role: string): string =>
  keyOfElement(slots().find((slot) => slot.dataset.role === role) as HTMLElement) as string;

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
    expect(chosen).toHaveBeenCalledWith(at('headline'));

    chosen.mockClear();

    // Space scrolls the page otherwise, which on a sticky preview moves the
    // thing the merchant was aiming at.
    const space = fireEvent.keyDown(headline, { key: ' ', cancelable: true });

    expect(chosen).toHaveBeenCalledWith(at('headline'));
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

    expect(chosen).toHaveBeenCalledWith(keyOfElement(field as HTMLElement));
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

    expect(chosen).toHaveBeenCalledWith(at('fine_print'));
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

    // And asks the renderer for no addresses either, which is the same line
    // ADR 0040 draws for a visitor's page: a picture has nothing to select.
    expect(boxes()).toHaveLength(0);
    expect(within(drawn()).queryByRole('button', { name: /^Edit/ })).toBeNull();
    // The CTA is a real `<button>` and is focusable whatever this file does, so
    // what is asserted is that nothing here MADE anything focusable or renamed
    // it — not that the design has no controls of its own.
    expect(slots().some((slot) => slot.hasAttribute('aria-label'))).toBe(false);
  });

  /** The outline is the admin's, painted over a tree it does not own. */
  it('outlines the selected block and only that one', () => {
    const { rerender } = render(<Preview template={ENTRY} onSelect={vi.fn()} />);

    rerender(<Preview template={ENTRY} selected={at('headline')} onSelect={vi.fn()} />);

    const outlined = boxes().filter((slot) => slot.style.outline !== '');

    expect(outlined.map((slot) => slot.dataset.role)).toEqual(['headline']);
  });
});

/**
 * ============================================================================
 * A BOX IS THE PRIMARY GESTURE OF A SCOPE EDITOR, AND IT WAS UNCLICKABLE.
 * ============================================================================
 * Selection was addressed by [[Slot Role]] and a container carries none, so
 * `SLOT_SELECTOR` did not match one: a press on a coloured box reached the
 * nearest leaf inside it. The renderer stamps the address now (ADR 0040,
 * amended) and these are the four things that makes true.
 */
describe('a container in the preview', () => {
  const FIELDWORK = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/fieldwork.json'), 'utf8'),
  ) as TemplateEntry;

  it('is selectable, which is what the whole change is for', async () => {
    const chosen = vi.fn();

    render(<Preview template={FIELDWORK} onSelect={chosen} />);

    const panel = boxes().find((box) => box.className === 'wc-panel');

    expect(panel, 'fieldwork has no panel to press').toBeDefined();

    await userEvent.click(panel as HTMLElement);

    expect(chosen).toHaveBeenCalledWith(keyOfElement(panel as HTMLElement));
  });

  /**
   * ==========================================================================
   * A PRESS TAKES THE OUTER BOX, AND THE NEXT ONE GOES A LEVEL DEEPER.
   * ==========================================================================
   * This was *"answers with the innermost box under the pointer"* — `closest()`
   * from the press — which is the right answer to *what did I point at* and the
   * wrong one to *what am I working on*. On any real design the innermost thing
   * under a pointer is a leaf, a leaf carries no `tokens` bag, and the Style
   * panel's whole subject is boxes: so pressing a box reported the headline
   * inside it and the panel said *"this block takes its look from Column"*,
   * every time, for every box.
   *
   * Measured on `split-hero` before the change: of 168 points across the
   * preview, 21 selected the Column and NONE reached the design at all — its
   * children cover every pixel of it. The chain is walked now, one link per
   * press, and the design is the last link rather than the first.
   */
  const chainFrom = (role: string) => {
    const leaf = slots().find((slot) => slot.dataset.role === role) as HTMLElement;
    const box = leaf.parentElement?.closest<HTMLElement>('[data-path]') as HTMLElement;
    const design = boxes()[0] as HTMLElement;

    return { leaf, box, design };
  };

  it('takes the outer box first, so a box is what a press on one selects', async () => {
    const chosen = vi.fn();

    render(<Preview template={FIELDWORK} onSelect={chosen} />);

    const { leaf, box } = chainFrom('headline');

    await userEvent.click(leaf);

    expect(chosen).toHaveBeenCalledTimes(1);
    expect(chosen).toHaveBeenCalledWith(keyOfElement(box));
  });

  it('goes one level deeper when the same point is pressed again', async () => {
    const chosen = vi.fn();
    const { rerender } = render(<Preview template={FIELDWORK} onSelect={chosen} />);

    const { leaf, box } = chainFrom('headline');

    // The selection the first press produced, handed back the way the builder
    // hands it back — which is what the second press steps on from.
    rerender(<Preview template={FIELDWORK} selected={keyOfElement(box)} onSelect={chosen} />);
    await userEvent.click(leaf);

    expect(chosen).toHaveBeenLastCalledWith(keyOfElement(leaf));
  });

  /**
   * **The design is the last link, and before this it was reachable from no
   * point in the preview at all** — every pixel of it is covered by a child, so
   * an innermost-wins press could never land on it. It is last rather than
   * first because it is in every press's chain: leading with it would put a
   * step between the merchant and every box on the screen.
   */
  it('takes the design itself on the press after the innermost', async () => {
    const chosen = vi.fn();
    const { rerender } = render(<Preview template={FIELDWORK} onSelect={chosen} />);

    const { leaf, design } = chainFrom('headline');

    rerender(<Preview template={FIELDWORK} selected={keyOfElement(leaf)} onSelect={chosen} />);
    await userEvent.click(leaf);

    expect(chosen).toHaveBeenLastCalledWith(keyOfElement(design));
  });

  /**
   * A selection that is not on the way to the point pressed says nothing about
   * how deep that press should go, so it starts again at the top.
   */
  it('starts again at the outer box when the press lands somewhere else', async () => {
    const chosen = vi.fn();
    const { rerender } = render(<Preview template={FIELDWORK} onSelect={chosen} />);

    const { leaf, box } = chainFrom('headline');
    const elsewhere = slots().find((slot) => slot.dataset.role !== 'headline') as HTMLElement;

    rerender(<Preview template={FIELDWORK} selected={keyOfElement(elsewhere)} onSelect={chosen} />);
    await userEvent.click(leaf);

    expect(chosen).toHaveBeenLastCalledWith(keyOfElement(box));
  });

  /**
   * **Without this the drill is a guess.** Every addressable element already
   * carries `cursor: pointer`, so the whole preview says "clickable" and
   * nothing said what — which is what made a merchant press the same spot twice
   * expecting a different answer. Dashed against the selection's solid, because
   * what is being drawn is *chosen* against *would be chosen*.
   */
  it('shows what the next press would take, under the pointer', async () => {
    render(<Preview template={FIELDWORK} onSelect={vi.fn()} />);

    const { leaf, box } = chainFrom('headline');

    await userEvent.hover(leaf);

    expect(box.style.outline).toContain('dashed');
    expect(leaf.style.outline).toBe('');
  });

  it('lets the selection win where the hint would land on it too', async () => {
    const { rerender } = render(<Preview template={FIELDWORK} onSelect={vi.fn()} />);

    const { leaf, box } = chainFrom('headline');

    rerender(<Preview template={FIELDWORK} selected={keyOfElement(box)} onSelect={vi.fn()} />);
    // Over the LEAF: the chain there is design → box → leaf, and the box is
    // already selected, so one link on is the leaf. Hovering the box's own
    // ground instead is a two-link chain and hints the design, which is the
    // press that would actually happen there.
    await userEvent.hover(leaf);

    expect(box.style.outline).toContain('solid');
    expect(leaf.style.outline).toContain('dashed');
  });

  /**
   * **A box is pointer-only here, and its keyboard route is the block tree.**
   * A `panel` announced as a button would be named by every word inside it, and
   * six nested boxes are six tab stops between one headline and the next. The
   * tree is a treegrid over the same nodes, in the same region, before the
   * preview in the DOM.
   */
  it('is not a tab stop, because naming it would name everything inside it', () => {
    render(<Preview template={FIELDWORK} onSelect={vi.fn()} />);

    const panel = boxes().find((box) => box.className === 'wc-panel') as HTMLElement;

    expect(panel.hasAttribute('tabindex')).toBe(false);
    expect(panel.hasAttribute('aria-label')).toBe(false);
  });

  /**
   * A full-bleed panel outlined OUTWARD is drawn beyond the popup and clipped
   * by `.wc-root`'s own overflow, so the selected box reads as unselected on
   * the two sides that matter.
   */
  it('draws its outline inside itself, where a leaf draws one outside', () => {
    const { rerender } = render(<Preview template={FIELDWORK} onSelect={vi.fn()} />);
    const panel = boxes().find((box) => box.className === 'wc-panel') as HTMLElement;

    rerender(<Preview template={FIELDWORK} selected={keyOfElement(panel)} onSelect={vi.fn()} />);
    expect(panel.style.outlineOffset).toBe('-2px');

    rerender(<Preview template={FIELDWORK} selected={at('headline')} onSelect={vi.fn()} />);
    expect(
      (slots().find((slot) => slot.dataset.role === 'headline') as HTMLElement).style.outlineOffset,
    ).toBe('2px');
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
