import type { ResultVariant, ProductsNode } from '@renderer/types';
import { readPayload } from '@loader/payload';
import { additionSession } from './addition';
import { renderProductNode, productState } from './products';
import type { ProductCard } from './context';

interface Scope { state?: ReturnType<typeof productState>; sessions?: Map<string, ReturnType<typeof additionSession>> }
/** One quiz mount owns observations and addition outcomes across result revisits. */
export function showQuizProducts(host: HTMLElement, result: ResultVariant, click: () => void, id: string, screen: string, scope: Scope): () => void {
  scope.state ??= productState(); scope.sessions ??= new Map();
  const key = `${screen}:${result.id}`;
  if (!scope.sessions.has(key)) scope.sessions.set(key, additionSession(id, { screen, result: result.id }));
  const state = scope.state; const session = scope.sessions.get(key)!;
  let closed = false; let loading = false; let controller: AbortController | undefined; let stop: (() => void) | undefined;
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.tabIndex = -1;
  const load = async () => {
    if (loading || closed) return;
    loading = true; controller = new AbortController();
    const timer = setTimeout(() => controller?.abort(), 8000);
    const focused = host.contains((host.getRootNode() as Document | ShadowRoot).activeElement);
    status.textContent = 'Loading current products…'; host.replaceChildren(status);
    if (focused) status.focus();
    try {
      const endpoint = document.getElementById('wconvert-payload')?.getAttribute('data-commerce-quiz');
      const entry = readPayload()?.find(value => value.id === id) as unknown as { commerce_revision?: string } | undefined;
      if (!endpoint || !entry?.commerce_revision) throw Error('endpoint');
      const url = new URL(endpoint, location.href); if (url.origin !== location.origin) throw Error('origin');
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        body: new URLSearchParams({ id, revision: entry.commerce_revision, screen, result: result.id }) });
      if (!response.ok) throw Error('read');
      const cards: unknown = await response.json();
      if (!Array.isArray(cards)) throw Error('cards');
      if (closed) return;
      if (!cards.length) { status.textContent = 'These products are unavailable right now. Please use the link below.'; return; }
      const options = { cards: cards as ProductCard[], state, session, click, stop: undefined as (() => void) | undefined };
      const node = renderProductNode({ type: 'products', context_key: id, action: result.product_action ?? 'link' } as ProductsNode, options);
      stop = options.stop;
      if (node) host.replaceChildren(node);
      if (focused) { host.tabIndex = -1; host.focus(); }
    } catch {
      if (closed) return;
      status.textContent = 'Products could not load. You can still use the link below.';
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'wc-button'; retry.textContent = 'Retry products';
      retry.onclick = () => { void load(); }; host.append(retry);
    } finally { clearTimeout(timer); loading = false; }
  };
  void load();
  return () => { closed = true; controller?.abort(); stop?.(); };
}
