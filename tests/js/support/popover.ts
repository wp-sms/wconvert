/**
 * The smallest `popover` shim jsdom 26 makes necessary, and the reason it is a
 * support module rather than three lines in `setup.ts`.
 *
 * jsdom has no popover at all — no `showPopover`, no `hidePopover`, no
 * `:popover-open`, no top layer — so a container built on `[popover=manual]`
 * would otherwise be untestable in this suite in the way `<dialog>` already
 * was. `setup.ts` installs this beside the dialog shim, for the same reason and
 * with the same limit.
 *
 * **Whether a popover is showing has to be observable somewhere.** A real
 * browser answers it with `:popover-open`, which jsdom cannot match. Inventing
 * an attribute for it would be worse than a WeakSet: an attribute is DOM the
 * implementation could then read, and the implementation would be reading a
 * fact that does not exist outside this file. So the set is held here and asked
 * through {@link isShowing}, which only a test can reach.
 *
 * **It deliberately models none of the behaviour the decision rests on.** The
 * top layer is the entire reason ADR 0011 chose this container, and it is
 * exactly what a shim cannot supply — a popover here is an ordinary element
 * with a flag beside it. Positioning against a transformed ancestor is verified
 * in a browser, as the original measurement was; do not grow this towards
 * pretending otherwise.
 */
const showing = new WeakSet<HTMLElement>();

/** Is this popover currently showing? The shim's stand-in for `:popover-open`. */
export const isShowing = (element: Element | null | undefined): boolean =>
  element instanceof HTMLElement && showing.has(element);

export function installPopoverShim(): void {
  Object.defineProperties(HTMLElement.prototype, {
    showPopover: {
      configurable: true,
      writable: true,
      value(this: HTMLElement): void {
        showing.add(this);
      },
    },
    hidePopover: {
      configurable: true,
      writable: true,
      value(this: HTMLElement): void {
        showing.delete(this);
      },
    },
  });
}

/**
 * Model a browser that never had `popover` at all, for the length of one test.
 *
 * `popover` is Baseline April 2024 — later than `<dialog>`'s March 2022 — so
 * this is a real configuration rather than a hypothetical, and ADR 0011 books
 * its fallback rather than solving it. Returns the undo, so a test restores the
 * prototype it borrowed.
 */
export function withoutPopoverSupport(): () => void {
  const show = HTMLElement.prototype.showPopover;
  const hide = HTMLElement.prototype.hidePopover;

  // @ts-expect-error — modelling an engine that never had them.
  delete HTMLElement.prototype.showPopover;
  // @ts-expect-error — the other half of the same engine.
  delete HTMLElement.prototype.hidePopover;

  return () => {
    HTMLElement.prototype.showPopover = show;
    HTMLElement.prototype.hidePopover = hide;
  };
}
