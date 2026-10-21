/**
 * Room beside a bar's or slide-in's close control for exactly what it covers.
 *
 * A phone-width bar stacks and its control keeps the top corner, as a
 * slide-in's always does. A band of padding above everything costs a row of
 * nothing, and a column beside everything pushes a field and its button onto
 * two lines, so only what the control overlaps gets `padding-inline-end`:
 * text directly, and a field or button through the row holding it, so the
 * control never reshapes. Logical padding, so right-to-left needs no second
 * rule.
 *
 * One ResizeObserver does all the timing: it reports once laid out, again when
 * the width changes and when fonts settle, each of which moves where text
 * wraps. Re-measuring lands on the same padding, so it settles. It only ever
 * reports a root that has been on the page, so a detached one is a step
 * `shell()` has replaced, and the new step gets its own observer.
 */
export function reserveBesideClose(root: HTMLElement, close: HTMLElement): void {
  if (typeof ResizeObserver !== 'function') return;

  new ResizeObserver((_, observer) => {
    if (!root.isConnected) return observer.disconnect();
    const reserved = root.querySelectorAll<HTMLElement>('[data-wcr]');
    for (const element of reserved) {
      element.removeAttribute('data-wcr');
      element.style.paddingInlineEnd = '';
    }

    // Room for one line can re-wrap what follows it under the control.
    for (let pass = 0, moved = 1; moved && pass < 3; pass++) {
      const c = close.getBoundingClientRect();
      moved = 0;
      for (const element of root.querySelectorAll<HTMLElement>('.wc-heading,.wc-text,.wc-eyebrow,.wc-badge,.wc-rating,.wc-code,.wc-countdown,.wc-field,.wc-button')) {
        const b = element.getBoundingClientRect();
        const target = element.matches('.wc-field,.wc-button') ? element.closest<HTMLElement>('.wc-row') ?? element : element;
        if (target.hasAttribute('data-wcr') || b.top >= c.bottom + 8 || b.bottom <= c.top || b.right <= c.left - 8 || b.left >= c.right + 8) continue;
        target.setAttribute('data-wcr', '');
        target.style.paddingInlineEnd = `${close.offsetWidth + 8}px`;
        moved = 1;
      }
    }
  }).observe(root);
}
