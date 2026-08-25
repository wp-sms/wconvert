import '@testing-library/jest-dom/vitest';

/**
 * jsdom 26 ships `<dialog>` with an `open` property and nothing else — no
 * `showModal`, no `show`, no `close`, no `close` event. So this is the
 * smallest shim that lets the container's OWN logic be tested: that the popup
 * is promoted with `showModal()` and never `show()`, and that a visitor's
 * close is reported as a Dismissal where ours is not.
 *
 * **It deliberately models none of the behaviour the decision rests on.** The
 * top layer, the focus trap, Esc-to-close and focus restoration are what
 * `showModal()` supplies natively, and they were settled by measurement
 * against real themes rather than by unit tests (ADR 0009). Re-verify those in
 * a browser; do not grow this shim towards pretending to have them.
 */
const dialogs = new WeakSet<HTMLDialogElement>();

function close(this: HTMLDialogElement, returnValue?: string): void {
  if (!this.open) {
    return;
  }

  if (returnValue !== undefined) {
    this.returnValue = returnValue;
  }

  this.open = false;
  dialogs.delete(this);
  this.dispatchEvent(new Event('close'));
}

Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    configurable: true,
    writable: true,
    value(this: HTMLDialogElement): void {
      this.open = true;
      dialogs.add(this);
    },
  },
  show: {
    configurable: true,
    writable: true,
    value(this: HTMLDialogElement): void {
      this.open = true;
    },
  },
  close: { configurable: true, writable: true, value: close },
});
