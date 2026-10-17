import apiFetch from '@wordpress/api-fetch';
import type { Occasion, Occasions } from '../discovery/api';

/**
 * The occasion routes (ADR 0153). Every campaign they create is a draft made
 * through `POST /optins`, so nothing here can publish.
 */
export const readOccasions = () => apiFetch<Occasions>({ path: '/wconvert/v1/occasions' });

export interface CopyResult {
  occasion: Occasion;
  created: { id: string; name: string }[];
  failed: { name: string; message: string }[];
}
export const copyOccasion = (id: string) =>
  apiFetch<CopyResult>({ path: `/wconvert/v1/occasions/${encodeURIComponent(id)}/copy`, method: 'POST' });

/** The document as the server wrote it, which is what an import reads back. */
export const exportOccasion = (id: string) =>
  apiFetch<Record<string, unknown>>({ path: `/wconvert/v1/occasions/${encodeURIComponent(id)}/export` });

export interface ImportResult {
  occasion: Occasion;
  created: { id: string; name: string }[];
  refused: { name: string; reason: string }[];
}
export const importOccasion = (document: unknown) =>
  apiFetch<ImportResult>({ path: '/wconvert/v1/occasions/import', method: 'POST', data: { document } });

/** Hand the browser a file to save; its own download is the feedback (GUIDELINES §8). */
export function download(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * What a copy or an import did, said once beside the thing it made: a
 * sentence, then each campaign that did not come across and why.
 */
export interface OccasionNotice {
  occasion: string;
  /** A copy is told on the occasion it made; an import on the list it came into. */
  kind: 'copy' | 'import';
  title: string;
  problems: string[];
}
