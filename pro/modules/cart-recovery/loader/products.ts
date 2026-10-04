import type { ProductsNode, TemplateNode } from '@renderer/types';
import { cartCards, contextStatus, watchCart } from './context';

export function renderProductNode(raw: TemplateNode): HTMLElement | null {
    if (raw.type !== 'products') return null;
    const node = raw as ProductsNode;
    const host = document.createElement('div');
    host.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr));gap:1rem;text-align:start';
    host.setAttribute('aria-live', 'polite');
    const paint = () => {
      const focused = host.contains((host.getRootNode() as ShadowRoot).activeElement);
      const cards = cartCards(node.context_key ?? '');
      const children: HTMLElement[] = [];
      for (const card of cards) {
        let url: URL;
        try { url = new URL(card.url, location.href); if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) continue; } catch { continue; }
        const item = document.createElement('article'); item.style.cssText = 'display:grid;align-content:start;gap:.5rem;min-width:0';
        if (card.image) {
          const image = document.createElement('img'); image.src = card.image; image.alt = ''; image.loading = 'lazy';
          image.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--wc-radius,.5rem)'; item.append(image);
        }
        const title = document.createElement('strong'); title.textContent = card.name;
        const price = document.createElement('span'); price.textContent = card.price;
        const link = document.createElement('a'); link.className = 'wc-button'; link.href = url.href; link.textContent = card.label; link.dataset.convert = '';
        link.setAttribute('aria-label', `${card.label}: ${card.name}`); item.append(title, price, link); children.push(item);
      }
      if (!children.length) {
        const status = document.createElement('p'); status.setAttribute('role', 'status');
        let labels: string[] = [];
        try { labels = JSON.parse(document.getElementById('wconvert-payload')?.getAttribute('data-commerce-labels') ?? '[]'); } catch { /* Neutral fallback when cached markup is incomplete. */ }
        status.textContent = contextStatus() === 'ready' ? labels[0] ?? 'No further suggestions for this basket.' : labels[1] ?? 'Product suggestions are unavailable right now.';
        children.push(status);
      }
      host.replaceChildren(...children);
      if (focused) { host.tabIndex = -1; (host.querySelector('a') ?? host).focus(); }
    };
    paint();
    const stop = watchCart(() => { if (!host.isConnected) { stop(); return; } paint(); });
    queueMicrotask(() => host.closest('.wc-root')?.addEventListener('wconvert:closed', stop, { once: true }));
    return host;
}
