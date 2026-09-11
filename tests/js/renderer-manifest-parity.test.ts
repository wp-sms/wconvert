import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../resources/templates/manifest.json';
import { A_NARROW_DESIGN, DOCUMENT_CSS, SHADOW_CSS } from '@renderer/css';
import { REFERABLE, SAFE_SCHEMES, render } from '@renderer/render';
import type { TemplateTree } from '@renderer/types';

/**
 * The template vocabulary, asserted against the one renderer that implements
 * it.
 *
 * Same arrangement the rule manifest has, and for the same reason: the
 * manifest is what PHP validates a tree against, and the renderer is what
 * draws one. A member declared in the manifest with nothing to draw it is a
 * node validation lets through and the visitor never sees.
 *
 * **It is a behavioural check, not a list against a list.** There is no
 * exported vocabulary array in the renderer to compare with, deliberately —
 * that would be a second spelling of the switch — so this asks the renderer to
 * render one of each and looks at what came back.
 */

/** The least content each leaf needs before it has anything to draw. */
const MINIMAL: Readonly<Record<string, object>> = {
  heading: { text: 'x' },
  text: { text: 'x' },
  eyebrow: { text: 'x' },
  badge: { text: 'x' },
  // The four with nothing to fill in. A `divider` says nothing by definition; a
  // `rating` and an `icon` draw their declared default; and all three are here
  // as empty objects rather than absent so the list reads as deliberate.
  divider: {},
  countdown: {},
  rating: {},
  icon: {},
  image: { src: '/x.png', alt: '' },
  code: { text: 'x' },
  field: { name: 'email' },
  button: { label: 'x' },
  consent: { text: 'x' },
};

/** The step's own element, one inside the root the renderer returns. */
const renderStep = (node: object): Element | null =>
  render({ steps: [node] } as TemplateTree, {}).firstElementChild;

const CSS = SHADOW_CSS + DOCUMENT_CSS;

describe('every member the manifest declares', () => {
  it.each(Object.keys(manifest.layouts))('has a layout the renderer draws: %s', (type) => {
    const layout = renderStep({ type, children: [], start: [], end: [] });

    expect(layout?.className).toBe(`wc-${type}`);
    // `split` is the one layout with a fixed shape: two panes, always, so a
    // pane left empty still holds its side of the design.
    expect(layout?.children).toHaveLength(type === 'split' ? 2 : 0);
  });

  it.each(Object.keys(manifest.nodes))('has a leaf the renderer draws: %s', (type) => {
    expect(renderStep({ type: 'stack', children: [{ type, ...MINIMAL[type] }] })?.children).toHaveLength(1);
  });

  it.each(manifest.fields)('has a field kind the renderer draws: %s', (name) => {
    expect(renderStep({ type: 'stack', children: [{ type: 'field', name }] })?.querySelector('input')).not.toBeNull();
  });

  /**
   * **Every leaf the manifest lets hide, the renderer hides.**
   *
   * The settings panel edits slot content and slot visibility and never
   * arrangement (ADR 0010), so a merchant switches the fine print off rather
   * than deleting it — and a `consent` node ships hidden, which is how
   * ADR 0032's "off by default" and "the panel never changes arrangement" are
   * both true at once.
   *
   * The renderer honours `hidden` on ANY node it is handed, and that is the
   * layering rather than a gap: which leaves may carry the key is the
   * manifest's answer, enforced where the tree is validated on the way in
   * (`tests/unit/Template/TemplateVocabularyTest.php`). A renderer that
   * re-asked would be a second spelling of the vocabulary, which is the thing
   * this file exists to prevent.
   */
  it.each(Object.entries(manifest.nodes).filter(([, node]) => node.params.includes('hidden')))(
    'hides a leaf the manifest lets hide: %s',
    (type) => {
      expect(
        renderStep({ type: 'stack', children: [{ type, ...MINIMAL[type], hidden: true }] })?.children,
      ).toHaveLength(0);
    },
  );

  it('draws nothing for a type it declares nowhere', () => {
    expect(renderStep({ type: 'stack', children: [{ type: 'marquee' }] })?.children).toHaveLength(0);
  });
});

/**
 * ============================================================================
 * A DECLARED DEFAULT IS WHAT THE RENDERER DOES WITH NOTHING.
 * ============================================================================
 * The block inspector ticks the declared default where a param is absent, so a
 * merchant opening a stock heading is told the rank a visitor will actually
 * see. That is only honest while the manifest and `render.ts` agree — and they
 * are written in different files with nothing between them, which is exactly
 * the arrangement every other section here exists to hold together.
 *
 * **Asserted behaviourally**, like the rest of this file: a node with the key
 * ABSENT is rendered beside one carrying the declared default, and the two must
 * produce the same markup. A list against a list would be the second spelling
 * (ADR 0019); this cannot be satisfied by a wrong default that happens to be
 * spelled twice.
 *
 * It covers the layouts too, where `split.ratio` lives — the param that started
 * this whole line of work by being declared, read, and reachable from nothing.
 */
describe('every default the manifest declares', () => {
  /** `{node|layout}.{param}` → the manifest's spelling of what absence means. */
  const declared = [
    ...Object.entries(manifest.nodes),
    ...Object.entries(manifest.layouts),
  ].flatMap(([type, entry]) =>
    Object.entries(('defaults' in entry ? entry.defaults : {}) as Record<string, string>).map(
      ([param, value]) => ({ type, param, value }),
    ),
  );

  it('declares at least one, so the cases below assert something', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  /**
   * **A param is honoured in one of two places, and the assertion follows
   * which.** `level`, `fit` and `required` are decided in `render.ts`, so
   * absence is checked against the markup. `ratio` is written out as a custom
   * property the STYLESHEET reads with its own fallback —
   * `var(--wc-ratio,.5)` — so the node carrying the default renders one extra
   * attribute and looks nothing like the node without it, while a visitor sees
   * the same design.
   *
   * Read off whether the stylesheet reads the property, so it is the shared
   * vocabulary deciding and a param that moves between the two is covered on
   * the day it moves.
   */
  const readByTheStylesheet = (param: string) => CSS.includes(`var(--wc-${param},`);

  it.each(declared.filter(({ param }) => !readByTheStylesheet(param)))(
    'renders the same with $param absent as with it set: $type',
    ({ type, param, value }) => {
      const shape =
        type in manifest.nodes
          ? (extra: object) => ({ type: 'stack', children: [{ type, ...MINIMAL[type], ...extra }] })
          : (extra: object) => ({ type, children: [], start: [], end: [], ...extra });

      /*
       * The manifest spells every value as a string and the tree stores three
       * types — the same coercion the control writes through
       * (`builder/panel.ts`'s `valueOfChoice`), read off the shape here rather
       * than from a table of param names.
       */
      const stored =
        value === 'true' || value === 'false'
          ? value === 'true'
          : Number.isFinite(Number(value))
            ? Number(value)
            : value;

      expect(renderStep(shape({ [param]: stored }))?.outerHTML).toBe(
        renderStep(shape({}))?.outerHTML,
      );
    },
  );

  it.each(declared.filter(({ param }) => readByTheStylesheet(param)))(
    'declares the same default the stylesheet falls back to: $type.$param',
    ({ param, value }) => {
      const fallback = new RegExp(`var\\(--wc-${param},([^)]+)\\)`).exec(CSS);

      expect(fallback).not.toBeNull();
      // `.5` and `0.5` are one number written two ways, and the CSS spelling is
      // bytes in a budgeted stylesheet rather than a value to match literally.
      expect(Number(fallback?.[1])).toBe(Number(value));
    },
  );

  /** And a default is one of the values the panel actually offers. */
  it.each(declared)('is one of the offered choices: $type.$param', ({ type, param, value }) => {
    const entry = { ...manifest.nodes, ...manifest.layouts }[type] as {
      choices?: Record<string, string[]>;
    };

    expect(entry.choices?.[param]).toContain(value);
  });
});

/**
 * ============================================================================
 * A TOKEN BAG IS A PARAM, SO IT IS ASSERTED THE WAY EVERY OTHER PARAM IS.
 * ============================================================================
 * The manifest says which layouts carry one; this asks the renderer to draw
 * each and looks at where the properties landed. **On that element and nowhere
 * else** is the whole claim — inheritance does the rest, and a bag that leaked
 * onto `.wc-root` would be the global set with extra steps (ADR 0062).
 */
describe('every layout the manifest gives a token bag', () => {
  const scoped = Object.entries(manifest.layouts).filter(([, entry]) =>
    (entry.params as readonly string[]).includes('tokens'),
  );

  it('is every layout there is, so the cases below cover the vocabulary', () => {
    expect(scoped).toHaveLength(Object.keys(manifest.layouts).length);
  });

  it.each(scoped)('writes it as custom properties on its own element: %s', (type) => {
    const root = render(
      { steps: [{ type, tokens: { bg: '#fff4df', pad: '2rem' }, children: [], start: [], end: [] }] } as TemplateTree,
      { bg: '#ffffff' },
    );
    const element = root.firstElementChild as HTMLElement;

    expect(element.style.getPropertyValue('--wc-bg')).toBe('#fff4df');
    expect(element.style.getPropertyValue('--wc-pad')).toBe('2rem');
    // The design's own value is still on the root, untouched. That is what
    // makes the bag an OVERRIDE for a subtree rather than an edit to the design.
    expect(root.style.getPropertyValue('--wc-bg')).toBe('#ffffff');
  });

  it.each(scoped)('renders identically to one carrying no bag at all: %s', (type) => {
    const shape = (extra: object) =>
      render({ steps: [{ type, children: [], start: [], end: [], ...extra }] } as TemplateTree, {})
        .firstElementChild?.outerHTML;

    expect(shape({ tokens: {} })).toBe(shape({}));
  });

  /**
   * The names are closed at the boundary and not here, which is the same
   * layering `hidden` has: `TemplateVocabulary` decides what a tree may say,
   * the renderer draws what it is handed. Asserted so the day someone adds a
   * second check here it is a deliberate change rather than a quiet one.
   */
  it('draws whatever names it is handed, because closure is the boundarys job', () => {
    const element = render(
      { steps: [{ type: 'stack', tokens: { wobble: '3deg' }, children: [] }] } as TemplateTree,
      {},
    ).firstElementChild as HTMLElement;

    expect(element.style.getPropertyValue('--wc-wobble')).toBe('3deg');
  });
});

/**
 * ============================================================================
 * THE TYPE SCALE — A MODIFIER CLASS, AND IT HAS TO BE ONE.
 * ============================================================================
 * The stylesheet may read no `--wc-*` name outside the declared tokens and the
 * declared layout params, and a NODE param is neither — so `size` cannot be a
 * custom property under any name. This asserts the class, and that every step
 * the manifest offers has a rule to draw it: a step with no rule is a chip in
 * the inspector that changes nothing.
 */
describe('the type scale', () => {
  const sizes = manifest.nodes.heading.choices.size as readonly string[];

  it('offers the same steps on both leaves that take one', () => {
    expect(manifest.nodes.text.choices.size).toEqual(sizes);
  });

  it.each(sizes.filter((size) => size !== manifest.nodes.heading.defaults.size))(
    'draws a rule for every step it offers: %s',
    (size) => {
      expect(CSS).toContain(`.wc-heading.wc-${size}{`);
      expect(CSS).toContain(`.wc-text.wc-${size}{`);
    },
  );

  it.each(sizes)('writes the step as a class beside the leafs own: %s', (size) => {
    const step = renderStep({
      type: 'stack',
      children: [
        { type: 'heading', text: 'x', size },
        { type: 'text', text: 'x', size },
      ],
    });
    const expected = size === 'm' ? ['wc-heading', 'wc-text'] : [`wc-heading wc-${size}`, `wc-text wc-${size}`];

    expect([...(step?.children ?? [])].map((child) => child.className)).toEqual(expected);
  });

  /**
   * A step multiplies the leaf's own size TOKEN, so the merchant's one lever
   * still moves all six together. Read off the declaration rather than
   * computed, because jsdom resolves no `calc()` against a stylesheet it never
   * loaded.
   */
  it('multiplies the token rather than replacing it', () => {
    expect(CSS).toContain('.wc-heading.wc-3xl{font-size:calc(var(--wc-heading-size,1.5rem)*');
    expect(CSS).toContain('.wc-text.wc-3xl{font-size:calc(var(--wc-text-size,1rem)*');
  });
});

/**
 * ============================================================================
 * A WRAPPED PANE FILLS ITS LINE, AND jsdom CANNOT SEE THAT.
 * ============================================================================
 * `flex-grow` distributes FREE space, so a value below 1 distributes only that
 * fraction of it. Side by side the two grows sum to 1 and the line is consumed
 * exactly; WRAPPED, each pane is alone on its line with a grow of `.35` or `.5`
 * and stops short — measured in a browser at 320px, `split-hero` drew two 228px
 * panes in a 264px row.
 *
 * It was invisible for as long as a pane drew nothing, and a `panel` inside one
 * is what made it a dark box with a stripe of the design's own background down
 * its edge (ADR 0062).
 *
 * **This is a source-text assertion and it is the cheap belt.** Vitest runs
 * jsdom with `css: false`, so nothing here computes layout and the fault was
 * found by measuring a real browser. What a text assertion CAN do is notice the
 * one-line edit that brings it back.
 */
describe('the panes of a split', () => {
  it('floors both grows at 1, so either fills a line it is alone on', () => {
    const grows = [...CSS.matchAll(/\.wc-pane:(?:first|last)-child\{flex-grow:([^}]+)\}/g)].map(
      ([, value]) => value,
    );

    expect(grows).toHaveLength(2);

    for (const grow of grows) {
      expect(grow, 'a grow that can resolve below 1 leaves a wrapped pane short').toMatch(/^max\(1,/);
    }
  });

  /** And the ratio between them is still what divides a SHARED line. */
  it('keeps the ratio the manifest declares', () => {
    expect(CSS).toContain('var(--wc-ratio,.5)*10');
    expect(CSS).toContain('(1 - var(--wc-ratio,.5))*10');
  });
});

/**
 * ============================================================================
 * THE ONE LAYOUT THAT PAINTS, AND THE THREE THINGS THAT MAKES TRUE.
 * ============================================================================
 * Every other layout arranges and draws nothing, so a scoped bag on one is
 * visible only through what inherits it. A `panel` reads the properties in
 * scope and draws the box — which is what makes a cream panel beside a dark one
 * expressible at all (ADR 0062).
 */
describe('the panel', () => {
  const panel = (extra: object): HTMLElement =>
    render({ steps: [{ type: 'panel', children: [], ...extra }] } as TemplateTree, {})
      .firstElementChild as HTMLElement;

  /**
   * **The reset is the non-obvious half.** `.wc-panel` paints the same two
   * background layers `.wc-root` does, so a design with one picture would paint
   * it again — cover and centred — inside every panel in it. A panel inherits
   * the design's COLOURS and not its photograph.
   */
  it('starts from the designs colours and not its picture', () => {
    const root = render(
      { steps: [{ type: 'panel', children: [] }] } as TemplateTree,
      { bg: '#0f172a', 'bg-image': 'url(/hero.jpg)', overlay: 'rgba(0,0,0,.5)' },
    );
    const element = root.firstElementChild as HTMLElement;

    expect(element.style.getPropertyValue('--wc-bg-image')).toBe('none');
    expect(element.style.getPropertyValue('--wc-overlay')).toBe('#0000');
    // Only the picture. The ground is inherited, which is the whole point of a
    // panel with no bag reading as the design it sits in.
    expect(element.style.getPropertyValue('--wc-bg')).toBe('');
    expect(root.style.getPropertyValue('--wc-bg-image')).toBe('url(/hero.jpg)');
  });

  it('lets its own bag win over that reset, which is what a photo pane is', () => {
    const element = panel({ tokens: { 'bg-image': 'url(/pane.jpg)', overlay: 'rgba(0,0,0,.35)' } });

    expect(element.style.getPropertyValue('--wc-bg-image')).toBe('url(/pane.jpg)');
    expect(element.style.getPropertyValue('--wc-overlay')).toBe('rgba(0,0,0,.35)');
  });

  it('writes edges as a modifier attribute, and nothing at all for the default', () => {
    expect(panel({ edges: 'block-start' }).dataset.edges).toBe('block-start');
    expect(panel({ edges: 'all' }).dataset.edges).toBe('all');
    expect(panel({ edges: 'none' }).outerHTML).toBe(panel({}).outerHTML);
  });

  it('writes min as the custom property the stylesheet reads', () => {
    expect(panel({ min: '16rem' }).style.getPropertyValue('--wc-min')).toBe('16rem');
  });
});

/**
 * ============================================================================
 * THE SECOND LAYOUT THAT PAINTS, AND THE SPREAD IS THE WHOLE OF IT.
 * ============================================================================
 * A `panel` and a `media` draw the same two background layers; what tells them
 * apart is what each does with room it has more of than its contents need. A
 * panel stacks at the top and a media pushes to both edges, which is what a
 * wordmark above a headline on one photograph is — thirteen of the sixteen
 * reference designs.
 *
 * jsdom computes no layout, so the spread itself is a source-text assertion.
 * What IS behavioural here is everything that reaches the markup.
 */
describe('the media', () => {
  const media = (extra: object): HTMLElement =>
    render({ steps: [{ type: 'media', children: [], ...extra }] } as TemplateTree, {})
      .firstElementChild as HTMLElement;

  /** The same reset a `panel` takes, for the same reason and in the same place. */
  it('starts from the designs colours and not its picture', () => {
    const root = render(
      { steps: [{ type: 'media', children: [] }] } as TemplateTree,
      { bg: '#0f172a', 'bg-image': 'url(/hero.jpg)', overlay: 'rgba(0,0,0,.5)' },
    );
    const element = root.firstElementChild as HTMLElement;

    expect(element.style.getPropertyValue('--wc-bg-image')).toBe('none');
    expect(element.style.getPropertyValue('--wc-overlay')).toBe('#0000');
    expect(element.style.getPropertyValue('--wc-bg')).toBe('');
  });

  it('lets its own bag win over that reset, which is what putting type on art is', () => {
    const element = media({ tokens: { 'bg-image': 'url(/plant.jpg)', overlay: 'linear-gradient(#0008,#000c)' } });

    expect(element.style.getPropertyValue('--wc-bg-image')).toBe('url(/plant.jpg)');
    expect(element.style.getPropertyValue('--wc-overlay')).toBe('linear-gradient(#0008,#000c)');
  });

  it('writes min as the custom property the stylesheet reads', () => {
    expect(media({ min: '26rem' }).style.getPropertyValue('--wc-min')).toBe('26rem');
  });

  /**
   * **The overlay is a LAYER and not the second background layer**, which is
   * the one thing about this rule that is not the panel's. On a panel the wash
   * is painted into `background-image` above the picture, which is right where
   * the box's own text is what is being made legible; here the children sit ON
   * the picture, so a wash in the background would darken the photograph and
   * the words on it equally.
   */
  it('washes the picture from a layer the children sit above', () => {
    expect(CSS).toContain('.wc-media::before{');
    expect(CSS).toMatch(/\.wc-media::before\{[^}]*background:var\(--wc-overlay/);
    expect(CSS).toContain('.wc-media>*{position:relative}');
    // And the wash is NOT in its own background-image, or it would be under
    // the picture rather than over it.
    expect(/\.wc-media\{([^}]*)\}/.exec(CSS)?.[1] ?? '').not.toContain('--wc-overlay');
  });

  it('spreads its children to both edges, which is the whole difference from a panel', () => {
    const rule = /\.wc-media\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    expect(rule).toContain('justify-content:space-between');
    expect(rule).toContain('min-block-size:var(--wc-min,0)');
  });
});

/**
 * ============================================================================
 * THE ONE ORNAMENT SCOPING CANNOT REACH.
 * ============================================================================
 * A punched notch has to REMOVE the panel so the merchant's own page shows
 * through, and no background layer can name that ground. It is the only `mask`
 * in the product and the only new CSS property the whole scoping proposal
 * added.
 */
describe('the notch', () => {
  const panel = (extra: object): HTMLElement =>
    render({ steps: [{ type: 'panel', children: [], ...extra }] } as TemplateTree, {})
      .firstElementChild as HTMLElement;

  it('writes it as a modifier attribute, and nothing at all for the default', () => {
    expect(panel({ notch: true }).dataset.notch).toBe('true');
    expect(panel({ notch: false }).outerHTML).toBe(panel({}).outerHTML);
  });

  /**
   * **`intersect` is what makes two layers one shape**, and the DEFAULT
   * composite is `add` — so an engine that does not understand the property
   * draws a panel with no notches rather than a panel with no corners. That is
   * the only degradation worth having, and it is what makes the prefixed pair
   * optional rather than load-bearing.
   */
  it('composes the two circles by intersection, in both spellings', () => {
    const rule = /\.wc-panel\[data-notch=true\]\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    expect(rule).toContain('mask-composite:intersect');
    expect(rule).toContain('-webkit-mask-composite:source-in');
    expect([...rule.matchAll(/radial-gradient/g)]).toHaveLength(4);
  });
});

/**
 * ============================================================================
 * EVERY HEADLINE IN THE REFERENCE SET BREAKS ITS OWN LINE.
 * ============================================================================
 * `SlotFields` has handed the merchant a `<textarea>` for body copy since it
 * was written, so a newline was always typeable; `textContent` collapsed every
 * one of them to a space and nothing said so.
 *
 * **Structure and never markup**, which is the same rule the link has: each
 * line is a text node and each break is a real `<br>`, so this is one more
 * place that does not reach `innerHTML` (ADR 0013).
 */
describe('a line break in authored copy', () => {
  const drawn = (node: object): Element =>
    renderStep({ type: 'stack', children: [node] })?.firstElementChild as Element;

  it.each([
    ['heading', { type: 'heading', text: 'Room\nto grow.' }],
    ['text', { type: 'text', text: 'Room\nto grow.' }],
    ['eyebrow', { type: 'eyebrow', text: 'Room\nto grow.' }],
    ['badge', { type: 'badge', text: 'Room\nto grow.' }],
    ['code', { type: 'code', text: 'Room\nto grow.' }],
  ])('is a <br> on a %s, and the text either side of it survives', (_type, node) => {
    const element = drawn(node);

    expect(element.querySelectorAll('br')).toHaveLength(1);
    expect(element.textContent).toBe('Roomto grow.');
    expect(element.innerHTML).toBe('Room<br>to grow.');
  });

  it('writes a break with no text node for a deliberate blank line', () => {
    expect(drawn({ type: 'text', text: 'one\n\ntwo' }).innerHTML).toBe('one<br><br>two');
  });

  it('leaves copy with no newline in it exactly as it was', () => {
    expect(drawn({ type: 'heading', text: 'Room to grow.' }).innerHTML).toBe('Room to grow.');
  });

  /** A sentence breaks its own line too, on both sides of a placeholder. */
  it('breaks a sentence either side of its link', () => {
    const element = drawn({
      type: 'text',
      text: 'Read our %s\nbefore you sign up.',
      link: { label: 'privacy policy', href: 'https://example.test/p/' },
    });

    expect(element.querySelectorAll('br')).toHaveLength(1);
    expect(element.querySelector('a')?.textContent).toBe('privacy policy');
  });
});

/**
 * ============================================================================
 * THE SECOND PLACEHOLDER, AND IT IS THE SAME MACHINERY AS THE FIRST.
 * ============================================================================
 * 71 sentences across the sixteen reference designs lift a run of words —
 * *"Take **10% off** your first order"* — and until now the vocabulary could
 * express it as two paragraphs or not at all.
 *
 * The record of what a `consent` sentence SAYS is asserted from both languages
 * by `tests/fixtures/consent-sentences.json`; this is the markup half, which
 * only the renderer has.
 */
describe('inline emphasis', () => {
  const drawn = (node: object): Element =>
    renderStep({ type: 'stack', children: [node] })?.firstElementChild as Element;

  it('builds a <strong> and never markup', () => {
    const element = drawn({ type: 'text', text: 'Take %b your first order.', emphasis: '10% off' });

    expect(element.innerHTML).toBe('Take <strong class="wc-strong">10% off</strong> your first order.');
  });

  it('carries a link and an emphasis in one sentence, told apart by the mark', () => {
    const element = drawn({
      type: 'text',
      text: 'Take %b, and read our %s.',
      emphasis: '10% off',
      link: { label: 'privacy policy', href: 'https://example.test/p/' },
    });

    expect(element.querySelector('strong')?.textContent).toBe('10% off');
    expect(element.querySelector('a')?.textContent).toBe('privacy policy');
    expect(element.textContent).toBe('Take 10% off, and read our privacy policy.');
  });

  /** Emphasis breaks its own line, because it is words like any other. */
  it('breaks a line inside the emphasised run', () => {
    expect(drawn({ type: 'text', text: '%b now.', emphasis: 'Two\nlines' }).innerHTML).toBe(
      '<strong class="wc-strong">Two<br>lines</strong> now.',
    );
  });

  /**
   * Weight and nothing else. The same `%b` sits in fine print, which is
   * already `--wc-muted`, so tinting it `--wc-accent` would put the loudest
   * colour in the design on the quietest line in it.
   */
  it('is weight, and inherits its colour', () => {
    expect(CSS).toContain('.wc-strong{font-weight:700}');
  });
});

/**
 * ============================================================================
 * A VALUE THAT NAMES A TOKEN, SO A SCOPE CAN FOLLOW A THEME.
 * ============================================================================
 * Written verbatim, `{"bg":"#263f2c"}` on a panel survives every theme the
 * merchant tries — so the deeper a design is styled, the less a theme does.
 *
 * It resolves in CSS rather than in the renderer, which is what makes it free:
 * `var(--wc-accent)` is answered at the element by whatever is in scope, and a
 * theme applied after the render moves it too.
 */
describe('a token used as a value', () => {
  const scoped = (tokens: Record<string, string>, design: Record<string, string> = {}): HTMLElement =>
    render({ steps: [{ type: 'panel', children: [], tokens }] } as TemplateTree, design)
      .firstElementChild as HTMLElement;

  it('is the same list the manifest declares', () => {
    expect([...REFERABLE].sort()).toEqual([...manifest.referable].sort());
  });

  it('is every colour token and nothing else', () => {
    // The colours are what a palette is made of; a `pad` that follows `gap` is
    // a coincidence rather than an intent.
    expect(REFERABLE.every((name) => name in manifest.tokens)).toBe(true);
    expect(REFERABLE).not.toContain('pad');
  });

  it.each(REFERABLE)('becomes a reference to it: %s', (name) => {
    // Written onto a DIFFERENT token, because a name referring to itself is
    // the one case that stays verbatim — asserted on its own below.
    const on = name === 'bg' ? 'fg' : 'bg';

    expect(scoped({ [on]: name }).style.getPropertyValue(`--wc-${on}`)).toBe(`var(--wc-${name})`);
  });

  it('writes every other value exactly as it was', () => {
    expect(scoped({ bg: '#fff4df' }).style.getPropertyValue('--wc-bg')).toBe('#fff4df');
    expect(scoped({ pad: 'gap' }).style.getPropertyValue('--wc-pad')).toBe('gap');
    expect(scoped({ bg: 'wobble' }).style.getPropertyValue('--wc-bg')).toBe('wobble');
  });

  /**
   * `var(--wc-bg)` on `--wc-bg` is a cycle CSS discards, so honouring it would
   * silently unset the one property the author was trying to set.
   */
  it('writes a name referring to itself verbatim', () => {
    expect(scoped({ bg: 'bg' }).style.getPropertyValue('--wc-bg')).toBe('bg');
  });

  it('leaves the designs own value on the root, so the reference has something to find', () => {
    const root = render(
      { steps: [{ type: 'panel', children: [], tokens: { bg: 'accent' } }] } as TemplateTree,
      { accent: '#263f2c' },
    );

    expect(root.style.getPropertyValue('--wc-accent')).toBe('#263f2c');
    expect((root.firstElementChild as HTMLElement).style.getPropertyValue('--wc-bg')).toBe('var(--wc-accent)');
  });
});

/**
 * Tokens are the other half of the vocabulary, and an unconsumed one is worse
 * than a missing one: it rides the payload on every page view, is offered in
 * the settings panel, and changes nothing on screen.
 */
describe('every token the manifest declares', () => {
  it.each(Object.keys(manifest.tokens))('is read by the stylesheet: %s', (token) => {
    expect(CSS).toContain(`var(--wc-${token}`);
  });

  it('is the only custom property the stylesheet reads, beside the declared layout params', () => {
    const params = Object.values(manifest.layouts).flatMap((layout) => layout.params);
    /*
      **`n-` is the narrow spelling of a declared token and nothing else.** The
      rule is unchanged — the stylesheet may read no `--wc-*` name outside the
      declared tokens and the declared layout params — and `--wc-n-bg` is
      `--wc-bg` at a second width, mirrored by `render.ts`'s `retune` so one
      container query can remap it. Enumerated rather than pattern-matched, so
      a `--wc-n-wobble` still fails.
    */
    const declared = new Set([
      ...Object.keys(manifest.tokens),
      ...Object.keys(manifest.tokens).map((token) => `n-${token}`),
      ...params,
    ]);
    const read = [...CSS.matchAll(/var\(--wc-([a-z-]+)/g)].map((match) => match[1]);

    expect([...new Set(read)].filter((name) => !declared.has(name))).toEqual([]);
  });
});

/**
 * ============================================================================
 * A SECOND BAG PER BOX, AND THE MIRROR IS WHAT MAKES IT EXPRESSIBLE AT ALL.
 * ============================================================================
 * A token bag is written with `setProperty` and inline style has no
 * conditional form; a stylesheet cannot name one node in a tree it has never
 * seen. So `render.ts` writes a retuned box's values under `--wc-n-*` and one
 * `@container` rule remaps them.
 *
 * **The completeness of the mirror is the load-bearing half**, and it is what
 * a browser found wrong the first time: an unset `var(--wc-n-heading-font)` is
 * guaranteed-invalid rather than inherited, so a remap that found nothing
 * wiped the property and the stylesheet fell to its own literal fallback.
 */
describe('the narrow bag', () => {
  const retuned = (node: object, design: Record<string, string> = {}): HTMLElement =>
    render({ steps: [node] } as TemplateTree, design).firstElementChild as HTMLElement;

  it('fires at the width the manifest declares', () => {
    expect(A_NARROW_DESIGN).toBe(manifest.narrow);
    expect(CSS).toContain(`@container wc (max-width:${manifest.narrow})`);
  });

  it('is measured against the design rather than the viewport', () => {
    // An `inline` Optin in a sidebar is narrow on a desktop, and a media query
    // would call it wide.
    expect(CSS).toMatch(/\.wc-root\{[^}]*container:wc\/inline-size/);
  });

  it('costs a box that sets none nothing at all', () => {
    const plain = retuned({ type: 'panel', children: [], tokens: { bg: '#fff4df' } });

    expect(plain.dataset.narrow).toBeUndefined();
    expect(plain.getAttribute('style')).not.toContain('--wc-n-');
  });

  it('is an empty bag away from being absent, so a cleared one leaves no attribute', () => {
    expect(retuned({ type: 'panel', children: [], narrow: {} }).outerHTML).toBe(
      retuned({ type: 'panel', children: [] }).outerHTML,
    );
  });

  it('marks the box, so the remap reaches it and reaches nothing inside it', () => {
    const outer = retuned({
      type: 'panel',
      tokens: { bg: '#fff4df' },
      narrow: { pad: '1rem' },
      children: [{ type: 'panel', children: [], tokens: { bg: '#0f172a' } }],
    });

    expect(outer.dataset.narrow).toBe('');
    // The child sets its OWN ground and no narrow bag. An ungated remap would
    // repaint it with the ancestor's narrow value, because `--wc-n-bg`
    // inherits; gated, it is untouched at every width.
    expect((outer.firstElementChild as HTMLElement).dataset.narrow).toBeUndefined();
  });

  it('mirrors every token in scope and not only the ones the box set', () => {
    const box = retuned(
      {
        type: 'panel',
        children: [],
        tokens: { bg: '#fff4df' },
        narrow: { pad: '1rem' },
      },
      { 'heading-font': 'Georgia, serif', accent: '#263f2c' },
    );

    // The narrow value, the box's own, and the DESIGN's — all three, or the
    // remap finds an unset property and the stylesheet falls to its literal.
    expect(box.style.getPropertyValue('--wc-n-pad')).toBe('1rem');
    expect(box.style.getPropertyValue('--wc-n-bg')).toBe('#fff4df');
    expect(box.style.getPropertyValue('--wc-n-heading-font')).toBe('Georgia, serif');
    expect(box.style.getPropertyValue('--wc-n-accent')).toBe('#263f2c');
  });

  it('mirrors what an ancestor set, through a box that set nothing', () => {
    const root = render(
      {
        steps: [
          {
            type: 'panel',
            tokens: { bg: '#fff4df' },
            children: [
              { type: 'stack', children: [{ type: 'panel', children: [], narrow: { pad: '1rem' } }] },
            ],
          },
        ],
      } as TemplateTree,
      { fg: '#253c2b' },
    );
    const inner = root.querySelector('.wc-stack > .wc-panel') as HTMLElement;

    expect(inner.style.getPropertyValue('--wc-n-bg')).toBe('#fff4df');
    expect(inner.style.getPropertyValue('--wc-n-fg')).toBe('#253c2b');
  });

  /**
   * A `panel` and a `media` reset the design's picture before their own bag
   * applies, and the mirror has to carry the reset or a retuned photo pane
   * repaints the design's art below 360px.
   */
  it('mirrors the picture reset a painting box makes', () => {
    const box = retuned(
      { type: 'media', children: [], narrow: { pad: '1rem' } },
      { 'bg-image': 'url(/hero.jpg)' },
    );

    expect(box.style.getPropertyValue('--wc-n-bg-image')).toBe('none');
  });

  it('remaps every declared token, so none of them is stranded at narrow', () => {
    const rule = /@container wc \(max-width:[^)]+\)\{[^{]*\[data-narrow\][^{]*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    for (const token of Object.keys(manifest.tokens)) {
      expect(rule, token).toContain(`--wc-${token}:var(--wc-n-${token})!important`);
    }
  });

  /**
   * **`!important`, and it is not decoration.** The wide bag is on the
   * element's own `style`, which outranks every stylesheet rule that is not
   * important — so without it the remap loses to the thing it exists to
   * override.
   */
  it('states the remap with enough force to beat the inline bag it overrides', () => {
    const rule = /@container wc \(max-width:[^)]+\)\{[^{]*\[data-narrow\][^{]*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    expect([...rule.matchAll(/!important/g)]).toHaveLength(Object.keys(manifest.tokens).length);
  });

  /**
   * A reference always points at the WIDE name, at both prefixes:
   * `--wc-n-accent` exists only on a box that carries a narrow bag, so a
   * mirror pointing at itself would resolve to nothing on most of them.
   */
  it('keeps a token-as-value pointing at the wide name', () => {
    const box = retuned({ type: 'panel', children: [], narrow: { bg: 'accent' } });

    expect(box.style.getPropertyValue('--wc-n-bg')).toBe('var(--wc-accent)');
  });
});

/**
 * The scheme allowlist is ONE rule that has to hold in two languages: PHP
 * validates an href at write (ADR 0013), and the renderer validates again
 * because the admin renders a tree through this module before any write has
 * happened. Two hand-maintained lists is the drift the manifest arrangement
 * exists to prevent, so the list lives in the manifest and both sides are
 * asserted against it.
 */
describe('the link scheme allowlist', () => {
  it('is the manifest is, on both sides of the boundary', () => {
    expect([...SAFE_SCHEMES].sort()).toEqual([...manifest.schemes].map((scheme) => `${scheme}:`).sort());
  });
});

/**
 * **The loader must never import the manifest.** An unrecognised node is
 * skipped by the renderer's own switch, so the lookup buys nothing — and the
 * import would inline the whole vocabulary into a bundle held to 8KB gzipped.
 * The same rule the rule manifest has (README, *The rule manifest*), and until
 * now the same rule with nothing asserting it.
 */
describe('the shipped trees', () => {
  const SHIPPED = ['resources/renderer/src', 'resources/loader/src'];

  /**
   * Matches a module SPECIFIER, not a mention. The same distinction
   * `bin/pro-php-scan.php` draws by tokenising rather than grepping: free may
   * document the boundary without tripping the guard that enforces it, and
   * these files document it at length.
   */
  const IMPORTS_THE_MANIFEST = /(?:from|import|require)\s*\(?\s*['"][^'"]*templates\/manifest\.json['"]/;

  it.each(SHIPPED)('does not import the template manifest: %s', (dir) => {
    const root = resolve(import.meta.dirname, '../..', dir);
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.ts'));

    // An empty scan root is a tree this check cannot speak for, not a tree
    // with nothing wrong in it — the same fail-closed posture the source
    // contract takes (ADR 0029).
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => IMPORTS_THE_MANIFEST.test(readFileSync(resolve(root, file), 'utf8')))).toEqual([]);
  });
});
