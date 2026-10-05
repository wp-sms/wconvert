import { showProducts } from '@loader/products';
import type { ResultVariant } from '@renderer/types';

/** Modules may enhance result cards without moving commerce into every paid loader. */
export const resultProducts: { show(host: HTMLElement, result: ResultVariant | undefined, click: () => void, id: string, screen: string, scope: object): () => void } = { show: showProducts };
