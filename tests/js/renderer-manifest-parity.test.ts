import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../resources/templates/manifest.json';
import { DOCUMENT_CSS, SHADOW_CSS } from '@renderer/css';
import { SAFE_SCHEMES, render } from '@renderer/render';
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
    const declared = new Set([...Object.keys(manifest.tokens), ...params]);
    const read = [...CSS.matchAll(/var\(--wc-([a-z-]+)/g)].map((match) => match[1]);

    expect([...new Set(read)].filter((name) => !declared.has(name))).toEqual([]);
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
