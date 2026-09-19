import type { Template } from './types';
import { A_DESIGNS_OWN_WIDTH, DOCUMENT_CSS, SHADOW_CSS } from './css';
import { COUNTDOWN_SLOT, render } from './render';

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
 * the pieces this module exports — {@link render}, {@link SHADOW_CSS},
 * {@link documentStyle}, {@link shell}, {@link closeButton} and
 * {@link NOTHING}.
 *
 * **The last two are exported FOR that, and the export is the whole change
 * free's tree needed.** They are shared container machinery rather than
 * premium code: {@link shell} owns the closed shadow root, the step swap and
 * the submit guard that stops a bare form navigating the page out from under a
 * half-filled Optin, and {@link closeButton} owns the way out a template must
 * not be able to omit. Copying either into Pro's tree would be two of each,
 * and the pair that drifts first is the guard — silently, into a page reload
 * nobody reproduces. Exporting them keeps the dependency running the one way
 * this split allows: Pro reaches into free, free never reaches into Pro.
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
  'inline-size': `var(--wc-width,${A_DESIGNS_OWN_WIDTH})`,
  'max-inline-size': 'calc(100% - 2rem)',
  'block-size': 'fit-content',
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
  /** Non-default viewport edge or corner for Pro's non-modal containers. */
  readonly placement?: string;
  readonly template: Template;
  /**
   * When this Optin's window shuts, as an absolute instant in milliseconds —
   * the Optin's own `ends_at` and nothing else (ADR 0052).
   *
   * ==========================================================================
   * IT IS THE SCHEDULE'S, WHICH IS WHY IT ARRIVES HERE AND NOT IN THE TREE.
   * ==========================================================================
   * A `countdown` node carries no deadline of its own. The merchant authors one
   * wall time on the Rules tab, `Schedule.php` resolves it once on the server
   * against `wp_timezone()`, and the payload carries the instant — so the same
   * value drives the display and the window, and a timer that disagrees with
   * the schedule it is counting to is not expressible.
   *
   * Absent where an Optin has no end. The countdown then draws its shape and no
   * time, which is what a design with a clock and nothing to count to honestly
   * is — and `builder/structure/problems.ts` says so on the screen where it can
   * be fixed.
   */
  readonly endsAt?: number;
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
  /**
   * Stamp every element with its own address in the tree.
   *
   * The BUILDER's, and nobody else's: it is what makes the preview an editing
   * surface for a box that carries no [[Slot Role]] — a `panel`, a `split` —
   * and it is bytes on every element of every design on a page that has nothing
   * to select. {@see \@renderer/render's RenderOptions}.
   */
  readonly paths?: boolean;
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

/**
 * Nowhere to mount, and nothing pretending otherwise.
 *
 * Exported for the same reason {@link shell} and {@link closeButton} are: a
 * container that decides it has nothing to draw has to say so in the shape
 * every caller already handles, and a second copy of these six lines under
 * Pro's tree would be a second answer to "what does a container return when it
 * declines" for the presenter to get wrong.
 */
export const NOTHING: Mounted = {
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
 * The shadow root and everything in it, which every container shares —
 * free's two, and Pro's popover.
 *
 * Returns a `step` function rather than the root, because swapping steps has
 * to replace the rendered tree INSIDE the boundary and the caller must not
 * have to reach in to do it.
 */
export function shell(template: Template, chrome: HTMLElement | null, options: MountOptions): {
  host: HTMLElement;
  root: HTMLElement;
  step: (step: number) => HTMLElement;
  stop: () => void;
} {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');

  style.textContent = SHADOW_CSS;
  shadow.appendChild(style);

  let root = render(template.tree, template.tokens, 0, { paths: options.paths });

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

    for (const cta of element.querySelectorAll('a[data-convert]')) {
      cta.addEventListener('click', () => options.onConvert?.());
    }

    // Painted on BIND rather than only on the interval, so a countdown is right
    // the frame it appears — including the one a step swap has just drawn,
    // which would otherwise show the renderer's empty shape for up to a second.
    paint(element);
  }

  /**
   * Fill every countdown in the rendered step with the time left.
   *
   * The renderer draws the shape and no time, so this is the whole of the seam
   * between a pure `render()` and a live clock — and it is here rather than in
   * a container because all three containers share this function and none of
   * them should have to know what a countdown is.
   */
  function paint(element: HTMLElement): void {
    const left = options.endsAt === undefined ? null : options.endsAt - Date.now();

    for (const slot of element.querySelectorAll(`.${COUNTDOWN_SLOT}`)) {
      slot.textContent = left === null ? '' : remaining(left);
    }
  }

  /**
   * One interval for the whole mount, started only where there is something to
   * count to.
   *
   * ==========================================================================
   * IT DIES WITH THE MOUNT, WHICH IS WHY NO TEARDOWN HANDLE HAD TO BE INVENTED.
   * ==========================================================================
   * Every container already has a `close()` the loader and the admin both call,
   * and {@link Mounted.close} is what `Preview`'s effect cleans up with. So the
   * tick is stopped where the mount ends, and the failure this is guarding
   * against — the builder rebuilding its preview on every keystroke, leaking
   * one interval per letter, and the gallery running one per card — cannot
   * happen.
   *
   * Absent `endsAt` starts nothing at all: an interval that repaints an empty
   * string once a second is a timer running on every page view of every Optin
   * nobody scheduled.
   */
  const ticking =
    options.endsAt === undefined ? undefined : setInterval(() => paint(root), 1000);

  return {
    host,
    get root() {
      return root;
    },
    step(index: number): HTMLElement {
      const next = render(template.tree, template.tokens, index, { paths: options.paths });

      bind(next);
      root.replaceWith(next);
      root = next;

      return next;
    },
    stop(): void {
      clearInterval(ticking);
    },
  };
}

/**
 * How long is left, as digits.
 *
 * `d` only where there are days, because `00d 04:15:33` spends four characters
 * saying nothing on the overwhelming majority of offers — and a bar has one
 * line to work with (its whole design constraint is staying under about 15% of
 * a phone's viewport).
 *
 * **It floors at zero rather than going negative.** A window that has shut
 * takes the Optin off the page entirely (ADR 0050), so a negative number is
 * only reachable on a page cached WHILE the window was open, where the honest
 * reading is that the offer is over.
 */
function remaining(ms: number): string {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const days = Math.floor(total / 86400);
  const pad = (part: number): string => String(part).padStart(2, '0');

  return (
    (days > 0 ? `${days}d ` : '') +
    [Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60].map(pad).join(':')
  );
}

/** Shared modal lifecycle. Pro supplies its own geometry and step decoration. */
export interface ModalSurface {
  styles?: Readonly<Record<string, string>>;
  prepare?: (root: HTMLElement) => void;
  opened?: () => void;
  closed?: () => void;
  lightDismiss?: boolean;
}

function popup(options: MountOptions): Mounted {
  return mountModal(options);
}

export function mountModal(options: MountOptions, surface: ModalSurface = {}): Mounted {
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
  // The dialog resolves the design width against the viewport. Its inner root
  // fills that box; resolving a percentage there again would shrink it twice.
  // This render-only copy also applies to later screens without changing any
  // authored node scope, narrow override, or stored template token.
  const parts = shell(
    { ...options.template, tokens: { ...options.template.tokens, width: '100%' } },
    chrome,
    options,
  );

  dialog.className = 'wconvert-dialog';
  dialog.appendChild(parts.host);

  for (const [property, value] of Object.entries({ ...DIALOG_ARMOUR, ...surface.styles })) {
    dialog.style.setProperty(property, value, 'important');
  }

  // The backdrop cannot see tokens inside the shadow boundary.
  const backdrop = options.template.tokens.backdrop;

  // Container-size containment makes the inner root's intrinsic width zero.
  // The dialog owns the explicit design width; the form inside fills it.
  if (options.template.tokens.width !== undefined) {
    dialog.style.setProperty('--wc-width', options.template.tokens.width);
  }

  if (backdrop !== undefined) {
    dialog.style.setProperty('--wc-backdrop', backdrop);
  }

  // Light dismiss, which `showModal()` does not supply. A click that lands on
  // the dialog itself landed outside the panel, because the panel is inside
  // the host div and the dialog has no padding of its own.
  dialog.addEventListener('click', (event) => {
    if (surface.lightDismiss !== false && event.target === dialog) {
      dialog.close();
    }
  });

  let dismissible = true;

  dialog.addEventListener('close', () => {
    dialog.style.setProperty('display', 'none', 'important');
    // Every route out of a dialog ends here — Esc, the backdrop, the close
    // button and `close()` itself — which is why the tick is stopped on the
    // EVENT rather than beside each of them. A dialog stays in the document
    // after it closes, so nothing else would ever end the interval.
    parts.stop();
    surface.closed?.();

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
      surface.prepare?.(parts.root);
      dialog.setAttribute('aria-label', parts.root.querySelector('h1,h2')?.textContent || 'Campaign');
      documentStyle();
      document.body.appendChild(dialog);
      dialog.style.setProperty('display', 'block', 'important');
      try {
        dialog.showModal();
        surface.opened?.();
      } catch (error) {
        parts.stop();
        surface.closed?.();
        dialog.remove();
        throw error;
      }
    },
    showStep(step) {
      const root = parts.step(step);
      surface.prepare?.(root);
      dialog.setAttribute('aria-label', root.querySelector('h1,h2')?.textContent || 'Campaign');
    },
    close() {
      // The four ways a visitor dismisses are one thing; closing it OURSELVES
      // is not one of them. A conversion closes the Optin and is emphatically
      // not a Dismissal (CONTEXT.md, Dismissal).
      dismissible = false;
      parts.stop();
      dialog.close();
      surface.closed?.();
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
    close() {
      parts.stop();
      parts.host.remove();
    },
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
export function closeButton(onClick: () => void): HTMLElement {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'wc-close';
  button.textContent = '×';
  button.setAttribute('aria-label', 'Close');
  button.addEventListener('click', onClick);

  return button;
}
