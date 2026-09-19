import { describe, expect, it } from 'vitest';
import { render } from '@renderer/render';
import { SHADOW_CSS } from '@renderer/css';
import type { TemplateTree } from '@renderer/types';

/**
 * The renderer, as a pure function of (tree, tokens).
 *
 * Same inputs, same output, no ambient reads — which is what lets the admin
 * import the same module the loader does and render the real template in a
 * gallery card (ADR 0010).
 */

const TOKENS = { bg: '#fff', fg: '#111' };

const oneStep = (root: TemplateTree['steps'][number]): TemplateTree => ({ steps: [root] });

describe('render', () => {
  it('writes a heading with textContent', () => {
    const tree = oneStep({
      type: 'stack',
      children: [{ type: 'heading', role: 'headline', text: 'Join the list' }],
    });

    const element = render(tree, TOKENS);

    expect(element.textContent).toBe('Join the list');
  });

  /**
   * ==========================================================================
   * A SUB-HEADING IS SMALLER, OR `level` IS A CONTROL THAT DOES NOTHING.
   * ==========================================================================
   * The rank decides the TAG — an `h3` under the Optin's own `h2` — and that is
   * a document-outline fact a screen reader reads. It was also the whole of the
   * effect: `.wc-heading` set one `font-size` for both, so a design with two
   * headings drew them identically and the block inspector's *Main heading /
   * Sub-heading* switch changed not one pixel. A merchant pressed it and saw
   * nothing happen, which is a worse control than none.
   *
   * Both halves are asserted, because either alone would let the other rot: the
   * tag is what makes the outline correct, and the size is what makes the
   * control worth offering.
   */
  it('draws a sub-heading as a rank BELOW the headline, and smaller', () => {
    const tree = oneStep({
      type: 'stack',
      children: [
        { type: 'heading', text: 'Main' },
        { type: 'heading', level: 2, text: 'Under it' },
      ],
    });

    const [main, under] = [...render(tree, TOKENS).querySelectorAll('.wc-heading')];

    expect(main.tagName).toBe('H2');
    expect(under.tagName).toBe('H3');
    expect(SHADOW_CSS).toContain('h3.wc-heading{font-size:calc(');
  });

  /**
   * ==========================================================================
   * A FIELD GROWS ALONG A ROW AND HAS NO HEIGHT OF ITS OWN.
   * ==========================================================================
   * `.wc-field` carried `flex:1 1 12rem` unscoped. In a `row` that is the
   * intent — a field beside a button takes the slack. In a `stack` the main
   * axis is the BLOCK axis, so `flex-basis` is a **height**, and every field in
   * a column stood 192px tall with its label at the top and 130px of nothing
   * under the input. Eight of the thirteen shipped designs put a field in a
   * stack.
   *
   * jsdom computes no layout, so what is asserted is the rule and not the
   * pixels: the growth is on the descendant selector and the base rule declares
   * no `flex` at all. Written this way round because a regression here is
   * somebody moving one declaration back up, and the shorthand's absence from
   * the base rule is the half that is easy to undo by accident.
   */
  it('grows a field along a row, and gives it no height in a stack', () => {
    expect(SHADOW_CSS).toContain('.wc-row>.wc-field{flex:1 1 12rem}');
    expect(SHADOW_CSS).toContain('.wc-field{display:flex;flex-direction:column;');
    expect(SHADOW_CSS).not.toContain('.wc-field{display:flex;flex:');
  });
});

/**
 * The case that makes a snapshot survivable.
 *
 * An Optin takes a COPY of its Template's tree, so a tree written against one
 * vocabulary is rendered by a build that may have a different one. Skipping is
 * what keeps the rest of the Optin on screen; throwing would take the whole
 * thing off the page for one unrecognised leaf (ADR 0010).
 */
describe('an unrecognised node', () => {
  it('is skipped rather than thrown on', () => {
    const tree = oneStep({
      type: 'stack',
      children: [
        { type: 'heading', text: 'Before' },
        { type: 'carousel', slides: 4 },
        { type: 'heading', text: 'After' },
      ],
    } as TemplateTree['steps'][number]);

    const element = render(tree, TOKENS);

    expect(element.textContent).toBe('BeforeAfter');
  });

  it('does not take the step down when it IS the step', () => {
    const tree = { steps: [{ type: 'carousel' }] } as TemplateTree;

    expect(() => render(tree, TOKENS)).not.toThrow();
    expect(render(tree, TOKENS).children).toHaveLength(0);
  });
});

describe('tokens', () => {
  /**
   * On the first element INSIDE the host, never on the host itself. A normal
   * declaration in the outer tree beats a normal `:host` rule, so anything the
   * design needs there is a rule the theme is allowed to win (ADR 0009).
   */
  it('land as prefixed custom properties on the returned root', () => {
    const element = render(oneStep({ type: 'stack' }), { bg: '#0f172a', 'heading-size': '2rem' });

    expect(element.style.getPropertyValue('--wc-bg')).toBe('#0f172a');
    expect(element.style.getPropertyValue('--wc-heading-size')).toBe('2rem');
  });

  it('are the only thing that varies between two renders of one tree', () => {
    const tree = oneStep({
      type: 'stack',
      children: [{ type: 'heading', text: 'Join the list' }],
    });

    expect(render(tree, { bg: '#fff' }).outerHTML).toBe(render(tree, { bg: '#fff' }).outerHTML);
    expect(render(tree, { bg: '#fff' }).outerHTML).not.toBe(render(tree, { bg: '#000' }).outerHTML);
  });
});

/**
 * A link inside a sentence, expressed as STRUCTURE rather than markup
 * (ADR 0013). Allowing four tags would force the renderer to `innerHTML` those
 * nodes, which puts an XSS sink inside the loader on the hot path and costs
 * the property ADR 0010 prized.
 */
describe('a text node carrying a link', () => {
  const fine = (href?: string | null) =>
    oneStep({
      type: 'stack',
      children: [
        {
          type: 'text',
          role: 'fine_print',
          text: 'By subscribing you agree to our %s.',
          link: { label: 'Privacy Policy', href },
        },
      ],
    } as TemplateTree['steps'][number]);

  it('constructs the anchor itself and never parses markup', () => {
    const element = render(fine('https://example.test/privacy'), TOKENS);
    const anchor = element.querySelector('a');

    expect(anchor?.textContent).toBe('Privacy Policy');
    expect(anchor?.getAttribute('href')).toBe('https://example.test/privacy');
    expect(element.textContent).toBe('By subscribing you agree to our Privacy Policy.');
  });

  it('renders nothing at all where the site has no policy configured', () => {
    const element = render(fine(null), TOKENS);

    // Never a dead `#`, and never a stray placeholder either (ADR 0032).
    expect(element.querySelector('a')).toBeNull();
    expect(element.textContent).toBe('By subscribing you agree to our.');
  });

  it('leaves markup in copy as text, because it is written with textContent', () => {
    const tree = oneStep({
      type: 'stack',
      children: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }],
    } as TemplateTree['steps'][number]);

    const element = render(tree, TOKENS);

    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('the leaf vocabulary', () => {
  const leaf = (node: object) => render(oneStep({ type: 'stack', children: [node] } as TemplateTree['steps'][number]), TOKENS);

  it('renders a field as a labelled control named for what it captures', () => {
    const element = leaf({ type: 'field', name: 'email', label: 'Email', placeholder: 'you@example.com', required: true });
    const input = element.querySelector('input');

    expect(input?.type).toBe('email');
    expect(input?.name).toBe('email');
    expect(input?.placeholder).toBe('you@example.com');
    expect(input?.required).toBe(true);
    expect(element.querySelector('label')?.textContent).toBe('Email *');
    expect(element.querySelector('label')?.htmlFor).toBe(input?.id);
  });

  it('keeps every capture kind autofillable and gives an old blank label an accessible fallback', () => {
    const cases = [
      { name: 'email', type: 'email', autocomplete: 'email', inputMode: 'email', label: 'Email address', maxLength: 254 },
      { name: 'name', type: 'text', autocomplete: 'name', inputMode: 'text', label: 'Name', maxLength: 200 },
      { name: 'phone', type: 'tel', autocomplete: 'tel', inputMode: 'tel', label: 'Phone number', maxLength: 64 },
    ] as const;

    for (const expected of cases) {
      const element = leaf({ type: 'field', name: expected.name, label: '   ', required: true });
      const input = element.querySelector<HTMLInputElement>('input');
      const label = element.querySelector('label');

      expect(input?.type).toBe(expected.type);
      expect(input?.autocomplete).toBe(expected.autocomplete);
      expect(input?.inputMode).toBe(expected.inputMode);
      expect(input?.required).toBe(true);
      expect(input?.maxLength).toBe(expected.maxLength);
      expect(label?.textContent).toBe(`${expected.label} *`);
      expect(label?.htmlFor).toBe(input?.id);
      expect(input?.labels).toHaveLength(1);
      expect(input).toHaveAccessibleName(expected.label);
      expect(label?.querySelector('[aria-hidden="true"]')).toHaveTextContent('*');
    }
  });

  it('renders a submit button as a submit button', () => {
    const button = leaf({ type: 'button', role: 'cta_label', label: 'Subscribe', action: 'submit' }).querySelector('button');

    expect(button?.type).toBe('submit');
    expect(button?.textContent).toBe('Subscribe');
  });

  /**
   * A click-metered Optin's CTA navigates the visitor away, which is why its
   * template has one step and no success state (ADR 0025).
   */
  it('renders a link button as an anchor', () => {
    const element = leaf({ type: 'button', label: 'Back to your cart', action: 'link', href: '/cart' });

    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('a')?.textContent).toBe('Back to your cart');
  });

  it('renders an image with its alt text', () => {
    const image = leaf({ type: 'image', src: '/wp-content/x.png', alt: 'A tote bag' }).querySelector('img');

    expect(image?.getAttribute('src')).toBe('/wp-content/x.png');
    expect(image?.alt).toBe('A tote bag');
  });

  it('renders a consent node as a required checkbox beside its wording', () => {
    const element = leaf({ type: 'consent', text: 'I agree to the %s.', link: { label: 'terms', href: 'https://example.test/terms' } });
    const box = element.querySelector('input[type=checkbox]') as HTMLInputElement | null;

    // Required once present, because an OPTIONAL consent checkbox captures
    // Leads whose consent was explicitly refused (ADR 0032).
    expect(box?.required).toBe(true);
    expect(element.textContent).toBe('I agree to the terms.');
  });
});

describe('the layout vocabulary', () => {
  it('lets a split stack before its form becomes cramped, without changing nested defaults', () => {
    const tree = oneStep({
      type: 'split',
      basis: '16rem',
      start: [{ type: 'heading', text: 'Request a callback' }],
      end: [{ type: 'split', start: [], end: [] }],
    } as TemplateTree['steps'][number]);
    const [outer, nested] = [...render(tree, TOKENS).querySelectorAll<HTMLElement>('.wc-split')];

    for (const pane of outer.children) {
      expect((pane as HTMLElement).style.flexBasis).toBe('16rem');
    }
    for (const pane of nested.children) {
      expect((pane as HTMLElement).style.flexBasis).toBe('12rem');
    }
    // jsdom cannot measure wrapping. The browser review checks the resulting
    // pane positions at 390px and at the design's natural desktop width.
    expect(SHADOW_CSS).toContain('.wc-pane{min-inline-size:0;');
  });

  it('renders split as two panes, each with its own children', () => {
    const tree = oneStep({
      type: 'split',
      ratio: 0.4,
      start: [{ type: 'image', src: '/x.png', alt: '' }],
      end: [{ type: 'heading', text: 'Join' }],
    } as TemplateTree['steps'][number]);

    const split = render(tree, TOKENS).firstElementChild as HTMLElement;

    expect(split.className).toBe('wc-split');
    expect(split.children).toHaveLength(2);
    expect(split.children[0].querySelector('img')).not.toBeNull();
    expect(split.children[1].textContent).toBe('Join');
  });

  /**
   * ==========================================================================
   * `grid` CAME BACK WITH THE PARAM THAT KILLED IT LEFT OUT.
   * ==========================================================================
   * The original declared `repeat(columns, 1fr)` — always N across — which at a
   * popup's `min(28rem, 100%)` handed a phone two 140px columns of prose, and
   * carried a `columns` param no control in the admin ever reached. It is back
   * as `repeat(auto-fit, minmax(8rem, 1fr))`: the browser counts the columns
   * from the space it has, so it wraps by construction and there is nothing to
   * misconfigure.
   *
   * The old param is the interesting half of the assertion. A snapshot taken
   * before the deletion still carries `columns: 3`, and the vocabulary has no
   * such key now — so it is DROPPED on the way in and, if one reaches the
   * renderer anyway, ignored. The design renders as a wrapping grid rather than
   * refusing to render, which is the same clause that let the layout be deleted
   * at all (ADR 0010).
   */
  it('draws a grid, ignoring a param this build no longer has', () => {
    const tree = oneStep({
      type: 'stack',
      children: [
        { type: 'grid', columns: 3, children: [{ type: 'heading', text: 'One' }] },
        { type: 'heading', text: 'Two' },
      ],
    } as TemplateTree['steps'][number]);

    const stack = render(tree, TOKENS).firstElementChild as HTMLElement;
    const grid = stack.querySelector('.wc-grid') as HTMLElement;

    expect(stack.textContent).toBe('OneTwo');
    expect(grid.children).toHaveLength(1);
    // No `--wc-columns`, because there is no such thing any more. The whole
    // point of `auto-fit` is that the column count is not a stored number.
    expect(grid.getAttribute('style')).toBeNull();
  });

  /**
   * The property that made deleting a layout safe in the first place, asserted
   * on a type nothing has ever declared: **an unknown node is SKIPPED, not
   * thrown on** (ADR 0010), which is what lets a snapshot outlive the
   * vocabulary it was drawn from.
   */
  it('skips a layout this build does not have, and renders the rest', () => {
    const tree = oneStep({
      type: 'stack',
      children: [
        { type: 'masonry', children: [{ type: 'heading', text: 'Lost' }] },
        { type: 'heading', text: 'Kept' },
      ],
    } as TemplateTree['steps'][number]);

    const stack = render(tree, TOKENS).firstElementChild as HTMLElement;

    expect(stack.textContent).toBe('Kept');
    expect(stack.querySelector('.wc-masonry')).toBeNull();
  });
});

/**
 * A submit-metered template has TWO steps, the post-submit success state being
 * a terminal step; a click-metered one has ONE (ADR 0010, ADR 0025).
 */
describe('steps', () => {
  const tree: TemplateTree = {
    steps: [
      { type: 'stack', children: [{ type: 'heading', text: 'Join the list' }] },
      { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Check your inbox' }] },
    ] as TemplateTree['steps'],
  };

  it('renders the first step by default', () => {
    expect(render(tree, TOKENS).textContent).toBe('Join the list');
  });

  it('renders the terminal step when asked for it', () => {
    expect(render(tree, TOKENS, 1).textContent).toBe('Check your inbox');
  });

  it('renders an empty root for a step that is not there', () => {
    expect(render(tree, TOKENS, 7).children).toHaveLength(0);
  });
});

/**
 * A Slot Role is the seam a Playbook binds copy to, and it is unique across a
 * Template's whole tree (CONTEXT.md, Slot Role). It reaches the DOM because
 * the stylesheet needs it — fine print is smaller and muted — and because the
 * settings panel edits slot content by Role.
 */
describe('slot roles', () => {
  it('reach the rendered node as a data attribute', () => {
    const tree = oneStep({
      type: 'stack',
      children: [{ type: 'text', role: 'fine_print', text: 'No spam.' }],
    } as TemplateTree['steps'][number]);

    expect(render(tree, TOKENS).querySelector('[data-role=fine_print]')?.textContent).toBe('No spam.');
  });

  /**
   * **A `field` carries what it CAPTURES instead**, because its Roles are
   * derived from the capture kind rather than declared, so it has no `role` key
   * to stamp (CONTEXT.md, Slot Role).
   *
   * The loader never reads either. Both are downstream readers of the same
   * render: the stylesheet, which makes fine print smaller without a class per
   * slot, and the builder's preview, where a click has to reach the block that
   * edits the slot and a field would otherwise be the one thing unaddressable
   * (ADR 0040).
   */
  it('stamps a field with what it captures, since it has no Role of its own', () => {
    const tree = {
      steps: [{ type: 'stack', children: [{ type: 'field', name: 'email', label: 'Email' }] }],
    } as TemplateTree;
    const field = render(tree, TOKENS).querySelector('[data-captures=email]');

    expect(field).not.toBeNull();
    expect(field?.getAttribute('data-role')).toBeNull();
  });
});

/**
 * A submit button outside a form submits nothing, so the step that holds one
 * IS the form. Which step that is follows from the tree, so it stays a pure
 * property of (tree, tokens).
 */
describe('a step holding a submit button', () => {
  const submitting = oneStep({
    type: 'stack',
    children: [{ type: 'field', name: 'email' }, { type: 'button', label: 'Go', action: 'submit' }],
  } as TemplateTree['steps'][number]);

  it('renders its root as a form', () => {
    expect(render(submitting, TOKENS).tagName).toBe('FORM');
  });

  it('renders a step with no submit button as a plain element', () => {
    const clicking = oneStep({
      type: 'stack',
      children: [{ type: 'button', label: 'Back to your cart', action: 'link', href: '/cart' }],
    } as TemplateTree['steps'][number]);

    expect(render(clicking, TOKENS).tagName).toBe('DIV');
  });
});


describe('element appearance and mobile inheritance', () => {
  it('styles one leaf without restyling its sibling', () => {
    const tree = oneStep({ type: 'stack', children: [
      { type: 'heading', text: 'Changed', tokens: { fg: '#123456', 'heading-size': '3rem' } },
      { type: 'heading', text: 'Unchanged' },
    ] });
    const [changed, sibling] = render(tree, TOKENS).querySelectorAll<HTMLElement>('.wc-heading');
    expect(changed.style.getPropertyValue('--wc-fg')).toBe('#123456');
    expect(changed.style.getPropertyValue('--wc-heading-size')).toBe('3rem');
    expect(sibling.style.getPropertyValue('--wc-fg')).toBe('');
  });

  it('retains ancestor mobile values when a child overrides another setting', () => {
    const tree = oneStep({ type: 'stack', narrow: { fg: '#123456', 'heading-font': 'Georgia' }, children: [
      { type: 'panel', narrow: { pad: '1rem' }, children: [
        { type: 'heading', text: 'Nested', tokens: { 'heading-size': '3rem' }, narrow: { 'heading-size': '2rem' } },
        { type: 'heading', text: 'Own color', tokens: { fg: '#abcdef' }, narrow: { 'heading-size': '1rem' } },
      ] },
    ] });
    const [nested, own] = render(tree, TOKENS).querySelectorAll<HTMLElement>('.wc-heading');
    expect(nested.dataset.narrow).toBe('');
    expect(nested.style.getPropertyValue('--wc-n-fg')).toBe('#123456');
    expect(nested.style.getPropertyValue('--wc-n-heading-font')).toBe('Georgia');
    expect(nested.style.getPropertyValue('--wc-heading-size')).toBe('3rem');
    expect(nested.style.getPropertyValue('--wc-n-heading-size')).toBe('2rem');
    expect(own.style.getPropertyValue('--wc-n-fg')).toBe('#abcdef');
  });
});
