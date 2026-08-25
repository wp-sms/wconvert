import { describe, expect, it } from 'vitest';
import { render } from '@renderer/render';
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
    expect(element.querySelector('label')?.textContent).toBe('Email');
    expect(element.querySelector('label')?.htmlFor).toBe(input?.id);
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

  it('carries a grid column count as a custom property, not as a class', () => {
    const tree = oneStep({ type: 'grid', columns: 3, children: [] } as TemplateTree['steps'][number]);
    const grid = render(tree, TOKENS).firstElementChild as HTMLElement;

    expect(grid.style.getPropertyValue('--wc-columns')).toBe('3');
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
