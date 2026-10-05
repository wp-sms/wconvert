import { resultProducts } from '../../journeys/loader/result-products';
import { showProducts } from '@loader/products';
import type { ResultVariant } from '@renderer/types';
import type { showQuizProducts } from './quiz-products';

/** The commerce runtime stays off pages without enhanced result cards. */
export function showResultProducts(host: HTMLElement, result: ResultVariant | undefined, click: () => void, id: string, screen: string, scope: object): () => void {
  const payload = document.getElementById('wconvert-payload');
  const runtime = payload?.getAttribute('data-commerce-runtime');
  if (!runtime || !payload?.hasAttribute('data-commerce-quiz')) return showProducts(host, result, click);
  if (!result || (!result.product_filter && !result.product_ids?.length)) return () => {};
  let closed = false; let stop: (() => void) | undefined;
  const load = async () => {
    host.textContent = 'Loading current products…';
    try {
      const url = new URL(runtime, location.href);
      if (url.origin !== location.origin) throw Error('origin');
      const module = await import(/* @vite-ignore */ url.href) as { showQuizProducts: typeof showQuizProducts };
      if (!closed) stop = module.showQuizProducts(host, result, click, id, screen, scope);
    } catch {
      if (closed) return;
      host.textContent = 'Products could not load. You can still use the link below.';
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'wc-button'; retry.textContent = 'Retry products';
      retry.onclick = () => { void load(); }; host.append(retry);
    }
  };
  void load();
  return () => { closed = true; stop?.(); };
}

export function registerQuizProducts(): void { resultProducts.show = showResultProducts; }
