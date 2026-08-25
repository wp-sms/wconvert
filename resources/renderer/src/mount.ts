import type { Template } from './types';
import { DOCUMENT_CSS, SHADOW_CSS } from './css';
import { render } from './render';

export { render, SHADOW_CSS };

/**
 * The containers — two of them, because they solve two different problems and
 * neither solves the other's (ADR 0009).
 *
 * **The shadow root wins the CSS fight.** Against a theme with
 * `* { … !important }`, a namespaced class with `all: revert` leaked 96
 * computed properties and rendered the popup in Comic Sans. A shadow boundary
 * is not a specificity argument, so it does not have to win one — and `closed`
 * over `open` because a theme script sweeping `document.querySelectorAll(
 * 'input')` must not be able to reach the capture field and rebind it.
 *
 * **The top layer wins the positioning and stacking fights.** A `transform` on
 * an ancestor makes it the containing block for `position: fixed` descendants,
 * which is the standard off-canvas mobile-menu pattern — applied on real
 * sites, conditionally, at exactly the moments a popup might fire. Measured
 * against a transformed `body`, every in-document strategy put the popup on
 * screen at 1 of 5 scroll positions; a modal `<dialog>` is 5 of 5. And a
 * cookie banner at the maximum z-index paints over every in-`<body>` strategy,
 * while the top layer does not enter the auction at all.
 *
 * `showModal()` then supplies the focus trap, Esc-to-close, focus restoration
 * and modality natively. **None of that is hand-written here, deliberately.**
 * `floating_bar` and `slide_in` cannot use it — they must not be modal — and
 * they pay for that with hand-written code in Pro (ADR 0011).
 *
 * **Where Pro's two containers go.** Not here, and not behind a flag on this
 * function: the free tree carries no premium code, ever (ADR 0028). Pro
 * composes its own presenter and hands it to the same `boot(loader,
 * presenter)` free's entry uses, building a `[popover=manual]` container from
 * the pieces this module already exports — {@link render}, {@link SHADOW_CSS}
 * and {@link documentStyle}. Nothing in free's tree changes to let it.
 */

export const DOCUMENT_STYLE_ID = 'wconvert-style';

/**
 * The dialog's armour.
 *
 * A `<dialog>` cannot host a shadow root, so it is the one element in the
 * whole design that a theme can reach — which is why every one of these is
 * inline and `!important`, the only protection available to it. `display` is
 * absent on purpose: it tracks the dialog's open state, so forcing it here
 * would leave a closed dialog painted on the page.
 */
const DIALOG_ARMOUR: Readonly<Record<string, string>> = {
  position: 'fixed',
  inset: '0',
  'inline-size': 'auto',
  'max-inline-size': 'none',
  'block-size': 'auto',
  'max-block-size': 'none',
  margin: 'auto',
  padding: '0',
  border: '0',
  background: 'transparent',
  overflow: 'visible',
  'z-index': 'auto',
};

export interface MountOptions {
  /** `popup` or `inline`. Anything else mounts nothing rather than guessing. */
  readonly displayType?: string;
  readonly template: Template;
  /** Where an `inline` Optin was embedded. Ignored by `popup`. */
  readonly anchor?: Element | null;
  /** A DELIBERATE close by the visitor — the button, Esc, or the backdrop. */
  readonly onDismiss?: () => void;
  /**
   * The converting act, where the container can see it: a click-metered
   * Optin's CTA. A submit-metered one converts when the capture succeeds,
   * which the container cannot know (ADR 0025).
   */
  readonly onConvert?: () => void;
}

export interface Mounted {
  /** False when there was nowhere to mount: an inline Optin with no anchor on this page. */
  readonly mounted: boolean;
  /**
   * The rendered step, inside the shadow root.
   *
   * Handed to the caller rather than the shadow root itself, so `closed` still
   * means what it says to everything that did not mount this.
   */
  readonly root: HTMLElement | null;
  /**
   * How many steps this Optin has.
   *
   * `showStep` takes an index and a caller cannot know its range otherwise —
   * and the range is the whole question, because terminal is STRUCTURAL: the
   * success state is the last step rather than a flagged one, so
   * `steps - 1` is how anything reaches it (ADR 0025).
   */
  readonly steps: number;
  show(): void;
  /** Swap to another step — the post-submit success state is the terminal one. */
  showStep(step: number): void;
  /** Close it ourselves. Reports no dismissal, because nobody dismissed it. */
  close(): void;
}

const NOTHING: Mounted = {
  mounted: false,
  root: null,
  steps: 0,
  show: () => undefined,
  showStep: () => undefined,
  close: () => undefined,
};

/**
 * Exactly one document-level `<style>`, however many Optins mount.
 *
 * The isolation is never total and this is the part that is honest about it:
 * the faces and the backdrop have to be out here, so they are, once.
 */
export function documentStyle(): void {
  if (document.getElementById(DOCUMENT_STYLE_ID) !== null) {
    return;
  }

  const style = document.createElement('style');

  style.id = DOCUMENT_STYLE_ID;
  style.textContent = DOCUMENT_CSS;
  document.head.appendChild(style);
}

export function mount(options: MountOptions): Mounted {
  if (options.displayType === 'inline') {
    return options.anchor === null || options.anchor === undefined ? NOTHING : inline(options, options.anchor);
  }

  return options.displayType === 'popup' || options.displayType === undefined ? popup(options) : NOTHING;
}

/**
 * The shadow root and everything in it, which both containers share.
 *
 * Returns a `step` function rather than the root, because swapping steps has
 * to replace the rendered tree INSIDE the boundary and the caller must not
 * have to reach in to do it.
 */
function shell(template: Template, chrome: HTMLElement | null, options: MountOptions): {
  host: HTMLElement;
  root: HTMLElement;
  step: (step: number) => HTMLElement;
} {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');

  style.textContent = SHADOW_CSS;
  shadow.appendChild(style);

  let root = render(template.tree, template.tokens);

  bind(root);
  shadow.appendChild(root);

  /**
   * The two acts the container owns beside dismissal, bound to whichever step
   * is currently rendered.
   *
   * **The submit guard is not optional.** The rendered form has nothing bound
   * to it until capture lands, and a form with no handler NAVIGATES — which
   * would reload the page underneath the popup the visitor was filling in.
   * Capture, and the advance to the terminal step it earns, arrive with their
   * own ticket; preventing the navigation is this ticket's business.
   */
  function bind(element: HTMLElement): void {
    if (chrome !== null) {
      element.appendChild(chrome);
    }

    element.addEventListener('submit', (event) => event.preventDefault());

    for (const cta of element.querySelectorAll('a.wc-button')) {
      cta.addEventListener('click', () => options.onConvert?.());
    }
  }

  return {
    host,
    get root() {
      return root;
    },
    step(index: number): HTMLElement {
      const next = render(template.tree, template.tokens, index);

      bind(next);
      root.replaceWith(next);
      root = next;

      return next;
    },
  };
}

function popup(options: MountOptions): Mounted {
  const dialog = document.createElement('dialog');

  // `<dialog>` and `showModal()` are Baseline since March 2022, so this is the
  // long tail rather than a supported configuration — and every fallback is
  // worse than nothing: `show()` is not in the top layer at all, so it inherits
  // exactly the transformed-ancestor and z-index failures the modal dialog was
  // chosen to end (ADR 0011). Better one Optin absent than one rendered
  // somewhere the visitor cannot see.
  if (typeof dialog.showModal !== 'function') {
    return NOTHING;
  }
  const chrome = closeButton(() => dialog.close());
  const parts = shell(options.template, chrome, options);

  dialog.className = 'wconvert-dialog';
  dialog.appendChild(parts.host);

  for (const [property, value] of Object.entries(DIALOG_ARMOUR)) {
    dialog.style.setProperty(property, value, 'important');
  }

  // The backdrop cannot see the tokens, which live one element inside a shadow
  // root it is not part of, so its colour is handed to it here.
  const backdrop = options.template.tokens.backdrop;

  if (backdrop !== undefined) {
    dialog.style.setProperty('--wc-backdrop', backdrop);
  }

  // Light dismiss, which `showModal()` does not supply. A click that lands on
  // the dialog itself landed outside the panel, because the panel is inside
  // the host div and the dialog has no padding of its own.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  let dismissible = true;

  dialog.addEventListener('close', () => {
    dialog.style.setProperty('display', 'none', 'important');

    if (dismissible) {
      options.onDismiss?.();
    }
  });

  return {
    mounted: true,
    get root() {
      return parts.root;
    },
    steps: options.template.tree.steps.length,
    show() {
      documentStyle();
      document.body.appendChild(dialog);
      dialog.style.setProperty('display', 'block', 'important');
      dialog.showModal();
    },
    showStep: (step) => void parts.step(step),
    close() {
      // The four ways a visitor dismisses are one thing; closing it OURSELVES
      // is not one of them. A conversion closes the Optin and is emphatically
      // not a Dismissal (CONTEXT.md, Dismissal).
      dismissible = false;
      dialog.close();
    },
  };
}

/**
 * `inline` is outside the top-layer decision entirely.
 *
 * It renders where it was embedded, so a clipping ancestor clips it whatever
 * the container — measured identically across all eleven modes. It gets the
 * closed shadow root for the CSS fight and nothing else: no dialog, no
 * backdrop, no top layer (ADR 0009, ADR 0011).
 */
function inline(options: MountOptions, anchor: Element): Mounted {
  const parts = shell(options.template, null, options);

  return {
    mounted: true,
    get root() {
      return parts.root;
    },
    steps: options.template.tree.steps.length,
    show() {
      documentStyle();
      anchor.appendChild(parts.host);
    },
    showStep: (step) => void parts.step(step),
    close: () => parts.host.remove(),
  };
}

/**
 * The way out, supplied by the container rather than by the vocabulary — a
 * template must not be able to omit it.
 *
 * The label is English here because the loader carries no i18n runtime: it is
 * a raw IIFE with no `wp.i18n` dependency, and adding one would put a second
 * script on the page for one string. Esc and the backdrop are unlabelled
 * routes to the same act, so a visitor is never trapped by it.
 */
function closeButton(onClick: () => void): HTMLElement {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'wc-close';
  button.textContent = '×';
  button.setAttribute('aria-label', 'Close');
  button.addEventListener('click', onClick);

  return button;
}
