import type { ProductsNode, TemplateNode } from '@renderer/types';
import { cartCards, contextStatus, watchCart, type ProductCard } from './context';
import { additionSession, refreshNativeCart, type AdditionState } from './addition';

export function renderProductNode(raw: TemplateNode): HTMLElement | null {
  if (raw.type !== 'products') return null;
  const node = raw as ProductsNode;
  const adding = node.action === 'add_to_cart';
  const session = adding ? additionSession(node.context_key ?? '') : undefined;
  const host = document.createElement('div');
  host.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr));gap:1rem;text-align:start';
  const outcomes = new Map<number, { card: ProductCard; state: AdditionState }>();
  let pending = false; let closed = false; let converted = false;
  let labels: string[] = []; let emptyLabels: string[] = [];
  const payload = document.getElementById('wconvert-payload');
  try { labels = JSON.parse(payload?.getAttribute('data-commerce-add-labels') ?? '[]'); emptyLabels = JSON.parse(payload?.getAttribute('data-commerce-labels') ?? '[]'); } catch { /* Cached markup can omit labels. */ }
  const text = (index: number) => labels[index] ?? ['Adding…', 'Added to your basket.', 'Not added. Open the product to try again.', 'Check your basket before trying again.', 'View basket', 'View product', 'Added'][index];
  const localUrl = (value: string) => { try { const url = new URL(value, location.href); return url.origin === location.origin && /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; } };
  const paint = (force = false) => {
    if (pending || closed || (!force && contextStatus() === 'pending' && host.childElementCount > 0)) return;
    const active = (host.getRootNode() as ShadowRoot).activeElement as HTMLElement | null;
    const focused = active && host.contains(active) ? active.dataset.product : undefined;
    const cards = [...outcomes.values()].map(value => value.card);
    for (const card of cartCards(node.context_key ?? '')) if (!outcomes.has(card.id)) cards.push(card);
    const children: HTMLElement[] = [];
    for (const card of cards.slice(0, 3)) {
      const url = localUrl(card.url); if (!url) continue;
      const item = document.createElement('article'); item.style.cssText = 'display:grid;align-content:start;gap:.5rem;min-width:0';
      if (card.image) {
        const image = document.createElement('img'); image.src = card.image; image.alt = ''; image.loading = 'lazy';
        image.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--wc-radius,.5rem)'; item.append(image);
      }
      const title = document.createElement('strong'); title.textContent = card.name;
      const price = document.createElement('span'); price.textContent = card.price;
      item.append(title, price);
      const outcome = outcomes.get(card.id);
      if (adding && card.can_add && session) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'wc-button'; button.dataset.product = String(card.id);
        button.textContent = outcome?.state === 'added' ? text(6) : card.label;
        button.setAttribute('aria-label', `${button.textContent}: ${card.name}`);
        button.setAttribute('aria-disabled', String(!!outcome));
        const status = document.createElement('p'); status.setAttribute('role', 'status'); status.style.cssText = 'margin:0;font-size:.875em;line-height:1.5';
        if (outcome) status.textContent = text(outcome.state === 'added' ? 1 : outcome.state === 'rejected' ? 2 : 3);
        button.addEventListener('click', async () => {
          if (pending || outcomes.has(card.id)) return;
          for (const control of host.querySelectorAll('button')) { control.setAttribute('aria-disabled', 'true'); if (control !== button) control.style.opacity = '.65'; }
          pending = true; button.textContent = text(0); button.setAttribute('aria-disabled', 'true'); status.textContent = text(0);
          const state = await session.add(card.id, card.price_key);
          pending = false;
          if (closed || !host.isConnected) { if (state === 'added') refreshNativeCart(); return; }
          if (state === 'busy') { paint(); return; }
          outcomes.set(card.id, { card, state }); paint(true);
          if (state === 'added') {
            if (!converted) { converted = true; host.dispatchEvent(new Event('wconvert:cart-added', { bubbles: true })); }
            refreshNativeCart();
          }
        });
        item.append(button, status);
        const link = document.createElement('a'); link.href = url; link.textContent = text(5); link.style.cssText = 'color:var(--wc-accent);text-underline-offset:.2em'; link.setAttribute('aria-label', `${text(5)}: ${card.name}`); item.append(link);
        if (outcome && outcome.state !== 'rejected') {
          const cart = localUrl(payload?.getAttribute('data-commerce-cart') ?? '');
          if (cart) { const link = document.createElement('a'); link.href = cart; link.textContent = text(4); link.style.cssText = 'color:var(--wc-accent);text-underline-offset:.2em'; item.append(link); }
        }
      } else {
        const link = document.createElement('a'); link.className = 'wc-button'; link.href = url; link.textContent = card.label; link.dataset.product = String(card.id);
        if (!adding) link.dataset.convert = '';
        link.setAttribute('aria-label', `${card.label}: ${card.name}`); item.append(link);
      }
      children.push(item);
    }
    if (!children.length) {
      const status = document.createElement('p'); status.setAttribute('role', 'status');
      status.textContent = contextStatus() === 'ready' ? emptyLabels[0] ?? 'No further suggestions right now.' : emptyLabels[1] ?? 'Product suggestions are unavailable right now.';
      children.push(status);
    }
    host.replaceChildren(...children);
    if (focused) { host.tabIndex = -1; (host.querySelector<HTMLElement>(`[data-product="${focused}"]`) ?? host).focus(); }
  };
  paint();
  const stop = watchCart(() => { if (!host.isConnected) { stop(); return; } paint(); });
  queueMicrotask(() => host.closest('.wc-root')?.addEventListener('wconvert:closed', () => { closed = true; stop(); }, { once: true }));
  return host;
}
