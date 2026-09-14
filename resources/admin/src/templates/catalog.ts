import apiFetch from '@wordpress/api-fetch';
import type { TemplateEntry } from './api';

export interface CatalogPack {
  id: string;
  name: string;
  description: string;
  version: string;
  installed_version: string | null;
  state: 'available' | 'update' | 'installed';
}
export interface CatalogStatus {
  configured: boolean;
  source: string;
  checked_at: string | null;
  packs: CatalogPack[];
}
export interface PackPreview {
  id: string;
  name: string;
  version: string;
  digest: string;
  templates: TemplateEntry[];
  starting_points?: { id: string; name: string; goal: string; goal_label: string; template_id: string }[];
}
const path = '/wconvert/v1/template-catalog';
export const catalogStatus = () => apiFetch<CatalogStatus>({ path });
export const refreshCatalog = () => apiFetch<CatalogStatus>({ path: `${path}/refresh`, method: 'POST' });
export const previewPack = (id: string, installed: boolean) =>
  apiFetch<PackPreview>({ path: `${path}/preview`, method: 'POST', data: { id, installed } });
export const installPack = (id: string, digest: string) =>
  apiFetch<CatalogStatus>({ path: `${path}/install`, method: 'POST', data: { id, digest } });
