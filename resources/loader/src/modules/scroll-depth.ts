import type { LoaderModule } from '../types';

/**
 * `scroll_depth` — fires when the visitor has reached N% of the document.
 *
 * Two details are findings rather than style. The position is READ AT
 * INSTANTIATION, before any listener is attached, because under delayed JS the
 * visitor has already scrolled and the events we missed are never replayed.
 * And a document shorter than the viewport counts as fully scrolled, or a rule
 * that says "half way down" can never fire on a short page.
 *
 * The high-water mark is deliberate: scrolling back up does not un-reach a
 * depth that was reached.
 */
function depth(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;

  return scrollable > 0 ? Math.min(100, Math.round((window.scrollY / scrollable) * 100)) : 100;
}

export const scrollDepth: LoaderModule = {
  id: 'scroll_depth',
  kind: 'trigger',
  consentCategory: null,
  create: (changed) => {
    let deepest = depth();

    const onScroll = (): void => {
      deepest = Math.max(deepest, depth());
      changed();
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return {
      holds: (rule) => deepest >= Number(rule.percent),
      stop: () => window.removeEventListener('scroll', onScroll),
    };
  },
};
