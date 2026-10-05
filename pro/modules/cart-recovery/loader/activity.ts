import type { ProductCard } from './context';

/** Per-mount observations; no visitor identifiers or browser storage. */
export function productActivity(host: HTMLElement, id: string) {
  const seen = new Set<number>();
  const clicked = new Set<number>();
  const cards = new Map<Element, ProductCard>();
  let closed = false;
  const endpoint = document.getElementById('wconvert-payload')?.getAttribute('data-commerce-activity');
  const visible = () => !closed && host.isConnected && document.visibilityState !== 'hidden'
    && !(document as Document & { prerendering?: boolean }).prerendering;
  const report = (card: ProductCard, kind: string) => {
    if (!endpoint || !card.activity_token || !visible()) return;
    const body = new URLSearchParams({ id, product: String(card.id), kind, token: card.activity_token });
    try {
      const url = new URL(endpoint, location.href);
      if (url.origin !== location.origin) return;
      if (navigator.sendBeacon?.(url.href, body)) return;
      void fetch(url.href, { method: 'POST', body, credentials: 'same-origin', keepalive: true }).catch(() => {});
    } catch { /* Counts must never interrupt shopping. No ambiguous retries. */ }
  };
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    if (!visible()) return;
    for (const entry of entries) {
      const card = cards.get(entry.target);
      if (!card || !entry.isIntersecting || entry.intersectionRect.width <= 0 || entry.intersectionRect.height <= 0 || seen.has(card.id)) continue;
      seen.add(card.id); report(card, 'product_shown'); observer?.unobserve(entry.target);
    }
  });
  const resume = () => {
    if (!visible()) return;
    for (const [element, card] of cards) if (!seen.has(card.id)) { observer?.unobserve(element); observer?.observe(element); }
  };
  document.addEventListener('visibilitychange', resume);
  document.addEventListener('prerenderingchange', resume);
  return {
    reset() { observer?.disconnect(); cards.clear(); },
    card(element: HTMLElement, card: ProductCard) {
      if (!endpoint || !card.activity_token) return;
      cards.set(element, card);
      if (!seen.has(card.id)) observer?.observe(element);
      for (const link of element.querySelectorAll('a')) {
        // Only links to this product; never the basket or the add button.
        if (link.href !== new URL(card.url, location.href).href) continue;
        link.addEventListener('click', () => {
          if (!visible() || clicked.has(card.id)) return;
          clicked.add(card.id); report(card, 'product_click');
        });
      }
    },
    stop() {
      closed = true; observer?.disconnect(); cards.clear();
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('prerenderingchange', resume);
    },
  };
}
